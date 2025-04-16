# TODO: Remove Deep Research Functionality

**Goal:** Eliminate the "Deep Research" feature entirely from the `dchat1` application.

**Steps:**

1.  **Remove Deep Research Button and Logic from `ChatInput.tsx`**
    *   **File:** `dchat1/components/chat/ChatInput.tsx`
    *   **Actions:**
        *   Delete the `<Button>` component used for toggling deep research (the one with the `<Search>` icon and "Derin araştırma" text).
        *   Remove the `searchActive` state variable (`useState`).
        *   Remove the `toggleDeepSearch` function.
        *   Remove the `useDeepResearch` hook import and usage (`deepResearchState`, `setActive`).
        *   Simplify the `handleSend` function: Remove the `if (searchActive)` block and the `else`. The function should now only call `onSend(message)`.
        *   Simplify the `handleKeyDown` function similarly: Remove the `if (searchActive)` check.
        *   Remove the conditional rendering logic related to `searchActive` for the `textarea` placeholder and className (the `cn()` part checking `searchActive`). Reset the `textarea` className to its default non-search state (`border-blue-200 focus-visible:border-black`).
        *   Remove the conditional rendering logic related to `searchActive` for the submit `<Button>` className. Reset it to its default non-search state (`bg-black hover:bg-gray-800`).
        *   Remove the import and usage of `DeepResearch` and `DeepResearchProgress` components.
        *   Remove the conditional rendering block for the `DeepResearchProgress` and `DeepResearch` components (`{searchActive && deepResearchState.isActive && ...}`).

2.  **Remove Deep Research Handling from API Route**
    *   **File:** `dchat1/app/api/chat/route.ts`
    *   **Actions:**
        *   Remove the import for `deepResearch` from `@/lib/ai/tools`.
        *   In the `generateText` call, remove `deepResearch` from the `tools` object (`tools: { getWeather, getEarthquake, getExchangeRate, getCoin, getStock }`).
        *   In the system prompt (`formattedMessages.unshift({ role: "system", ... })`), remove the instruction related to "Deep research mode is active" and the `deepResearch` tool.
        *   In the response handling section (after `const finalResult = await generateText(...)`), remove the `else if (toolResult.toolName === 'deepResearch')` block.
        *   Remove the check for `response.deep_research_data` when logging the final response structure.

3.  **Remove the Deep Research Tool Definition**
    *   **File:** `dchat1/lib/ai/tools/deep-research.ts`
    *   **Action:** Delete this entire file.

4.  **Update Tool Index**
    *   **File:** `dchat1/lib/ai/tools/index.ts`
    *   **Action:** Remove the line `export { deepResearch } from './deep-research';`.

5.  **Remove Deep Research UI Components**
    *   **File:** `dchat1/components/deep-research.tsx`
    *   **Action:** Delete this entire file.
    *   **File:** `dchat1/components/deep-research-progress.tsx`
    *   **Action:** Delete this entire file.

6.  **Remove Deep Research Context**
    *   **File:** `dchat1/lib/deep-research-context.tsx`
    *   **Action:** Delete this entire file.

7.  **Remove Deep Research Provider from Layout**
    *   **File:** `dchat1/app/layout.tsx`
    *   **Actions:**
        *   Remove the import for `DeepResearchProvider`.
        *   Remove the `<DeepResearchProvider>` wrapper around `{children}`. The return statement should become:
            ```jsx
            <html lang="en">
              <body className={cn(inter.className, inter.variable, "min-h-screen bg-foreground/5")}>
                {children}
              </body>
            </html>
            ```

8.  **Clean Up Dependencies (Optional but Recommended)**
    *   **File:** `dchat1/package.json`
    *   **Action:** Check if `@mendable/firecrawl-js` was *only* used for deep research. If so, remove it from `dependencies`.
    *   **Action:** Run `npm install` or `yarn install` (depending on the package manager used) to update `package-lock.json` or `yarn.lock`.

9.  **Final Check & Testing**
    *   Run the application (`npm run dev` or `yarn dev`).
    *   Verify that the Deep Research button is gone from the chat input.
    *   Verify that there are no errors related to missing components, context, or tools in the browser console or terminal.
    *   Test sending messages to ensure basic chat functionality remains intact.