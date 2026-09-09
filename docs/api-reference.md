# API Reference

All backend API routes in ProofUI are implemented using Next.js App Router route handlers (`src/app/api/`).

---

## 1. AI Generation & Editing

### `POST /api/ai/generate`
Generates a new page or new version of a page using the configured AI provider. Supports Server-Sent Events (SSE).

**Request Body:**
```json
{
  "requestId": "req_123456",
  "conversationId": "conv_123456",
  "provider": "vertex" | "qwen" | "gemini" | "mock",
  "instruction": "Add a pricing table with 3 tiers",
  "scope": "new_page" | "new_version",
  "basedOnRevision": 1,
  "attachmentIds": [],
  "context": {
    "currentHtml": "<!DOCTYPE html>...",
    "selectedElementId": "node_abc123"
  }
}
```

**SSE Events Streamed:**
- `status`: `{ "stage": "Preparing context" | "Generating with AI" | ... }`
- `result`: Full `PageGenerationResult` object (containing `html`, `summary`, `warnings`, `usage`).
- `error`: Error details if generation fails.

---

### `POST /api/ai/edit`
Applies fine-grained edits or localized changes to a selected HTML element or section.

---

## 2. UX Optimization & Analysis

### `POST /api/optimization/analyze`
Analyzes an HTML page for UX issues, accessibility concerns, and conversion optimization opportunities.

**Request Body:**
```json
{
  "html": "<!DOCTYPE html>...",
  "viewport": "desktop" | "tablet" | "mobile",
  "evidence": { ... }
}
```

**Response:**
Returns a list of structured recommendations, overall UX score, categorized metrics (Hierarchy, Copywriting, Visual Balance, CTA Effectiveness), and actionable suggestions.

---

### `POST /api/optimization/optimize`
Generates an optimized HTML variant by applying specific UX recommendations selected by the user.

---

## 3. Experimentation & A/B Testing

### `POST /api/experiment`
Creates a new A/B experiment comparing two revisions.

### `GET /api/experiment/[id]`
Retrieves current experiment metrics, variant conversion rates, and statistical significance status.

### `POST /api/experiment/[id]/promote`
Promotes a winning variant as the new base version and archives the experiment.

---

## 4. Production Evidence & Telemetry

### `POST /api/production/telemetry`
Ingests client session events, click data, viewport dimensions, and scroll metrics.

### `GET /api/production/evidence`
Fetches aggregated interaction evidence, heatmap points, and session summaries for the active project.

### `POST /api/production/publish`
Publishes a revision to the live preview/production environment.

---

## 5. Website Importer

### `POST /api/imports`
Initiates an import job for an external URL.

### `GET /api/imports/[id]`
Polls the status of an ongoing import job and retrieves extracted design tokens and HTML.

### `POST /api/imports/[id]/commit`
Commits the imported website into the ProofUI editor as a new working document.
