# ProofUI Documentation

Welcome to the **ProofUI** documentation. ProofUI is an AI-powered visual website editor, experiment runner, and UX optimization engine built with Next.js, React, Tailwind CSS, and multimodal LLM providers.

## 📚 Documentation Index

1. **[Architecture Overview](./architecture.md)**
   - System architecture, data flow, bridge system (`injected-bridge`), and client-server synchronization.
2. **[AI Providers & Generation](./ai-providers.md)**
   - Supported AI providers: Vertex AI (Google Cloud), Google Gemini API, OpenAI-compatible Qwen, and Mock.
   - SSE streaming, prompt context building, HTML sanitization, and `data-editor-id` tagging.
3. **[Features & Core Modules](./features.md)**
   - Visual canvas editor with viewport presets and custom pixel resizing.
   - Live DOM editing, style inspector, and breadcrumbs.
   - UX Analyzer & optimization recommendations.
   - Production evidence, session tracking, and heatmaps.
   - A/B testing & experimentation workflow.
   - Website importer with CSS and token extraction.
4. **[API Reference](./api-reference.md)**
   - Complete documentation of backend API endpoints (`/api/ai/*`, `/api/optimization/*`, `/api/experiment/*`, `/api/production/*`, `/api/imports/*`).
5. **[Development & Testing](./testing.md)**
   - Running local development, environment configurations, unit testing with Vitest, and end-to-end testing with Playwright.
