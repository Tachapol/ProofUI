export const VIEWPORT_PRESETS = {
  desktop: {
    id: "desktop",
    name: "Desktop",
    width: 1440,
    label: "1440px",
  },
  tablet: {
    id: "tablet",
    name: "Tablet",
    width: 768,
    label: "768px",
  },
  mobile: {
    id: "mobile",
    name: "Mobile",
    width: 390,
    label: "390px",
  },
} as const;

export type ViewportMode = keyof typeof VIEWPORT_PRESETS;

export const EDITOR_CONFIG = {
  MAX_HISTORY_ENTRIES: 100,
  TEXT_DEBOUNCE_MS: 300,
  AUTOSAVE_DEBOUNCE_MS: 800,
  STORAGE_KEY: "proof_ui_document_v2",
  STORAGE_VERSION: 2,
} as const;
