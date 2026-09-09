# ProofUI ⚡️

ProofUI is an AI-native visual web page editor, experiment runner, and UX optimization platform built with **Next.js 16 (Turbopack)**, **React 19**, **Tailwind CSS v4**, and multimodal LLM providers (**Google Cloud Vertex AI**, **Google Gemini**, and **Qwen**).

It enables developers, designers, and marketers to design, edit, optimize, and A/B test web pages visually with bidirectional AI synchronization and real user interaction telemetry.

---

## ✨ Key Features

- 🎨 **Visual Canvas & Custom Viewports**:
  - Standard presets: **Desktop** (`1440 × 1024`), **Tablet** (`768 × 1024`), **Mobile** (`390 × 844`).
  - Pixel-perfect numeric controls, 1px steppers, and fluid drag-resizing.
- 🤖 **Multimodal AI Generation & Editing**:
  - Generate full pages or local sections via conversational natural language prompts.
  - Streaming generation updates via Server-Sent Events (SSE).
  - Supports **Vertex AI (Gemini 2.5 Flash)** with GCP ADC, **Google Gemini API**, and **OpenAI-compatible Qwen** gateways.
- 🎯 **Direct In-Canvas Manipulation**:
  - Sandboxed iframe bridge (`injected-bridge`) with hover outlines and click selection.
  - Inline contentEditable text editing synced automatically with the document model.
  - Style Inspector for Tailwind typography, spacing, flex/grid layouts, and colors.
- 📊 **UX Analyzer & Automated Recommendations**:
  - Heuristic analysis of page hierarchy, contrast, accessibility, and conversion CTA effectiveness.
  - One-click AI optimization application.
- 🔬 **A/B Testing & Production Evidence**:
  - Fork revisions into control and challenger variants.
  - Track real or simulated sessions, conversion rates, and click heatmaps.
  - Promote winning variants directly to production.
- 🌐 **External Website Importer**:
  - Extract DOM structure and design tokens from any public URL into an editable project.

---

## 🚀 Getting Started

### 1. Installation

```bash
git clone <repo-url>
cd ProofUI
npm install
```

### 2. Environment Configuration

Copy the sample environment file:

```bash
cp .env.example .env.local
```

Configure your preferred AI Provider in `.env.local`:

#### Option A: Google Cloud Vertex AI (Recommended)
```env
AI_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
VERTEX_AI_MODEL=gemini-2.5-flash
```
*Run `gcloud auth application-default login` on your local machine to authenticate.*

#### Option B: Google Gemini API (Direct Key)
```env
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=your-api-key
```

#### Option C: OpenAI-compatible Qwen Gateway
```env
AI_PROVIDER=qwen
AI_BASE_URL=https://gateway.example.com/v1
AI_MODEL=qwen3.8-27b-fp8
AI_API_KEY=your-api-key
```

#### Option D: Deterministic Mock Provider (Zero setup)
```env
AI_PROVIDER=mock
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Detailed Documentation

Comprehensive documentation is available in the [`docs/`](./docs) directory:

- 🏗️ **[Architecture Overview](./docs/architecture.md)** — Bridge protocol, iframe sandbox, and state lifecycle.
- 🧠 **[AI Providers & Generation](./docs/ai-providers.md)** — Provider implementations, context building, and sanitization.
- 🛠️ **[Features & Core Modules](./docs/features.md)** — Canvas resizing, style inspector, UX analyzer, and A/B testing.
- 🔌 **[API Reference](./docs/api-reference.md)** — All REST/SSE endpoints under `/api/*`.
- 🧪 **[Development & Testing Guide](./docs/testing.md)** — Unit testing with Vitest and E2E with Playwright.

---

## 🧪 Testing & Build

```bash
# Run unit tests
npm run test

# Run end-to-end tests
npm run test:e2e

# Run linting
npm run lint

# Build for production
npm run build
```

---

## 🛡️ Security Note

Keep all API keys and credentials server-side. Never expose secrets in client-side code, commit `.env.local` to git, or prefix sensitive keys with `NEXT_PUBLIC_`.
