# Deep Research Implementation using Firecrawl

This document outlines how the "Deep Research" feature is implemented in the codebase, leveraging Vercel's AI SDK and Firecrawl for web searching and data extraction.

## Backend (`app/(chat)/api/chat/route.ts`)

The core logic resides in the `POST` handler within `app/(chat)/api/chat/route.ts`. It utilizes the `streamText` function from the `ai` package and defines a custom tool named `deepResearch`.

### Tool Definition

-   The `deepResearch` tool is defined within `streamText`'s `tools` option.
-   It accepts a `topic` (string) and `maxDepth` (number, default 7) as input.
-   The `execute` function orchestrates the research process.

```typescript
// app/(chat)/api/chat/route.ts
const result = streamText({
  // ... other options
  experimental_activeTools: experimental_deepResearch ? allTools : firecrawlTools,
  tools: {
    search: { /* ... */ },
    extract: { /* ... */ },
    scrape: { /* ... */ },
    deepResearch: {
      description: 'Perform deep research on a topic...',
      parameters: z.object({
        topic: z.string().describe('The topic or question to research'),
      }),
      execute: async ({ topic, maxDepth = 7 }) => {
        // ... research logic ...
      },
    },
  },
});
```

### Research Process

The `execute` function follows these steps within a loop controlled by `maxDepth` and a time limit:

**Conceptual Overview:** The core idea is an iterative cycle. Unlike a simple search, deep research involves multiple rounds of searching for information, extracting key details from the results, and then analyzing those details to understand what's known, identify gaps, and decide what to search for next. This allows the AI agent to build a more comprehensive understanding of the topic by exploring different facets and refining its search strategy based on intermediate findings.

1.  **Initialization:**
    *   Sets up `researchState` (findings, summaries, depth, progress).
    *   Sends initial progress info to the frontend: `dataStream.writeData({ type: 'progress-init', ... })`.
2.  **Research Loop (`while (researchState.currentDepth < maxDepth)`):**
    *   **Update UI Depth:** `dataStream.writeData({ type: 'depth-delta', ... })`.
    *   **Search:**
        *   Logs activity: `addActivity({ type: 'search', status: 'pending', ... })`.
        *   Calls Firecrawl API: `const searchResult = await app.search(searchTopic);` (using the `@mendable/firecrawl-js` client instance `app`). This performs a web search.
        *   Logs activity (complete/error).
        *   Sends sources to UI: `addSource(...)` which calls `dataStream.writeData({ type: 'source-delta', ... })`.
    *   **Extract:**
        *   Logs activity: `addActivity({ type: 'extract', status: 'pending', ... })`.
        *   Calls `extractFromUrls(topUrls)`. This function internally uses the Firecrawl API, likely `app.scrape(url)` (via the `@mendable/firecrawl-js` client), to fetch and extract content from the top search result URLs.
        *   Adds extracted text (`findings`) to `researchState`.
        *   Logs activity (complete/error).
    *   **Analyze & Plan:**
        *   Logs activity: `addActivity({ type: 'analyze', status: 'pending', ... })`.
        *   Calls an AI model (`analyzeAndPlan`) to:
            *   Summarize current findings.
            *   Identify knowledge gaps.
            *   Suggest the next search topic (`nextSearchTopic`).
            *   Determine if research should continue.
        *   Logs analysis summary/error activity.
        *   Updates `researchState` and potentially breaks the loop or sets the `topic` for the next iteration based on `gaps`.
3.  **Final Synthesis:**
    *   Logs activity: `addActivity({ type: 'synthesis', status: 'pending', ... })`.
    *   Calls an AI model (`generateText`) with all findings and summaries to produce a final comprehensive analysis.
    *   Logs completion activity.
    *   Sends the final analysis text to the frontend: `dataStream.writeData({ type: 'finish', content: finalAnalysis.text })`.

### Data Streaming

Throughout the process, updates are streamed to the frontend using `dataStream.writeData` with different `type` values (`progress-init`, `depth-delta`, `activity-delta`, `source-delta`, `finish`).

## Frontend

### State Management (`lib/deep-research-context.tsx`)

-   `DeepResearchProvider` manages the global state for the research UI.
-   `useDeepResearch` hook provides access to `state` (activity, sources, progress) and functions to update it (`addActivity`, `addSource`, `setDepth`, etc.).

```typescript
// lib/deep-research-context.tsx
interface DeepResearchState {
  isActive: boolean;
  activity: ActivityItem[];
  sources: SourceItem[];
  currentDepth: number;
  maxDepth: number;
  completedSteps: number;
  totalExpectedSteps: number;
}

// ... reducer and context provider ...

export function useDeepResearch() {
  // ... returns context value ...
}
```

### UI Display (`components/deep-research.tsx`)

-   This component renders the **floating panel** (usually positioned on the side of the chat interface) that displays the real-time progress of the deep research task.
-   It receives `activity` and `sources` data, likely passed down from a component using the `useDeepResearch` context.
-   Uses `Tabs` from `shadcn/ui` to separate the information:
    -   **Activity Tab:** Shows a reverse-chronological log. Each entry is visually structured like a **card** within the list: it contains a status indicator (e.g., a colored dot: yellow for pending, green for complete, red for error), the text description of the action/message, and a timestamp below the message. `motion.div` from `framer-motion` is used for subtle animations when new activities appear.
    -   **Sources Tab:** Lists the web sources discovered. Each source is also presented like a **card**: the page title is shown as a prominent clickable link (opening the URL in a new tab), and the source's hostname (e.g., `example.com`) is displayed below the title in a smaller font.

```typescript
// components/deep-research.tsx
export function DeepResearch({ activity = [], sources = [] }: DeepResearchProps) {
  // ... renders Tabs component within a styled div (fixed position, border, etc.) ...

  // Activity Tab Content
  <TabsContent value="activity">
    {/* Maps activity array to styled divs (cards) showing status icon, message, timestamp */}
    {activity.map((item, index) => (
      <motion.div key={index} className="flex items-center gap-3 p-2 border-b last:border-b-0" /* Animation props */>
        <div /* Status Indicator */ className={cn('size-2 rounded-full shrink-0', /* Color based on item.status */)} />
        <div className="flex-1 min-w-0">
          <p /* Message */ className="text-sm text-foreground break-words whitespace-pre-wrap">{item.message}</p>
          <p /* Timestamp */ className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString()}</p>
        </div>
      </motion.div>
    ))}
  </TabsContent>

  // Sources Tab Content
  <TabsContent value="sources">
    {/* Maps sources array to styled divs (cards) with clickable links */}
    {sources.map((source, index) => (
      <motion.div key={index} className="flex flex-col gap-1 p-2 border-b last:border-b-0" /* Animation props */>
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline break-words">{source.title}</a>
        <div className="flex items-center gap-2">
            <div /* Hostname */ className="text-xs text-muted-foreground truncate">{new URL(source.url).hostname}</div>
            {/* Optional: Relevance score could be added here */}
        </div>
      </motion.div>
    ))}
  </TabsContent>
}
```

### Message Processing (`components/message.tsx`)

-   The `PurePreviewMessage` component (part of the chat message display) uses a `useEffect` hook to listen for and process `message.toolInvocations` containing the streamed data from the backend's `deepResearch` tool.
-   It filters for invocations named `deepResearch`.
-   Parses the `args` (which contain the JSON payload like `{ type: 'activity-delta', content: {...} }`).
-   Based on the `type`, it calls the appropriate state update functions from the `useDeepResearch` context (e.g., `addActivity`, `addSource`, `setDepth`). This ensures the `DeepResearch` panel updates in real-time.
-   Crucially, it also renders the **`DeepResearchProgress` component** within the message bubble itself when a deep research operation is active for that message. This component typically shows:
    -   An overall progress bar (`Progress` from shadcn/ui).
    -   The percentage completion (`Math.round(progress)`).
    -   The last activity message (`lastActivity`).
    -   Estimated time until timeout.

```typescript
// components/message.tsx
useEffect(() => {
  // ... processes message.toolInvocations ...
  // ... calls addActivity, addSource etc. based on parsed data ...
}, [/* ... dependencies ... */]);

// ... inside the return statement for the message component ...
{isDeepResearchInProgress && (
  <DeepResearchProgress
    state={/* Current state string */}
    activity={/* Relevant activity for this message */}
  />
)}
// ... rest of message content ...


// Definition for DeepResearchProgress (simplified)
const DeepResearchProgress = ({ state, activity }) => {
  const { state: deepResearchState } = useDeepResearch();
  // ... calculate progress, time remaining, last activity message ...
  return (
    <div className="w-full space-y-2">
      {/* ... display labels, progress %, time ... */}
      <Progress value={progress} />
      <div className="text-xs text-muted-foreground">{lastActivity}</div>
    </div>
  );
};

```

### Activation (`components/multimodal-input.tsx`)

-   The chat input area (`multimodal-input.tsx`) provides the **user interface control** to switch between standard search and deep research mode before sending a message.
-   This is likely implemented using `Tabs` with `TabsTrigger` components, possibly labeled "Search" (with a `Search` icon) and "Deep Research" (with a `Telescope` icon).
-   Selecting the "Deep Research" tab sets a local state variable (`searchMode`).
-   When the message is sent (`sendMessage` function), this state is checked, and if `searchMode === 'deep-research'`, the `experimental_deepResearch: true` flag is added to the `ChatRequestOptions` payload sent to the backend API. This flag signals the backend to activate the `deepResearch` tool.

```typescript
// components/multimodal-input.tsx (Conceptual)
const [searchMode, setSearchMode] = useState<SearchMode>('search');

// ... JSX for Tabs/TabsTrigger to switch searchMode ...
<Tabs defaultValue="search" onValueChange={(value) => setSearchMode(value as SearchMode)}>
  <TabsList>
    <TabsTrigger value="search"><Search className="size-4" /> Search</TabsTrigger>
    <TabsTrigger value="deep-research"><Telescope className="size-4" /> Deep Research</TabsTrigger>
  </TabsList>
</Tabs>

const sendMessage = (/* ... */) => {
  const options: ChatRequestOptions = {};
  if (searchMode === 'deep-research') {
    options.experimental_deepResearch = true; // Enable the backend tool
  }
  // ... append(message, options) ...
};
```

This setup provides a real-time view of the AI agent's research process, including its actions (searching, extracting, analyzing) and the web sources it discovers. 