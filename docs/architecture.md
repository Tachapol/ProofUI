# Architecture Overview

ProofUI is designed as an interactive visual web editor powered by AI, combining a sandboxed iframe preview canvas with bi-directional postMessage communication and server-side LLM orchestration.

```
┌─────────────────────────────────────────────────────────────┐
│                       ProofUI Shell                         │
│                                                             │
│   ┌───────────────┐   ┌─────────────────────────────────┐   │
│   │  ChatSidebar  │   │        ViewportCanvas           │   │
│   │  (AI Prompt)  │   │  ┌───────────────────────────┐  │   │
│   └───────┬───────┘   │  │ Sandboxed <iframe>        │  │   │
│           │           │  │   injected-bridge.ts      │  │   │
│           ▼           │  └─────────────┬─────────────┘  │   │
│   ┌───────────────┐   └────────────────┼────────────────┘   │
│   │ /api/ai/      │                    │                    │
│   │ generate      │              postMessage                │
│   └───────────────┘                    │                    │
│                                        ▼                    │
│                        ┌────────────────────────────────┐   │
│                        │   Editor Store & Document State│   │
│                        │   - History / Revisions        │   │
│                        │   - Selected Element Node      │   │
│                        │   - UX Evidence & Heatmaps     │   │
│                        └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Editor Shell (`src/components/editor/EditorShell.tsx`)
- Orchestrates the main layout: Top Toolbar, Left Sidebar (AI Chat & History), Center (Canvas), and Right Panels (Style Inspector, Layer Tree, UX Optimization, Production Evidence).
- Manages active document revision state and synchronization with browser local storage (`proof_ui_document_v2`).

### 2. Viewport Canvas & Injected Bridge (`src/components/editor/ViewportCanvas.tsx` & `src/lib/bridge/injected-bridge.ts`)
- Renders the editable HTML document inside a sandboxed `<iframe>`.
- Injects a lightweight bridge script (`injected-bridge.ts`) into the iframe document to:
  - Intercept user clicks and element hovering.
  - Highlight hovered/selected elements with bounding outlines.
  - Provide direct contentEditable text editing inside the frame.
  - Track user interactions (clicks, scrolls, dwell time) and send telemetry back via `postMessage`.
  - Maintain stable element identity using `data-editor-id="node_..."` attributes.

### 3. AI Generation Pipeline (`src/lib/generation/`)
- Handles multimodal prompts (user instructions, current HTML snapshot, screenshot images, style preferences).
- Streams incremental progress updates to the client via Server-Sent Events (SSE).
- Validates LLM responses with Zod schemas, enforces safe HTML sanitization, and injects stable node tracking IDs.

### 4. Production & Analytics Engine (`src/lib/production/`)
- Collects interaction telemetry (viewport breakdown, click heatmaps, scroll depth, conversion rates).
- Aggregates evidence to guide the UX Analyzer and automated A/B experimentation variants.
