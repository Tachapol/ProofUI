import yaml from "yaml";
import {
  ExtractedDesignTokens,
  ExtractedStructure,
  ComponentSignal,
  MotionSignal,
  AccessibilitySignal,
  AssetManifestEntry,
  ExtractionEvidence,
} from "./schemas";

export interface DesignMarkdownInput {
  title: string;
  sourceUrl: string;
  capturedAt: string;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  tokens: ExtractedDesignTokens;
  structure: ExtractedStructure;
  components: ComponentSignal[];
  motion: MotionSignal[];
  accessibility: AccessibilitySignal[];
  assets: AssetManifestEntry[];
  evidence: ExtractionEvidence[];
}

export interface DesignMarkdownGenerator {
  generate(input: DesignMarkdownInput): Promise<string>;
}

export class DeterministicDesignMarkdownGenerator implements DesignMarkdownGenerator {
  async generate(input: DesignMarkdownInput): Promise<string> {
    const {
      title,
      sourceUrl,
      capturedAt,
      viewport,
      tokens,
      structure,
      components,
      motion,
      accessibility,
      assets,
      evidence,
    } = input;

    // 1. Layer 1: Machine-Readable YAML Frontmatter
    const frontmatterData = {
      version: "1.0",
      provenance: {
        sourceUrl,
        title,
        capturedAt,
        viewport: `${viewport.width}x${viewport.height}@${viewport.deviceScaleFactor}x`,
      },
      designTokens: {
        colors: {
          primary: tokens.colors.primary?.value ?? null,
          secondary: tokens.colors.secondary?.value ?? null,
          background: tokens.colors.background?.value ?? null,
          surface: tokens.colors.surface?.value ?? null,
          textPrimary: tokens.colors.textPrimary?.value ?? null,
          textMuted: tokens.colors.textMuted?.value ?? null,
          border: tokens.colors.border?.value ?? null,
        },
        typography: {
          fontFamilies: tokens.typography.fontFamilies.map((f) => f.value),
          fontSizeScale: tokens.typography.fontSizeScale.map((s) => s.value),
          fontWeights: tokens.typography.fontWeights.map((w) => w.value),
        },
        spacing: {
          paddingScale: tokens.spacing.paddingScale.map((p) => p.value),
          gapScale: tokens.spacing.gapScale.map((g) => g.value),
          containerWidths: tokens.spacing.containerWidths.map((c) => c.value),
        },
        radii: tokens.radii.map((r) => r.value),
        shadows: tokens.shadows.map((s) => s.value),
      },
      components: components.map((c) => ({
        kind: c.kind,
        confidence: c.confidence,
      })),
    };

    const yamlBlock = yaml.stringify(frontmatterData).trim();

    // 2. Layer 2: Human/LLM-Readable Markdown
    const markdownBody = `# Design System Specification: ${title || "Captured Page"}

> **Note**: This design specification was deterministically extracted from static browser capture evidence.
> Statements marked **[Observed]** reflect direct computed properties; **[Inferred]** statements represent structural heuristics.

---

## 1. Overview
- **Source URL**: [${sourceUrl}](${sourceUrl})
- **Captured At**: ${capturedAt}
- **Viewport**: ${viewport.width}px × ${viewport.height}px (Scale Factor: ${viewport.deviceScaleFactor})
- **DOM Hierarchy**: ${structure.totalNodeCount} semantic elements, maximum tree depth ${structure.maxDepth}

---

## 2. Evidence Summary
${evidence.slice(0, 10).map((ev) => `- **[${ev.category.toUpperCase()}]**: ${ev.description} *(Confidence: ${(ev.confidence * 100).toFixed(0)}%)*`).join("\n")}

---

## 3. Colors
| Role | Value | Extraction Method | Sample Frequency |
| :--- | :--- | :--- | :--- |
| **Primary** | \`${tokens.colors.primary?.value || "Not determined"}\` | [Inferred] Button & CTA computed styles | ${tokens.colors.primary?.frequency || 0} occurrences |
| **Secondary** | \`${tokens.colors.secondary?.value || "Not determined"}\` | [Inferred] Surface & accent fills | ${tokens.colors.secondary?.frequency || 0} occurrences |
| **Background** | \`${tokens.colors.background?.value || "Not determined"}\` | [Observed] Direct \`<body>\` computed background | ${tokens.colors.background?.frequency || 0} occurrences |
| **Surface** | \`${tokens.colors.surface?.value || "Not determined"}\` | [Inferred] Card container background | ${tokens.colors.surface?.frequency || 0} occurrences |
| **Text Primary** | \`${tokens.colors.textPrimary?.value || "Not determined"}\` | [Observed] Heading & body computed color | ${tokens.colors.textPrimary?.frequency || 0} occurrences |
| **Text Muted** | \`${tokens.colors.textMuted?.value || "Not determined"}\` | [Inferred] Subtitle & secondary paragraph color | ${tokens.colors.textMuted?.frequency || 0} occurrences |
| **Border** | \`${tokens.colors.border?.value || "Not determined"}\` | [Observed] Card & container border color | ${tokens.colors.border?.frequency || 0} occurrences |

---

## 4. Typography
- **Font Families**:
${tokens.typography.fontFamilies.length > 0 ? tokens.typography.fontFamilies.map((f) => `  - \`${f.value}\` *(Observed ${f.frequency}x)*`).join("\n") : "  - System default"}
- **Type Scale**:
${tokens.typography.fontSizeScale.length > 0 ? tokens.typography.fontSizeScale.map((s) => `  - \`${s.value}\``).join("\n") : "  - Standard 16px"}
- **Font Weights**:
${tokens.typography.fontWeights.length > 0 ? tokens.typography.fontWeights.map((w) => `  - \`${w.value}\``).join("\n") : "  - 400, 700"}

---

## 5. Layout & Spacing Rhythm
- **Padding Scale**: ${tokens.spacing.paddingScale.map((p) => `\`${p.value}\``).join(", ") || "None"}
- **Gap Scale**: ${tokens.spacing.gapScale.map((g) => `\`${g.value}\``).join(", ") || "None"}
- **Container Max Width**: ${tokens.spacing.containerWidths.map((c) => `\`${c.value}\``).join(", ") || "1440px"}

---

## 6. Elevation & Depth
- **Box Shadows**:
${tokens.shadows.length > 0 ? tokens.shadows.map((s) => `  - \`${s.value}\``).join("\n") : "  - Flat aesthetic (no prominent box shadows observed)"}

---

## 7. Shapes & Radii
- **Border Radii**:
${tokens.radii.length > 0 ? tokens.radii.map((r) => `  - \`${r.value}\``).join("\n") : "  - Square borders (0px)"}

---

## 8. Components
${components.length > 0 ? components.map((c) => `### ${c.kind} *(Confidence: ${(c.confidence * 100).toFixed(0)}%)*\n- **Evidence**: ${c.evidence.join("; ")}`).join("\n\n") : "No discrete standard components identified with high confidence."}

---

## 9. Motion
${motion.length > 0 ? motion.map((m) => `- **[${m.kind}]**: ${m.value || "Present"} (${m.evidence.join("; ")})`).join("\n") : "- No static CSS animations or transitions observed in computed styles."}

---

## 10. Accessibility Observations
> **Important**: These are static heuristic observations and do not constitute a formal WCAG compliance audit.
${accessibility.length > 0 ? accessibility.map((a) => `- **[${a.type.toUpperCase()}]**: ${a.observation}`).join("\n") : "- No accessibility warnings detected."}

---

## 11. Assets Manifest (${assets.length} items)
| Type | Context | URL | Downloadable |
| :--- | :--- | :--- | :--- |
${assets.slice(0, 10).map((a) => `| ${a.type} | \`${a.sourceContext}\` | \`${a.normalizedUrl.slice(0, 50)}...\` | ${a.downloadable ? "Yes" : "Restricted"} |`).join("\n")}
${assets.length > 10 ? `*...and ${assets.length - 10} more assets recorded in manifest.*` : ""}

---

## 12. Do's and Don'ts
### Do's:
- Maintain the primary button color \`${tokens.colors.primary?.value || "accent"}\` across action prompts.
- Preserve consistent padding scale \`(${tokens.spacing.paddingScale.slice(0, 3).map((p) => p.value).join(", ")})\` across sections.
- Adhere to the single primary \`<h1>\` heading hierarchy for optimal document structure.

### Don'ts:
- Do not mix divergent font families without matching contrast.
- Do not execute external third-party scripts or event handlers in ProofUI reconstructions.
- Do not duplicate fixed header elements across responsive breakpoints.

---

## 13. Extraction Limitations
- Dynamic JavaScript application state, client-side routing, and background service workers are intentionally excluded.
- Interactive hover and focus states requiring complex event sequences were not statically executed.
- Authenticated or private content was not captured.
`;

    return `---\n${yamlBlock}\n---\n\n${markdownBody}`;
  }
}
