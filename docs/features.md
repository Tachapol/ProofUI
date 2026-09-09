# Features & Core Modules

ProofUI combines visual no-code/low-code editing with intelligent generative AI and data-driven UX analysis.

---

## 1. Visual Viewport & Frame Resizing

- **Preset Modes**:
  - **Desktop**: `1440 × 1024 px` (Standard Figma Artboard & Web viewport)
  - **Tablet**: `768 × 1024 px` (iPad portrait standard)
  - **Mobile**: `390 × 844 px` (iPhone 14/15/16 standard)
- **Pixel-level Customization**:
  - Direct width and height numeric inputs in the top toolbar.
  - Stepper buttons (`+` and `-`) for 1px granular fine-tuning.
  - Interactive drag-handles along the canvas border for fluid resizing.
  - One-click reset back to standard preset dimensions.
  - State persistence in `localStorage` under `proof_ui_frame_dimensions_v1`.

---

## 2. In-Canvas Element Selection & Live Editing

- **Bridge Integration**:
  - Hover highlights and click-to-select on any element inside the canvas.
  - Breadcrumb navigation showing element ancestry (`body > main > section > div > button`).
  - Inline contentEditable text editing with changes synced back to document state.
- **Style Inspector Panel**:
  - Visual controls for Tailwind typography, colors, padding, margin, flexbox/grid layout, and borders.
  - Direct Tailwind CSS class editor.

---

## 3. Code Editor & Diff Review

- **Monaco Code Editor**:
  - Embedded full-fidelity Monaco code editor for inspecting and editing the raw HTML/Tailwind markup.
  - Two-way binding: Code changes reflect immediately on the visual canvas.
- **Review & Diff Mode**:
  - Visual side-by-side or unified diff before accepting AI-generated revisions or rollbacks.

---

## 4. UX Analyzer & Optimization Engine

- Analyzes the current page structure, visual hierarchy, mobile readability, CTA accessibility, and conversion best practices.
- Generates categorized suggestions:
  - **Accessibility (a11y)**: Contrast, font sizes, button tap targets.
  - **Conversion / CTA**: Button placement, visual prominence, value proposition clarity.
  - **Performance / Layout**: Clutter reduction, whitespace balance.
- One-click "Apply Optimization" to automatically dispatch an AI revision resolving identified UX flaws.

---

## 5. Production Evidence & Heatmaps

- Tracks real-world or simulated user engagement:
  - Total sessions, conversion rate, bounce rate, average session duration.
  - Click distribution heatmaps plotted directly over canvas elements.
  - Viewport distribution analytics (Desktop vs. Tablet vs. Mobile traffic).
  - Scroll depth tracking.

---

## 6. A/B Experimentation Engine

- **Variant Creation**: Fork any revision into an A/B test variant (`Variant A (Control)` vs `Variant B (Challenger)`).
- **Traffic Splitting**: Assign percentage traffic splits between versions.
- **Statistical Significance**: Computes conversion difference and p-values to declare winning variants.
- **One-Click Promotion**: Promote the winning variant as the new production release.

---

## 7. Website Importer

- Import any external website by URL.
- Extracts DOM structure, extracts design tokens (colors, font families, spacings), and converts them into editable ProofUI documents.
