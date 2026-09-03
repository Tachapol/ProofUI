"use client";

import React, { RefObject } from "react";
import { DOMRectData } from "@/lib/bridge/types";
import { VIEWPORT_PRESETS, ViewportMode } from "@/lib/editor/constants";

interface ViewportCanvasProps {
  viewport: ViewportMode;
  sessionId: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  selectedRect: DOMRectData | null;
  selectedTagName: string | null;
  selectedId: string | null;
  hoveredRect: DOMRectData | null;
  hoveredTagName: string | null;
  hoveredId: string | null;
  onIframeLoad?: () => void;
  editorMode?: "preview" | "design" | "code";
}

export function ViewportCanvas({
  viewport,
  sessionId,
  iframeRef,
  selectedRect,
  selectedTagName,
  selectedId,
  hoveredRect,
  hoveredTagName,
  hoveredId,
  onIframeLoad,
  editorMode = "design",
}: ViewportCanvasProps) {
  // Width styling based on standardized viewport presets
  const widthClasses = {
    desktop: "w-full max-w-[1440px]",
    tablet: "w-[768px]",
    mobile: "w-[390px]",
  }[viewport];

  const presetInfo = VIEWPORT_PRESETS[viewport];

  return (
    <main className="flex-1 bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center justify-start p-3 md:p-5 overflow-hidden relative transition-colors">
      {/* Background dot-grid pattern for editor canvas aesthetic */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-30"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Frame Container with smooth width transition */}
      <div
        className={`relative flex flex-col h-full ${widthClasses} transition-[width] duration-300 ease-out z-10`}
      >
        {/* Frame Top Bar / Device Header */}
        <div className="h-7 bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-t-xl px-3 flex items-center justify-between text-[11px] text-zinc-500 select-none shadow-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700 inline-block" />
          </div>
          <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
            {presetInfo.name} • {presetInfo.label}
          </div>
          <div className="w-8" />
        </div>

        {/* Frame Body with Iframe and Overlay */}
        <div className="relative flex-1 bg-white dark:bg-zinc-950 rounded-b-xl border-x border-b border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
          {/* Preview Sandboxed Iframe (without allow-same-origin for maximum isolation) */}
          <iframe
            ref={iframeRef}
            src={`/preview?sessionId=${encodeURIComponent(sessionId)}`}
            title="Preview Canvas"
            data-testid="preview-iframe"
            sandbox="allow-scripts"
            onLoad={onIframeLoad}
            className="w-full h-full border-none bg-slate-950 block"
          />

          {/* Parent-Rendered Hover & Selection Overlay Layer (Design Mode only) */}
          {editorMode === "design" && (
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              data-testid="selection-overlay-container"
            >
              {/* Hover Outline */}
              {hoveredRect && hoveredId !== selectedId && (
                <div
                  data-testid="hover-outline"
                  className="absolute border border-dashed border-sky-400 bg-sky-400/10 pointer-events-none transition-all duration-75 z-20"
                  style={{
                    top: `${hoveredRect.top}px`,
                    left: `${hoveredRect.left}px`,
                    width: `${hoveredRect.width}px`,
                    height: `${hoveredRect.height}px`,
                  }}
                >
                  {/* Floating Tag Badge */}
                  <div
                    className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-sky-500 text-white font-mono text-[10px] font-bold shadow-sm whitespace-nowrap"
                    style={{
                      transform: hoveredRect.top < 24 ? "translateY(24px)" : "none",
                    }}
                  >
                    &lt;{hoveredTagName || "element"}&gt;
                  </div>
                </div>
              )}

              {/* Selection Outline */}
              {selectedRect && (
              <div
                data-testid="selection-outline"
                className="absolute border-2 border-indigo-500 bg-indigo-500/10 pointer-events-none transition-all duration-75 z-30 shadow-lg shadow-indigo-500/20"
                style={{
                  top: `${selectedRect.top}px`,
                  left: `${selectedRect.left}px`,
                  width: `${selectedRect.width}px`,
                  height: `${selectedRect.height}px`,
                }}
              >
                {/* Corner Resizing/Selection Handle Stubs */}
                <span className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-indigo-600 rounded-xs shadow-xs" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-indigo-600 rounded-xs shadow-xs" />
                <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-indigo-600 rounded-xs shadow-xs" />
                <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-indigo-600 rounded-xs shadow-xs" />

                {/* Floating Selection Info Badge */}
                <div
                  className="absolute -top-6 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-600 text-white font-mono text-[10px] font-semibold shadow-md whitespace-nowrap"
                  style={{
                    transform: selectedRect.top < 26 ? "translateY(28px)" : "none",
                  }}
                >
                  <span>&lt;{selectedTagName || "element"}&gt;</span>
                  <span className="opacity-75 font-normal text-[9px] border-l border-indigo-400 pl-1.5">
                    {Math.round(selectedRect.width)} × {Math.round(selectedRect.height)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </main>
  );
}
