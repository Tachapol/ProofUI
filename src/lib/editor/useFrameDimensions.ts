"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  VIEWPORT_PRESETS,
  ViewportMode,
  FRAME_DIMENSIONS_STORAGE_KEY,
} from "./constants";

export type FrameResizeDirection = "right" | "bottom" | "corner";

export interface ViewportDimensions {
  width: number;
  height: number;
}

export type StoredFrameDimensions = Record<ViewportMode, ViewportDimensions>;

const DEFAULT_DIMENSIONS: StoredFrameDimensions = {
  desktop: {
    width: VIEWPORT_PRESETS.desktop.width,
    height: VIEWPORT_PRESETS.desktop.height,
  },
  tablet: {
    width: VIEWPORT_PRESETS.tablet.width,
    height: VIEWPORT_PRESETS.tablet.height,
  },
  mobile: {
    width: VIEWPORT_PRESETS.mobile.width,
    height: VIEWPORT_PRESETS.mobile.height,
  },
};

const MIN_WIDTH = 320;
const MAX_WIDTH = 2560;
const MIN_HEIGHT = 320;
const MAX_HEIGHT = 3000;

export function useFrameDimensions(currentViewport: ViewportMode) {
  // Store dimensions for all viewports so customized values are retained when switching back & forth
  const [dimensions, setDimensions] = useState<StoredFrameDimensions>(() => {
    if (typeof window === "undefined") return DEFAULT_DIMENSIONS;
    try {
      const saved = localStorage.getItem(FRAME_DIMENSIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          desktop: {
            width: Number(parsed.desktop?.width) || DEFAULT_DIMENSIONS.desktop.width,
            height: Number(parsed.desktop?.height) || DEFAULT_DIMENSIONS.desktop.height,
          },
          tablet: {
            width: Number(parsed.tablet?.width) || DEFAULT_DIMENSIONS.tablet.width,
            height: Number(parsed.tablet?.height) || DEFAULT_DIMENSIONS.tablet.height,
          },
          mobile: {
            width: Number(parsed.mobile?.width) || DEFAULT_DIMENSIONS.mobile.width,
            height: Number(parsed.mobile?.height) || DEFAULT_DIMENSIONS.mobile.height,
          },
        };
      }
    } catch {
      // Fall back to default
    }
    return DEFAULT_DIMENSIONS;
  });

  // Current active frame width and height
  const currentDim = dimensions[currentViewport] || DEFAULT_DIMENSIONS[currentViewport];
  const frameWidth = currentDim.width;
  const frameHeight = currentDim.height;

  // Persist to localStorage whenever dimensions change
  useEffect(() => {
    try {
      localStorage.setItem(
        FRAME_DIMENSIONS_STORAGE_KEY,
        JSON.stringify(dimensions)
      );
    } catch {
      // Ignore quota errors
    }
  }, [dimensions]);

  const updateCurrentDimension = useCallback(
    (newDim: Partial<ViewportDimensions>) => {
      setDimensions((prev) => {
        const current = prev[currentViewport] || DEFAULT_DIMENSIONS[currentViewport];
        const nextWidth =
          newDim.width !== undefined
            ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(newDim.width)))
            : current.width;
        const nextHeight =
          newDim.height !== undefined
            ? Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(newDim.height)))
            : current.height;

        return {
          ...prev,
          [currentViewport]: {
            width: nextWidth,
            height: nextHeight,
          },
        };
      });
    },
    [currentViewport]
  );

  const setWidth = useCallback(
    (width: number) => {
      updateCurrentDimension({ width });
    },
    [updateCurrentDimension]
  );

  const setHeight = useCallback(
    (height: number) => {
      updateCurrentDimension({ height });
    },
    [updateCurrentDimension]
  );

  const adjustWidth = useCallback(
    (delta: number) => {
      setDimensions((prev) => {
        const current = prev[currentViewport] || DEFAULT_DIMENSIONS[currentViewport];
        const nextWidth = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, current.width + delta)
        );
        return {
          ...prev,
          [currentViewport]: {
            ...current,
            width: nextWidth,
          },
        };
      });
    },
    [currentViewport]
  );

  const adjustHeight = useCallback(
    (delta: number) => {
      setDimensions((prev) => {
        const current = prev[currentViewport] || DEFAULT_DIMENSIONS[currentViewport];
        const nextHeight = Math.max(
          MIN_HEIGHT,
          Math.min(MAX_HEIGHT, current.height + delta)
        );
        return {
          ...prev,
          [currentViewport]: {
            ...current,
            height: nextHeight,
          },
        };
      });
    },
    [currentViewport]
  );

  const resetFrameSize = useCallback(() => {
    setDimensions((prev) => ({
      ...prev,
      [currentViewport]: {
        width: DEFAULT_DIMENSIONS[currentViewport].width,
        height: DEFAULT_DIMENSIONS[currentViewport].height,
      },
    }));
  }, [currentViewport]);

  // Drag-to-resize support
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<FrameResizeDirection | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    direction: FrameResizeDirection;
  } | null>(null);

  const startResize = useCallback(
    (direction: FrameResizeDirection, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: frameWidth,
        startHeight: frameHeight,
        direction,
      };

      setIsResizing(true);
      setResizeDirection(direction);

      // Disable iframe pointer events during drag to prevent cursor capture
      const iframes = document.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        (iframe as HTMLElement).style.pointerEvents = "none";
      });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current) return;
        const { startX, startY, startWidth, startHeight, direction: dir } = dragRef.current;

        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        let nextWidth = startWidth;
        let nextHeight = startHeight;

        if (dir === "right" || dir === "corner") {
          nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX));
        }

        if (dir === "bottom" || dir === "corner") {
          nextHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + deltaY));
        }

        setDimensions((prev) => ({
          ...prev,
          [currentViewport]: {
            width: Math.round(nextWidth),
            height: Math.round(nextHeight),
          },
        }));
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        setIsResizing(false);
        setResizeDirection(null);

        // Re-enable pointer events on iframes
        const iframes = document.querySelectorAll("iframe");
        iframes.forEach((iframe) => {
          (iframe as HTMLElement).style.pointerEvents = "";
        });

        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [frameWidth, frameHeight, currentViewport]
  );

  return {
    frameWidth,
    frameHeight,
    setWidth,
    setHeight,
    adjustWidth,
    adjustHeight,
    resetFrameSize,
    startResize,
    isResizing,
    resizeDirection,
  };
}
