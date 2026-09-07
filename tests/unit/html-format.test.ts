import { describe, expect, it } from "vitest";
import { formatHtml } from "../../src/lib/code/html-format";

describe("formatHtml", () => {
  it("formats compact HTML into an indented, readable document", () => {
    const formatted = formatHtml(
      '<!DOCTYPE html><html lang="en"><head><title>Demo</title></head><body><main data-editor-id="main"><h1>Hello</h1><p>Readable source</p></main></body></html>'
    );

    expect(formatted).toContain("<!DOCTYPE html>");
    expect(formatted).toContain('  <body>');
    expect(formatted).toContain('    <main data-editor-id="main">');
    expect(formatted).toContain("      <h1>");
    expect(formatted).toContain("Hello");
  });

  it("preserves executable text as text without executing it", () => {
    const formatted = formatHtml(
      '<html><head><script>window.example = "value";</script></head><body><pre>  preserve\n spacing</pre></body></html>'
    );

    expect(formatted).toContain('window.example = "value";');
    expect(formatted).toContain("  preserve\n spacing");
  });
});
