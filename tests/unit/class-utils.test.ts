import { describe, it, expect } from "vitest";
import {
  parseClassList,
  resolveClassChange,
  matchesCategory,
  getActiveClassForCategory,
} from "../../src/lib/editor/class-utils";

describe("Tailwind Class Utilities & Conflict Resolution", () => {
  it("parses, trims, and deduplicates classes preserving custom and arbitrary values", () => {
    const raw = "  text-4xl   font-bold  text-4xl   blur-[120px]  w-[350px]  ";
    const parsed = parseClassList(raw);

    expect(parsed).toEqual(["text-4xl", "font-bold", "blur-[120px]", "w-[350px]"]);
  });

  it("identifies category matches accurately", () => {
    // Text size vs Text color vs Text align
    expect(matchesCategory("text-4xl", "textSize")).toBe(true);
    expect(matchesCategory("text-center", "textSize")).toBe(false);
    expect(matchesCategory("text-indigo-400", "textSize")).toBe(false);

    expect(matchesCategory("text-center", "textAlign")).toBe(true);
    expect(matchesCategory("text-indigo-400", "textColor")).toBe(true);
    expect(matchesCategory("text-4xl", "textColor")).toBe(false);

    // Display vs Justify vs Items
    expect(matchesCategory("flex", "display")).toBe(true);
    expect(matchesCategory("items-center", "items")).toBe(true);
    expect(matchesCategory("justify-between", "justify")).toBe(true);

    // Padding
    expect(matchesCategory("p-4", "paddingAll")).toBe(true);
    expect(matchesCategory("px-4", "paddingAll")).toBe(false);
    expect(matchesCategory("px-4", "paddingX")).toBe(true);
  });

  it("never treats variant or prefixed classes as base category matches", () => {
    expect(matchesCategory("md:p-8", "paddingAll")).toBe(false);
    expect(matchesCategory("hover:text-white", "textColor")).toBe(false);
    expect(matchesCategory("lg:text-7xl", "textSize")).toBe(false);
    expect(matchesCategory("dark:bg-black", "bgColor")).toBe(false);
  });

  it("resolves class conflicts by removing only conflicting group classes and preserving variants", () => {
    const initialClasses = [
      "text-4xl",
      "font-bold",
      "text-center",
      "text-slate-100",
      "md:text-7xl",
      "hover:text-indigo-400",
    ];

    // Change text size from text-4xl to text-6xl
    const { add, remove } = resolveClassChange(initialClasses, "text-6xl", "textSize");

    expect(remove).toEqual(["text-4xl"]);
    expect(add).toEqual(["text-6xl"]);

    // If we apply this add & remove:
    const updated = initialClasses.filter((c) => !remove.includes(c)).concat(add);
    expect(updated).toContain("text-6xl");
    expect(updated).not.toContain("text-4xl");
    expect(updated).toContain("font-bold");
    expect(updated).toContain("text-center");
    expect(updated).toContain("text-slate-100");
    expect(updated).toContain("md:text-7xl"); // Preserved!
    expect(updated).toContain("hover:text-indigo-400"); // Preserved!
  });

  it("finds active class for category correctly", () => {
    const classes = ["p-6", "m-4", "flex", "items-center", "rounded-xl"];

    expect(getActiveClassForCategory(classes, "display")).toBe("flex");
    expect(getActiveClassForCategory(classes, "paddingAll")).toBe("p-6");
    expect(getActiveClassForCategory(classes, "borderRadius")).toBe("rounded-xl");
    expect(getActiveClassForCategory(classes, "textSize")).toBeNull();
  });
});
