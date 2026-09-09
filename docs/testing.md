# Development & Testing Guide

This document covers instructions for local development, environment setup, running unit tests, and executing end-to-end tests.

---

## 1. Prerequisites

- **Node.js**: >= 20.0.0 (Node.js 22 LTS recommended)
- **Package Manager**: `npm` (or `pnpm` / `yarn`)
- **Google Cloud SDK** *(optional, for Vertex AI provider)*: `gcloud` CLI

---

## 2. Setup & Installation

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Choose your AI Provider (see [AI Providers](./ai-providers.md) for details). By default, `AI_PROVIDER=mock` requires no API keys or cloud setup.

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Automated Testing

### A. Unit & Integration Tests (Vitest)
ProofUI uses **Vitest** for fast unit and DOM tests.

- Run all unit tests:
  ```bash
  npm run test
  ```
- Run tests in watch mode:
  ```bash
  npm run test:watch
  ```
- Target a specific test file:
  ```bash
  npm run test -- tests/unit/frame-dimensions.test.ts
  ```

### B. End-to-End Tests (Playwright)
ProofUI uses **Playwright** for browser automation, visual regression, and end-to-end user flow testing.

- Run all E2E tests:
  ```bash
  npm run test:e2e
  ```
- Run a specific E2E spec:
  ```bash
  npx playwright test tests/e2e/frame-dimensions.spec.ts
  ```
- Run with UI mode:
  ```bash
  npx playwright test --ui
  ```

---

## 4. Production Build & Linting

Before submitting pull requests or deploying:

1. **Lint code**:
   ```bash
   npm run lint
   ```

2. **Build for production**:
   ```bash
   npm run build
   ```
   Ensures all TypeScript types compile without errors and Next.js static pages optimize correctly.
