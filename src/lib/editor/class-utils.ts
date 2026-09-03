export type ClassCategory =
  | "display"
  | "items"
  | "justify"
  | "textSize"
  | "textAlign"
  | "fontWeight"
  | "borderRadius"
  | "paddingAll"
  | "paddingX"
  | "paddingY"
  | "marginAll"
  | "gapAll"
  | "textColor"
  | "bgColor";

const DISPLAY_CLASSES = new Set([
  "block",
  "inline-block",
  "inline",
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
  "hidden",
]);

const ITEMS_CLASSES = new Set([
  "items-start",
  "items-end",
  "items-center",
  "items-baseline",
  "items-stretch",
]);

const JUSTIFY_CLASSES = new Set([
  "justify-start",
  "justify-end",
  "justify-center",
  "justify-between",
  "justify-around",
  "justify-evenly",
]);

const TEXT_ALIGN_CLASSES = new Set([
  "text-left",
  "text-center",
  "text-right",
  "text-justify",
]);

const TEXT_SIZE_REGEX = /^text-(xs|sm|base|lg|xl|[2-9]xl)$/;
const FONT_WEIGHT_REGEX = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
const ROUNDED_REGEX = /^rounded(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?$/;
const PADDING_ALL_REGEX = /^p-\d+$/;
const PADDING_X_REGEX = /^px-\d+$/;
const PADDING_Y_REGEX = /^py-\d+$/;
const MARGIN_ALL_REGEX = /^m-\d+$/;
const GAP_ALL_REGEX = /^gap-\d+$/;

const COLOR_NAMES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent";
const TEXT_COLOR_REGEX = new RegExp(`^text-(${COLOR_NAMES})(-\\d+)?$`);
const BG_COLOR_REGEX = new RegExp(`^bg-(${COLOR_NAMES})(-\\d+)?$`);

/**
 * Checks whether a class token contains a modifier/variant prefix (e.g. md: or hover:).
 */
export function hasVariantPrefix(className: string): boolean {
  return className.includes(":");
}

/**
 * Determines whether an unprefixed class belongs to a specific Tailwind category.
 */
export function matchesCategory(className: string, category: ClassCategory): boolean {
  if (hasVariantPrefix(className)) {
    return false;
  }

  switch (category) {
    case "display":
      return DISPLAY_CLASSES.has(className);
    case "items":
      return ITEMS_CLASSES.has(className);
    case "justify":
      return JUSTIFY_CLASSES.has(className);
    case "textAlign":
      return TEXT_ALIGN_CLASSES.has(className);
    case "textSize":
      return TEXT_SIZE_REGEX.test(className);
    case "fontWeight":
      return FONT_WEIGHT_REGEX.test(className);
    case "borderRadius":
      return ROUNDED_REGEX.test(className);
    case "paddingAll":
      return PADDING_ALL_REGEX.test(className);
    case "paddingX":
      return PADDING_X_REGEX.test(className);
    case "paddingY":
      return PADDING_Y_REGEX.test(className);
    case "marginAll":
      return MARGIN_ALL_REGEX.test(className);
    case "gapAll":
      return GAP_ALL_REGEX.test(className);
    case "textColor":
      return TEXT_COLOR_REGEX.test(className);
    case "bgColor":
      return BG_COLOR_REGEX.test(className);
    default:
      return false;
  }
}

/**
 * Resolves adding a new class in a category by identifying and removing conflicting base classes.
 * Preserves all variant-prefixed classes (e.g., md:p-8, hover:bg-black) and unrelated utilities.
 */
export function resolveClassChange(
  currentClasses: string[],
  newClass: string | null,
  category: ClassCategory
): { add: string[]; remove: string[] } {
  const conflicting = currentClasses.filter((c) => matchesCategory(c, category));
  const remove = conflicting;
  const add = newClass ? [newClass] : [];

  return { add, remove };
}

/**
 * Parses, trims, and deduplicates a space-separated class string.
 * Preserves custom and arbitrary-value classes (e.g., blur-[120px], w-[350px]).
 */
export function parseClassList(classString: string): string[] {
  if (!classString) return [];
  const parts = classString.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p);
      result.push(p);
    }
  }
  return result;
}

/**
 * Finds the active class for a category from an array of classes.
 */
export function getActiveClassForCategory(
  classes: string[],
  category: ClassCategory
): string | null {
  for (const c of classes) {
    if (matchesCategory(c, category)) {
      return c;
    }
  }
  return null;
}
