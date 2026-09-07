import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";

interface UseResizablePanelOptions {
  storageKey?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  defaultCollapsed?: boolean;
  side?: "left" | "right";
}

/**
 * Read a localStorage value hydration-safely using useSyncExternalStore.
 * Returns serverDefault during SSR and the stored value on the client.
 */
function useStorageValue<T>(
  key: string,
  serverDefault: T,
  parse: (raw: string) => T | undefined
): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key) onStoreChange();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key]
  );

  const getSnapshot = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = parse(raw);
        if (parsed !== undefined) return parsed;
      }
    } catch {}
    return serverDefault;
  }, [key, serverDefault, parse]);

  const getServerSnapshot = useCallback(() => serverDefault, [serverDefault]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useResizablePanel({
  storageKey = "proof_ui_chat_sidebar_width",
  defaultWidth = 380,
  minWidth = 320,
  maxWidth = 520,
  defaultCollapsed = false,
  side = "left",
}: UseResizablePanelOptions = {}) {
  const parseWidth = useCallback(
    (raw: string) => {
      const n = parseInt(raw, 10);
      return !isNaN(n) && n >= minWidth && n <= maxWidth ? n : undefined;
    },
    [minWidth, maxWidth]
  );

  const parseCollapsed = useCallback(
    (raw: string) => (raw === "true" ? true : raw === "false" ? false : undefined),
    []
  );

  const storedWidth = useStorageValue(storageKey, defaultWidth, parseWidth);
  const storedCollapsed = useStorageValue(
    `${storageKey}_collapsed`,
    defaultCollapsed,
    parseCollapsed
  );

  const [width, setWidth] = useState<number>(storedWidth);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(storedCollapsed);

  const isDraggingRef = useRef(false);

  const notifyResize = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("resize"));
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      // Disable iframe pointer events during drag so parent window continues receiving mousemove
      const iframes = document.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        (iframe as HTMLElement).style.pointerEvents = "none";
      });

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta =
          side === "right"
            ? startX - moveEvent.clientX
            : moveEvent.clientX - startX;
        const newWidth = Math.min(
          maxWidth,
          Math.max(minWidth, startWidth + delta)
        );
        setWidth(newWidth);
        notifyResize();
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        iframes.forEach((iframe) => {
          (iframe as HTMLElement).style.pointerEvents = "";
        });
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        notifyResize();
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [width, side, minWidth, maxWidth, notifyResize]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let delta = 0;
      if (side === "right") {
        if (e.key === "ArrowLeft") delta = 10;
        if (e.key === "ArrowRight") delta = -10;
      } else {
        if (e.key === "ArrowLeft") delta = -10;
        if (e.key === "ArrowRight") delta = 10;
      }
      if (e.key === "Home") setWidth(minWidth);
      if (e.key === "End") setWidth(maxWidth);

      if (delta !== 0) {
        e.preventDefault();
        setWidth((prev) => Math.min(maxWidth, Math.max(minWidth, prev + delta)));
        notifyResize();
      }
    },
    [side, minWidth, maxWidth, notifyResize]
  );

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(`${storageKey}_collapsed`, String(next));
        } catch {}
      }
      setTimeout(notifyResize, 50);
      return next;
    });
  }, [storageKey, notifyResize]);

  // Save width changes to storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKey, String(width));
      } catch {}
    }
  }, [width, storageKey]);

  return {
    width,
    setWidth,
    isCollapsed,
    setIsCollapsed,
    toggleCollapse,
    handleMouseDown,
    handleKeyDown,
  };
}
