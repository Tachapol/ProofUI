export const VIEWPORT_PRESETS = {
  desktop: {
    id: "desktop",
    name: "Desktop",
    width: 1440,
    height: 1024,
    label: "1440×1024",
  },
  tablet: {
    id: "tablet",
    name: "Tablet",
    width: 768,
    height: 1024,
    label: "768×1024",
  },
  mobile: {
    id: "mobile",
    name: "Mobile",
    width: 390,
    height: 844,
    label: "390×844",
  },
} as const;

export type ViewportMode = keyof typeof VIEWPORT_PRESETS;

export const FRAME_DIMENSIONS_STORAGE_KEY = "proof_ui_frame_dimensions_v1";

export const EDITOR_CONFIG = {
  MAX_HISTORY_ENTRIES: 100,
  TEXT_DEBOUNCE_MS: 300,
  AUTOSAVE_DEBOUNCE_MS: 800,
  STORAGE_KEY: "proof_ui_document_v2",
  STORAGE_VERSION: 2,
} as const;
