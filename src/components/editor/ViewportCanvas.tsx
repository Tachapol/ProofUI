"use client";

import React, { RefObject } from "react";
import { DOMRectData, MeasuredHeatmapNode } from "@/lib/bridge/types";
import { VIEWPORT_PRESETS, ViewportMode } from "@/lib/editor/constants";
import { AggregatedProductionEvidence } from "@/lib/production/schemas";
import { HeatmapCanvasOverlay, HeatmapMode } from "./HeatmapCanvasOverlay";

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
  frameWidth?: number;
  frameHeight?: number;
  isResizing?: boolean;
  onStartResize?: (direction: "right" | "bottom" | "corner", e: React.MouseEvent) => void;
  onResetFrameSize?: () => void;
  // Heatmap props
  isHeatmapActive?: boolean;
  heatmapNodes?: MeasuredHeatmapNode[];
  heatmapEvidence?: AggregatedProductionEvidence | null;
  heatmapMode?: HeatmapMode;
  onHeatmapModeChange?: (mode: HeatmapMode) => void;
  heatmapOpacity?: number;
  onHeatmapOpacityChange?: (opacity: number) => void;
  onCloseHeatmap?: () => void;
  onSelectNode?: (id: string | null) => void;
  heatmapScrollHeight?: number;
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
  frameWidth,
  frameHeight,
  isResizing = false,
  onStartResize,
  onResetFrameSize,
  isHeatmapActive = false,
  heatmapNodes = [],
  heatmapEvidence,
  heatmapMode = "saliency",
  onHeatmapModeChange,
  heatmapOpacity = 0.7,
  onHeatmapOpacityChange,
  onCloseHeatmap,
  onSelectNode,
  heatmapScrollHeight,
}: ViewportCanvasProps) {
  // Width styling based on standardized viewport presets
  const widthClasses = {
    desktop: "max-w-[1440px]",
    tablet: "max-w-[768px]",
    mobile: "max-w-[390px]",
  }[viewport];

  const presetInfo = VIEWPORT_PRESETS[viewport];
  const activeWidth = frameWidth || presetInfo.width;
  const activeHeight = frameHeight || presetInfo.height;

  return (
    <main className="flex-1 bg-zinc-100 dark:bg-zinc-950 flex flex-col justify-start p-3 md:p-5 overflow-auto relative transition-colors">
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
        data-testid="viewport-frame-container"
        className={`relative flex flex-col mx-auto ${widthClasses} ${isResizing ? "transition-none" : "transition-[width] duration-200 ease-out"} z-10 shrink-0 shadow-2xl`}
        style={{
          width: `${activeWidth}px`,
          minWidth: `${activeWidth}px`,
          height: `${activeHeight}px`,
        }}
      >
        {/* Floating live dimension indicator during drag resize */}
        {isResizing && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-zinc-900/90 text-white text-xs font-mono font-bold px-3 py-1 rounded-full shadow-lg border border-zinc-700 z-40 animate-in fade-in">
            {activeWidth} × {activeHeight} px
          </div>
        )}

        {/* Frame Top Bar / Device Header */}
        <div className="h-7 bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-t-xl px-3 flex items-center justify-between text-[11px] text-zinc-500 select-none shadow-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80 dark:bg-rose-500/60 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 dark:bg-amber-500/60 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 dark:bg-emerald-500/60 inline-block" />
          </div>
          <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
            <span>{presetInfo.name}</span>
            <span>•</span>
            <span
              data-testid="frame-dimension-indicator"
              className="text-zinc-800 dark:text-zinc-200 font-semibold"
            >
              {activeWidth} × {activeHeight} px
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onResetFrameSize && (
              <button
                type="button"
                onClick={onResetFrameSize}
                title="Reset to default preset size"
                className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer font-sans"
              >
                Reset
              </button>
            )}
          </div>
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

          {/* Interactive Attention & Heatmap Overlay */}
          {isHeatmapActive && (
            <HeatmapCanvasOverlay
              nodes={heatmapNodes}
              evidence={heatmapEvidence}
              selectedId={selectedId}
              onSelectNode={onSelectNode}
              mode={heatmapMode}
              onModeChange={onHeatmapModeChange || (() => {})}
              opacity={heatmapOpacity}
              onOpacityChange={onHeatmapOpacityChange || (() => {})}
              onClose={onCloseHeatmap || (() => {})}
              scrollHeight={heatmapScrollHeight || activeHeight}
              viewportHeight={activeHeight}
              viewportWidth={activeWidth}
            />
          )}

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

        {/* Resize Handle: Right (Width) */}
        <div
          onMouseDown={(e) => onStartResize?.("right", e)}
          data-testid="frame-resize-handle-right"
          title="Drag to resize width"
          className="absolute -right-2 top-7 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group z-40 select-none"
        >
          <div className="w-1 h-12 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-indigo-500 group-hover:w-1.5 transition-all shadow-xs" />
        </div>

        {/* Resize Handle: Bottom (Height) */}
        <div
          onMouseDown={(e) => onStartResize?.("bottom", e)}
          data-testid="frame-resize-handle-bottom"
          title="Drag to resize height"
          className="absolute -bottom-2 left-0 right-0 h-4 cursor-ns-resize flex items-center justify-center group z-40 select-none"
        >
          <div className="h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-indigo-500 group-hover:h-1.5 transition-all shadow-xs" />
        </div>

        {/* Resize Handle: Corner (Both) */}
        <div
          onMouseDown={(e) => onStartResize?.("corner", e)}
          data-testid="frame-resize-handle-corner"
          title="Drag to resize width & height"
          className="absolute -bottom-2 -right-2 w-6 h-6 cursor-nwse-resize flex items-center justify-center group z-40 select-none"
        >
          <div className="w-2.5 h-2.5 rounded-br-sm border-r-2 border-b-2 border-zinc-400 dark:border-zinc-500 group-hover:border-indigo-500 transition-colors" />
        </div>
      </div>
    </main>
  );
}
