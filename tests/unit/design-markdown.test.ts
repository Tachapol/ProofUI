import { describe, it, expect } from "vitest";
import yaml from "yaml";
import { DeterministicDesignMarkdownGenerator } from "../../src/lib/import/design-markdown-generator";

describe("Deterministic DESIGN.md Generator", () => {
  const sampleInput = {
    title: "Test Platform Landing Page",
    sourceUrl: "https://acme.test/landing",
    capturedAt: "2026-09-03T12:00:00.000Z",
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    tokens: {
      colors: {
        primary: {
          value: "rgb(37, 99, 235)",
          frequency: 3,
          sampleNodeIds: ["btn_1"],
          confidence: 0.9,
          evidence: ["Button style"],
        },
        background: {
          value: "rgb(255, 255, 255)",
          frequency: 1,
          sampleNodeIds: ["body"],
          confidence: 0.95,
          evidence: ["Body background"],
        },
        surface: {
          value: "rgb(244, 244, 245)",
          frequency: 4,
          sampleNodeIds: ["card_1"],
          confidence: 0.85,
          evidence: ["Card fill"],
        },
        textPrimary: {
          value: "rgb(9, 9, 11)",
          frequency: 12,
          sampleNodeIds: ["h1"],
          confidence: 0.95,
          evidence: ["Heading color"],
        },
        allSampled: [],
      },
      typography: {
        fontFamilies: [
          {
            value: "system-ui",
            frequency: 15,
            sampleNodeIds: [],
            confidence: 0.9,
            evidence: [],
          },
        ],
        fontSizeScale: [
          { value: "14px", frequency: 5, sampleNodeIds: [], confidence: 0.8, evidence: [] },
          { value: "18px", frequency: 2, sampleNodeIds: [], confidence: 0.8, evidence: [] },
          { value: "48px", frequency: 1, sampleNodeIds: [], confidence: 0.9, evidence: [] },
        ],
        fontWeights: [
          { value: "400", frequency: 10, sampleNodeIds: [], confidence: 0.8, evidence: [] },
          { value: "700", frequency: 3, sampleNodeIds: [], confidence: 0.9, evidence: [] },
        ],
        lineHeights: [],
      },
      spacing: {
        paddingScale: [
          { value: "16px", frequency: 4, sampleNodeIds: [], confidence: 0.8, evidence: [] },
          { value: "24px", frequency: 3, sampleNodeIds: [], confidence: 0.8, evidence: [] },
        ],
        gapScale: [
          { value: "24px", frequency: 2, sampleNodeIds: [], confidence: 0.85, evidence: [] },
        ],
        containerWidths: [
          { value: "1440px", frequency: 1, sampleNodeIds: [], confidence: 0.9, evidence: [] },
        ],
      },
      radii: [
        { value: "8px", frequency: 2, sampleNodeIds: [], confidence: 0.85, evidence: [] },
        { value: "12px", frequency: 3, sampleNodeIds: [], confidence: 0.85, evidence: [] },
      ],
      shadows: [],
    },
    structure: {
      root: {
        captureId: "root",
        tagName: "body",
        attributes: {},
        visibility: "visible" as const,
        children: [],
      },
      totalNodeCount: 42,
      maxDepth: 6,
      headings: [{ level: 1, text: "Scale Your Workflows", captureId: "h1_1" }],
      landmarks: [{ tag: "header", captureId: "hdr" }, { tag: "main", captureId: "mn" }],
    },
    components: [
      {
        kind: "Header",
        captureNodeId: "hdr",
        confidence: 0.95,
        evidence: ["Semantic <header> tag"],
      },
      {
        kind: "Hero",
        captureNodeId: "hero_sec",
        confidence: 0.9,
        evidence: ["Top section with H1"],
      },
    ],
    motion: [],
    accessibility: [
      {
        observation: "Document has exactly one primary <h1> element.",
        type: "positive" as const,
        confidence: 0.98,
        evidence: ["Single H1 found"],
      },
    ],
    assets: [
      {
        id: "asset_1",
        originalUrl: "/logo.png",
        normalizedUrl: "https://acme.test/logo.png",
        type: "image" as const,
        sourceContext: "img[src]" as const,
        downloadable: true,
      },
    ],
    evidence: [
      {
        id: "ev_1",
        category: "structure" as const,
        source: "dom" as const,
        description: "Semantic DOM extracted",
        confidence: 0.95,
      },
    ],
  };

  it("generates valid YAML frontmatter and standard markdown sections", async () => {
    const generator = new DeterministicDesignMarkdownGenerator();
    const result = await generator.generate(sampleInput);

    expect(result.startsWith("---\n")).toBe(true);

    // Split YAML frontmatter and Markdown body
    const parts = result.split("---\n");
    expect(parts.length).toBeGreaterThanOrEqual(3);

    const yamlContent = parts[1];
    const parsedYaml = yaml.parse(yamlContent);

    expect(parsedYaml.version).toBe("1.0");
    expect(parsedYaml.provenance.sourceUrl).toBe("https://acme.test/landing");
    expect(parsedYaml.designTokens.colors.primary).toBe("rgb(37, 99, 235)");
    expect(parsedYaml.designTokens.typography.fontFamilies).toContain("system-ui");
    expect(parsedYaml.components[0].kind).toBe("Header");

    // Check Markdown body sections
    const markdown = parts.slice(2).join("---\n");
    expect(markdown).toContain("# Design System Specification: Test Platform Landing Page");
    expect(markdown).toContain("## 1. Overview");
    expect(markdown).toContain("## 3. Colors");
    expect(markdown).toContain("## 4. Typography");
    expect(markdown).toContain("## 8. Components");
    expect(markdown).toContain("## 12. Do's and Don'ts");
    expect(markdown).toContain("## 13. Extraction Limitations");
    expect(markdown).toContain("[Observed]");
    expect(markdown).toContain("[Inferred]");
  });
});
