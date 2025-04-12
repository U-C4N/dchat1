import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';
import { tool } from 'ai';

const app = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

export const deepResearch = tool({
  description: 'Perform deep research on a topic by searching the web and extracting relevant information',
  parameters: z.object({
    topic: z.string().describe('The topic to research in depth'),
  }),
  execute: async ({ topic }) => {
    console.log('[DEEP RESEARCH] Starting research on topic:', topic);
    
    const mockDataStream = {
      writeData: (data: any) => {
        console.log('[DEEP RESEARCH]', data.type, JSON.stringify(data.content).substring(0, 100) + '...');
        return true;
      }
    };
    
    const maxDepth = 3; // User specified maxDepth
    const maxLinks = 5; // User specified maxLinks
    const maxDuration = 120 * 1000; // User specified timeout in milliseconds
    
    const researchState = {
      findings: [] as string[],
      summaries: [] as string[],
      currentDepth: 0,
      nextSearchTopic: topic,
      completedSteps: 0,
      totalExpectedSteps: maxDepth * 3, // 3 steps per depth level (search, extract, analyze)
    };

    const addSource = (source: any) => {
      mockDataStream.writeData({
        type: 'source-delta',
        content: source,
      });
    };

    const addActivity = (activity: any) => {
      mockDataStream.writeData({
        type: 'activity-delta',
        content: {
          ...activity,
          completedSteps: researchState.completedSteps,
          totalSteps: researchState.totalExpectedSteps,
        },
      });
    };

    mockDataStream.writeData({
      type: 'progress-init',
      content: {
        maxDepth,
        totalSteps: researchState.totalExpectedSteps,
      },
    });

    const startTime = Date.now();
    const shouldContinue = true;

    try {
      while (
        researchState.currentDepth < maxDepth &&
        shouldContinue &&
        Date.now() - startTime < maxDuration
      ) {
        mockDataStream.writeData({
          type: 'depth-delta',
          content: {
            current: researchState.currentDepth + 1,
            max: maxDepth,
          },
        });

        addActivity({
          type: 'search',
          status: 'pending',
          message: `Searching for: ${researchState.nextSearchTopic}`,
          timestamp: new Date().toISOString(),
          depth: researchState.currentDepth + 1,
        });

        let searchResults: any[] = [];
        try {
          const searchResponse: any = await app.search(researchState.nextSearchTopic);
          researchState.completedSteps++;
          
          if (Array.isArray(searchResponse)) {
            searchResults = searchResponse;
          } else if (searchResponse && typeof searchResponse === 'object') {
            searchResults = searchResponse.results || searchResponse.items || [];
          }

          addActivity({
            type: 'search',
            status: 'complete',
            message: `Found ${searchResults.length} results for: ${researchState.nextSearchTopic}`,
            timestamp: new Date().toISOString(),
            depth: researchState.currentDepth + 1,
          });

          searchResults.slice(0, maxLinks).forEach((result: any) => {
            addSource({
              url: result.url,
              title: result.title || result.url,
              relevance: 1,
            });
          });
        } catch (error: any) {
          addActivity({
            type: 'search',
            status: 'error',
            message: `Search failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            depth: researchState.currentDepth + 1,
          });
          continue;
        }

        const topUrls = searchResults.slice(0, maxLinks).map((r: any) => r.url);
        
        addActivity({
          type: 'extract',
          status: 'pending',
          message: `Extracting content from ${topUrls.length} sources`,
          timestamp: new Date().toISOString(),
          depth: researchState.currentDepth + 1,
        });

        try {
          const extractPromises = topUrls.map(async (url: string) => {
            try {
              const result: any = await app.extract([url]);
              let content = '';
              if (result && typeof result === 'object') {
                if (Array.isArray(result)) {
                  content = result[0]?.content || result[0]?.text || '';
                } else {
                  content = result.content || result.text || '';
                }
              }
              return content;
            } catch (err) {
              console.error(`Failed to extract from ${url}:`, err);
              return '';
            }
          });

          const extractedTexts = await Promise.all(extractPromises);
          const newFindings = extractedTexts.filter((text: string) => text.trim() !== '');
          
          researchState.findings.push(...newFindings);
          researchState.completedSteps++;

          addActivity({
            type: 'extract',
            status: 'complete',
            message: `Extracted content from ${newFindings.length} sources`,
            timestamp: new Date().toISOString(),
            depth: researchState.currentDepth + 1,
          });
        } catch (error: any) {
          addActivity({
            type: 'extract',
            status: 'error',
            message: `Extraction failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            depth: researchState.currentDepth + 1,
          });
        }

        addActivity({
          type: 'analyze',
          status: 'pending',
          message: 'Analyzing findings and planning next steps',
          timestamp: new Date().toISOString(),
          depth: researchState.currentDepth + 1,
        });

        try {
          const remainingTime = Math.max(0, maxDuration - (Date.now() - startTime));
          
          const summary = `Found information about ${topic} from ${researchState.findings.length} sources`;
          researchState.summaries.push(summary);
          
          const nextDepthTopic = `${topic} detailed analysis`;
          researchState.nextSearchTopic = nextDepthTopic;
          
          researchState.completedSteps++;
          researchState.currentDepth++;

          addActivity({
            type: 'analyze',
            status: 'complete',
            message: `Analysis complete. ${
              researchState.currentDepth < maxDepth
                ? `Next: ${researchState.nextSearchTopic}`
                : 'Research complete!'
            }`,
            timestamp: new Date().toISOString(),
            depth: researchState.currentDepth,
          });
        } catch (error: any) {
          addActivity({
            type: 'analyze',
            status: 'error',
            message: `Analysis failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            depth: researchState.currentDepth + 1,
          });
        }
      }

      addActivity({
        type: 'synthesis',
        status: 'pending',
        message: 'Creating final research summary',
        timestamp: new Date().toISOString(),
        depth: researchState.currentDepth,
      });

      const finalAnalysis = {
        text: `Research on "${topic}" found ${researchState.findings.length} relevant sources. ${researchState.summaries.join(' ')}`,
      };

      researchState.completedSteps++;

      addActivity({
        type: 'synthesis',
        status: 'complete',
        message: 'Research completed',
        timestamp: new Date().toISOString(),
        depth: researchState.currentDepth,
      });

      mockDataStream.writeData({
        type: 'finish',
        content: finalAnalysis.text,
      });

      return {
        success: true,
        data: {
          findings: researchState.findings,
          analysis: finalAnalysis.text,
          completedSteps: researchState.completedSteps,
          totalSteps: researchState.totalExpectedSteps,
          sources: [],
        },
      };
    } catch (error: any) {
      console.error('Deep research error:', error);

      addActivity({
        type: 'thought',
        status: 'error',
        message: `Research failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        depth: researchState.currentDepth,
      });

      return {
        success: false,
        error: error.message,
        data: {
          findings: researchState.findings,
          completedSteps: researchState.completedSteps,
          totalSteps: researchState.totalExpectedSteps,
        },
      };
    }
  },
});
