"use client";

import React, { useMemo, useState } from "react";
import { MeasuredHeatmapNode } from "@/lib/bridge/types";
import { AggregatedProductionEvidence } from "@/lib/production/schemas";
import {
  computeSaliencyMap,
  computeClickDensityMap,
  computeScrollReachMap,
  SaliencyHotspot,
  ClickHotspot,
} from "@/lib/heatmap/saliency";
import { Eye, Flame, ScrollText, X, AlertTriangle, Crosshair, Sparkles } from "lucide-react";

export type HeatmapMode = "saliency" | "clicks" | "scroll";

export interface HeatmapCanvasOverlayProps {
  nodes: MeasuredHeatmapNode[];
  evidence?: AggregatedProductionEvidence | null;
  selectedId?: string | null;
  onSelectNode?: (id: string | null) => void;
  mode: HeatmapMode;
  onModeChange: (mode: HeatmapMode) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  onClose: () => void;
  scrollHeight?: number;
  viewportHeight?: number;
  viewportWidth?: number;
}

export function HeatmapCanvasOverlay({
  nodes,
  evidence,
  selectedId,
  onSelectNode,
  mode,
  onModeChange,
  opacity,
  onOpacityChange,
  onClose,
  scrollHeight = 1200,
  viewportHeight = 800,
  viewportWidth = 1440,
}: HeatmapCanvasOverlayProps) {
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);

  // 1. Saliency Calculation
  const { hotspots: saliencyHotspots, scanpath } = useMemo(
    () => computeSaliencyMap(nodes, viewportHeight, viewportWidth),
    [nodes, viewportHeight, viewportWidth]
  );

  // 2. Click Density Calculation
  const { hotspots: clickHotspots, totalClicks } = useMemo(
    () => computeClickDensityMap(nodes, evidence),
    [nodes, evidence]
  );

  // 3. Scroll Reach Calculation
  const scrollBands = useMemo(
    () => computeScrollReachMap(scrollHeight, evidence),
    [scrollHeight, evidence]
  );

  return (
    <div
      data-testid="heatmap-canvas-overlay"
      className="absolute inset-0 pointer-events-auto overflow-hidden select-none z-20"
      style={{ opacity }}
    >
      {/* 1. SVG Layer for Blended Radial Heat Gradients & Scanpath */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radial Gradient for Saliency Attention */}
          <radialGradient id="saliencyGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#f59e0b" stopOpacity="0.65" />
            <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>

          {/* Radial Gradient for Click Heatmap */}
          <radialGradient id="clickGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#ea580c" stopOpacity="0.7" />
            <stop offset="75%" stopColor="#eab308" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>

          {/* Soft Blur Filter for realistic eye-tracking look */}
          <filter id="heatBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="24" />
          </filter>
        </defs>

        {/* Mode 1: Saliency Eye-Tracking Fixation Blobs */}
        {mode === "saliency" && (
          <g filter="url(#heatBlur)">
            {saliencyHotspots.map((spot) => {
              const radius = Math.max(spot.width, spot.height) * 0.9 * spot.score + 25;
              return (
                <circle
                  key={`sal-glow-${spot.id}`}
                  cx={spot.x}
                  cy={spot.y}
                  r={radius}
                  fill="url(#saliencyGradient)"
                />
              );
            })}
          </g>
        )}

        {/* Mode 2: Click Density Blobs */}
        {mode === "clicks" && (
          <g filter="url(#heatBlur)">
            {clickHotspots.map((spot) => {
              const radius = Math.max(spot.width, spot.height) * 0.8 * spot.intensity + 20;
              return (
                <circle
                  key={`clk-glow-${spot.id}`}
                  cx={spot.x}
                  cy={spot.y}
                  r={radius}
                  fill="url(#clickGradient)"
                />
              );
            })}
          </g>
        )}

        {/* Mode 1 Scanpath Connector Line */}
        {mode === "saliency" && scanpath.length > 1 && (
          <g>
            <polyline
              points={scanpath.map((s) => `${s.x},${s.y}`).join(" ")}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              opacity="0.8"
            />
          </g>
        )}
      </svg>

      {/* Mode 3: Scroll Reach Horizontal Bands */}
      {mode === "scroll" && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-start">
          {scrollBands.map((band, idx) => (
            <div
              key={`scroll-band-${idx}`}
              className="relative border-b border-dashed border-zinc-600/40 flex items-start p-3"
              style={{
                height: `${band.endY - band.startY}px`,
                backgroundColor: band.color,
              }}
            >
              <div className="bg-zinc-900/85 text-white backdrop-blur px-2.5 py-1 rounded-md text-xs font-mono font-semibold shadow-md flex items-center gap-1.5 border border-zinc-700">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{band.label}</span>
                <span className="text-zinc-400 text-[10px]">({band.visitorPercent}% visitors)</span>
              </div>
            </div>
          ))}

          {/* Above-The-Fold Guideline Marker */}
          <div
            className="absolute left-0 right-0 border-t-2 border-red-500/80 z-30 pointer-events-none flex items-center justify-end px-4"
            style={{ top: "680px" }}
          >
            <span className="bg-red-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-sm -translate-y-1/2">
              Fold Line (~680px Standard)
            </span>
          </div>
        </div>
      )}

      {/* 2. Interactive Hotspot Markers & Tooltips (Click to Select Node) */}
      <div className="absolute inset-0 pointer-events-none">
        {mode === "saliency" &&
          saliencyHotspots.map((spot) => {
            const isSelected = selectedId === spot.id;
            const isHovered = hoveredHotspotId === spot.id;

            return (
              <div
                key={`sal-marker-${spot.id}`}
                data-testid={`hotspot-${spot.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode?.(spot.id);
                }}
                onMouseEnter={() => setHoveredHotspotId(spot.id)}
                onMouseLeave={() => setHoveredHotspotId(null)}
                className={`absolute cursor-pointer pointer-events-auto transition-transform duration-100 ${
                  isSelected ? "ring-2 ring-amber-400 ring-offset-2 z-40 scale-105" : "z-30"
                }`}
                style={{
                  top: `${spot.y - 12}px`,
                  left: `${spot.x - 12}px`,
                  width: "24px",
                  height: "24px",
                }}
              >
                {/* Numbered Scanpath badge if part of primary scanpath */}
                {spot.scanpathOrder ? (
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center shadow-lg border border-amber-200">
                    {spot.scanpathOrder}
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-rose-500/80 text-white flex items-center justify-center shadow-sm border border-rose-300">
                    <Crosshair className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Hover Tooltip */}
                {(isHovered || isSelected) && (
                  <div className="absolute top-7 left-1/2 -translate-x-1/2 bg-zinc-900/95 text-white text-xs px-2.5 py-1.5 rounded-md shadow-xl border border-zinc-700 whitespace-nowrap z-50 pointer-events-none font-sans flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 font-semibold text-amber-400">
                      <span>&lt;{spot.tagName}&gt;</span>
                      <span>•</span>
                      <span>Saliency: {Math.round(spot.score * 100)}%</span>
                    </div>
                    <div className="text-[11px] text-zinc-300">{spot.description}</div>
                    {spot.textContent && (
                      <div className="text-[10px] text-zinc-400 italic max-w-[200px] truncate">
                        &quot;{spot.textContent}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {mode === "clicks" &&
          clickHotspots.map((spot) => {
            const isSelected = selectedId === spot.id;
            const isHovered = hoveredHotspotId === spot.id;

            return (
              <div
                key={`clk-marker-${spot.id}`}
                data-testid={`click-hotspot-${spot.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode?.(spot.id);
                }}
                onMouseEnter={() => setHoveredHotspotId(spot.id)}
                onMouseLeave={() => setHoveredHotspotId(null)}
                className={`absolute cursor-pointer pointer-events-auto transition-all ${
                  isSelected ? "ring-2 ring-rose-400 ring-offset-2 z-40 scale-105" : "z-30"
                }`}
                style={{
                  top: `${spot.y - 12}px`,
                  left: `${spot.x - 12}px`,
                }}
              >
                {/* Floating Metric Pill */}
                <div
                  className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold flex items-center gap-1 shadow-md border ${
                    spot.isLowInteractionWarning
                      ? "bg-amber-600 text-white border-amber-400 animate-pulse"
                      : "bg-zinc-900/90 text-white border-zinc-700"
                  }`}
                >
                  {spot.isLowInteractionWarning ? (
                    <AlertTriangle className="w-3 h-3 text-amber-300" />
                  ) : (
                    <Flame className="w-3 h-3 text-rose-400" />
                  )}
                  <span>{spot.clicks}</span>
                  <span className="text-[10px] opacity-75 font-normal">({spot.percent}%)</span>
                </div>

                {/* Detailed Tooltip */}
                {(isHovered || isSelected) && (
                  <div className="absolute top-7 left-1/2 -translate-x-1/2 bg-zinc-900/95 text-white text-xs px-2.5 py-1.5 rounded-md shadow-xl border border-zinc-700 whitespace-nowrap z-50 pointer-events-none font-sans flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 font-semibold text-rose-400">
                      <span>&lt;{spot.tagName}&gt;</span>
                      <span>•</span>
                      <span>{spot.clicks} Clicks</span>
                      <span className="text-zinc-400">({spot.percent}% share)</span>
                    </div>
                    {spot.isLowInteractionWarning && (
                      <div className="text-[11px] text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Low interaction on CTA (Heuristic flaw)</span>
                      </div>
                    )}
                    {spot.textContent && (
                      <div className="text-[10px] text-zinc-400 italic max-w-[200px] truncate">
                        &quot;{spot.textContent}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* 3. Floating Control Dock (Bottom Center of Canvas) */}
      <aside
        aria-label="Heatmap Controls"
        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/95 text-white backdrop-blur-md px-3 py-2 rounded-xl shadow-2xl border border-zinc-700/80 flex items-center gap-3 z-50 pointer-events-auto animate-in fade-in slide-in-from-bottom-3"
      >
        {/* Mode Switcher */}
        <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700 text-xs">
          <button
            type="button"
            data-testid="heatmap-mode-saliency"
            onClick={() => onModeChange("saliency")}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all font-medium ${
              mode === "saliency"
                ? "bg-amber-500 text-zinc-950 font-bold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Visual Attention & Cognitive Saliency (Eye-Tracking Scanpath)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Attention</span>
          </button>

          <button
            type="button"
            data-testid="heatmap-mode-clicks"
            onClick={() => onModeChange("clicks")}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all font-medium ${
              mode === "clicks"
                ? "bg-rose-500 text-white font-bold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Click Density & Interaction Heatmap"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Clicks</span>
          </button>

          <button
            type="button"
            data-testid="heatmap-mode-scroll"
            onClick={() => onModeChange("scroll")}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all font-medium ${
              mode === "scroll"
                ? "bg-indigo-500 text-white font-bold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Scroll Depth Reach Distribution"
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span>Scroll</span>
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-zinc-700" />

        {/* Opacity Slider */}
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <span className="text-[11px] text-zinc-400">Opacity</span>
          <input
            type="range"
            min="0.15"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            data-testid="heatmap-opacity-slider"
            className="w-16 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <span className="font-mono text-[10px] w-6 text-right">
            {Math.round(opacity * 100)}%
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-zinc-700" />

        {/* Color Scale Legend */}
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span>Cold</span>
          <div className="w-12 h-2 rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-red-500" />
          <span>Hot</span>
        </div>

        {/* Close Overlay Button */}
        <button
          type="button"
          data-testid="btn-close-heatmap"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Close Heatmap Overlay"
        >
          <X className="w-4 h-4" />
        </button>
      </aside>
    </div>
  );
}
