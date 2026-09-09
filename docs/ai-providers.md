# AI Providers & Generation Pipeline

ProofUI supports multiple AI providers using a unified `PageGenerationProvider` interface, allowing seamless switching between local testing, OpenAI-compatible models, and Google Cloud Vertex AI / Gemini.

---

## 1. Supported Providers

| Provider ID | Implementation | Authentication / Setup | Best For |
| :--- | :--- | :--- | :--- |
| `vertex` | `VertexGeminiPageGenerationProvider` | Google Cloud ADC (`gcloud auth application-default login`) | Production Google Cloud deployments & enterprise Vertex AI quota |
| `gemini` | `GeminiPageGenerationProvider` | `GEMINI_API_KEY` (Direct Google AI Studio) | Quick prototyping with Google Gemini without GCP setup |
| `qwen` | `QwenPageGenerationProvider` | `AI_API_KEY` + `AI_BASE_URL` (OpenAI format) | Self-hosted or third-party OpenAI-compatible gateways (Qwen 2.5 / 3.8) |
| `mock` | `MockPageGenerationProvider` | None (Deterministic local template) | CI/CD pipelines, offline work, and regression testing |

---

## 2. Configuration (`.env.local`)

### A. Google Cloud Vertex AI (Recommended for GCP users)
```env
AI_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
VERTEX_AI_MODEL=gemini-2.5-flash
```
*Note: Make sure to log in locally with `gcloud auth application-default login`.*

### B. Google Gemini API (Direct API Key)
```env
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=your-api-key-here
```

### C. OpenAI-Compatible Qwen Gateway
```env
AI_PROVIDER=qwen
AI_BASE_URL=https://gateway.example.com/v1
AI_MODEL=qwen3.8-27b-fp8
AI_API_KEY=your-api-key-here
```

### D. Mock Provider (Default fallback)
```env
AI_PROVIDER=mock
```

---

## 3. The Generation Lifecycle

1. **Request Received (`/api/ai/generate`)**:
   - Accepts prompt instruction, scope (`new_page` or `new_version`), base revision, optional screenshots, and element context.
2. **Context Normalization (`source-precedence.ts` & `qwen-context-builder.ts`)**:
   - Assembles system prompt, formatting requirements (Tailwind CSS CDN, Lucide icons), and prior HTML state.
3. **Model Generation & SSE Stream**:
   - Streams progress events: `Preparing context` → `Generating with AI` → `Validating HTML` → `Ready for review`.
4. **Validation & Sanitization (`sanitizer.ts`)**:
   - Parses the model JSON response via Zod.
   - Cleans risky tags/scripts while preserving valid styling and semantic markup.
   - Automatically injects unique `data-editor-id="node_..."` attributes on all elements to ensure reliable click/hover targeting in the canvas.
