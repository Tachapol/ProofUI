---
version: "1.0"
provenance:
  sourceUrl: http://localhost:3000/api/fixtures/landing-page
  title: Acme Cloud Platform
  capturedAt: 2026-09-03T09:08:12.279Z
  viewport: 1440x900@1x
designTokens:
  colors:
    primary: rgb(37, 99, 235)
    secondary: rgb(244, 244, 245)
    background: rgb(255, 255, 255)
    surface: rgb(244, 244, 245)
    textPrimary: rgb(9, 9, 11)
    textMuted: rgb(113, 113, 122)
    border: rgb(9, 9, 11)
  typography:
    fontFamilies:
      - system-ui
      - Arial
    fontSizeScale:
      - 14px
      - 16px
      - 18px
      - 18.72px
      - 48px
    fontWeights:
      - "400"
      - "600"
      - "700"
      - "800"
  spacing:
    paddingScale:
      - 24px
      - 16px
      - 32px
      - 64px
      - 0px
      - 12px
    gapScale:
      - 24px
    containerWidths:
      - 1440px
  radii:
    - 12px
    - 8px
  shadows: []
components:
  - kind: Header
    confidence: 0.95
  - kind: Navigation
    confidence: 0.95
  - kind: Pricing Section
    confidence: 0.85
  - kind: Hero
    confidence: 0.88
  - kind: Call To Action
    confidence: 0.9
  - kind: Feature Grid
    confidence: 0.82
  - kind: Footer
    confidence: 0.98
---

# Design System Specification: Acme Cloud Platform

> **Note**: This design specification was deterministically extracted from static browser capture evidence.
> Statements marked **[Observed]** reflect direct computed properties; **[Inferred]** statements represent structural heuristics.

---

## 1. Overview
- **Source URL**: [http://localhost:3000/api/fixtures/landing-page](http://localhost:3000/api/fixtures/landing-page)
- **Captured At**: 2026-09-03T09:08:12.279Z
- **Viewport**: 1440px × 900px (Scale Factor: 1)
- **DOM Hierarchy**: 25 semantic elements, maximum tree depth 32

---

## 2. Evidence Summary
- **[STRUCTURE]**: Extracted reduced semantic DOM with 25 nodes and 6 landmarks. *(Confidence: 95%)*
- **[STRUCTURE]**: Discovered 4 headings (H1..H6) in document flow. *(Confidence: 98%)*
- **[STYLE]**: Inferred primary interactive color from button and call-to-action computed styles: rgb(37, 99, 235) *(Confidence: 85%)*
- **[STYLE]**: Observed main page background color: rgb(255, 255, 255) *(Confidence: 95%)*
- **[STRUCTURE]**: Inferred component [Header] with 95% confidence: Semantic <header> HTML tag *(Confidence: 95%)*
- **[STRUCTURE]**: Inferred component [Navigation] with 95% confidence: Semantic <nav> element *(Confidence: 95%)*
- **[STRUCTURE]**: Inferred component [Pricing Section] with 85% confidence: Pricing keywords or plan structures detected *(Confidence: 85%)*
- **[STRUCTURE]**: Inferred component [Hero] with 88% confidence: Class name contains "hero" *(Confidence: 88%)*
- **[STRUCTURE]**: Inferred component [Call To Action] with 90% confidence: Prominent action link or button with text: "Get Started Free" *(Confidence: 90%)*
- **[STRUCTURE]**: Inferred component [Feature Grid] with 82% confidence: Multi-child container with 3 structured card elements *(Confidence: 82%)*

---

## 3. Colors
| Role | Value | Extraction Method | Sample Frequency |
| :--- | :--- | :--- | :--- |
| **Primary** | `rgb(37, 99, 235)` | [Inferred] Button & CTA computed styles | 1 occurrences |
| **Secondary** | `rgb(244, 244, 245)` | [Inferred] Surface & accent fills | 3 occurrences |
| **Background** | `rgb(255, 255, 255)` | [Observed] Direct `<body>` computed background | 1 occurrences |
| **Surface** | `rgb(244, 244, 245)` | [Inferred] Card container background | 3 occurrences |
| **Text Primary** | `rgb(9, 9, 11)` | [Observed] Heading & body computed color | 19 occurrences |
| **Text Muted** | `rgb(113, 113, 122)` | [Inferred] Subtitle & secondary paragraph color | 3 occurrences |
| **Border** | `rgb(9, 9, 11)` | [Observed] Card & container border color | 15 occurrences |

---

## 4. Typography
- **Font Families**:
  - `system-ui` *(Observed 22x)*
  - `Arial` *(Observed 1x)*
- **Type Scale**:
  - `14px`
  - `16px`
  - `18px`
  - `18.72px`
  - `48px`
- **Font Weights**:
  - `400`
  - `600`
  - `700`
  - `800`

---

## 5. Layout & Spacing Rhythm
- **Padding Scale**: `24px`, `16px`, `32px`, `64px`, `0px`, `12px`
- **Gap Scale**: `24px`
- **Container Max Width**: `1440px`

---

## 6. Elevation & Depth
- **Box Shadows**:
  - Flat aesthetic (no prominent box shadows observed)

---

## 7. Shapes & Radii
- **Border Radii**:
  - `12px`
  - `8px`

---

## 8. Components
### Header *(Confidence: 95%)*
- **Evidence**: Semantic <header> HTML tag

### Navigation *(Confidence: 95%)*
- **Evidence**: Semantic <nav> element

### Pricing Section *(Confidence: 85%)*
- **Evidence**: Pricing keywords or plan structures detected

### Hero *(Confidence: 88%)*
- **Evidence**: Class name contains "hero"

### Call To Action *(Confidence: 90%)*
- **Evidence**: Prominent action link or button with text: "Get Started Free"

### Feature Grid *(Confidence: 82%)*
- **Evidence**: Multi-child container with 3 structured card elements

### Footer *(Confidence: 98%)*
- **Evidence**: Semantic <footer> element

---

## 9. Motion
- **[reduced-motion-support]**: prefers-reduced-motion media query supported (Media query (prefers-reduced-motion: reduce) evaluated in browser)

---

## 10. Accessibility Observations
> **Important**: These are static heuristic observations and do not constitute a formal WCAG compliance audit.
- **[POSITIVE]**: Document has exactly one primary <h1> element.
- **[WARNING]**: Heading hierarchy skips levels (e.g. H1 directly to H3 without intermediate H2).
- **[POSITIVE]**: Semantic <main> landmark identified for primary content.
- **[POSITIVE]**: Semantic <nav> navigation landmark present.

---

## 11. Assets Manifest (0 items)
| Type | Context | URL | Downloadable |
| :--- | :--- | :--- | :--- |



---

## 12. Do's and Don'ts
### Do's:
- Maintain the primary button color `rgb(37, 99, 235)` across action prompts.
- Preserve consistent padding scale `(24px, 16px, 32px)` across sections.
- Adhere to the single primary `<h1>` heading hierarchy for optimal document structure.

### Don'ts:
- Do not mix divergent font families without matching contrast.
- Do not execute external third-party scripts or event handlers in ProofUI reconstructions.
- Do not duplicate fixed header elements across responsive breakpoints.

---

## 13. Extraction Limitations
- Dynamic JavaScript application state, client-side routing, and background service workers are intentionally excluded.
- Interactive hover and focus states requiring complex event sequences were not statically executed.
- Authenticated or private content was not captured.
