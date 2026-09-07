"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Layers,
  Box,
  Type,
  Layout,
  MousePointerClick,
  ChevronsUpDown,
} from "lucide-react";
import { SerializedNode } from "@/lib/bridge/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LayersPanelProps {
  documentTree: SerializedNode | null;
  selectedId: string | null;
  hoveredId: string | null;
  onSelectNode: (id: string | null) => void;
  onHoverNode: (id: string | null) => void;
  width?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onMouseDownResize?: (e: React.MouseEvent) => void;
  onKeyDownResize?: (e: React.KeyboardEvent) => void;
}

function getNodeIcon(node: SerializedNode) {
  const tag = node.tagName.toLowerCase();
  if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "strong"].includes(tag)) {
    return <Type className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />;
  }
  if (["header", "footer", "main", "nav", "section", "article"].includes(tag)) {
    return <Layout className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />;
  }
  if (["button", "input", "select"].includes(tag)) {
    return <MousePointerClick className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  }
  return <Box className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
}

interface TreeNodeRowProps {
  node: SerializedNode;
  depth: number;
  isNodeExpanded: (id: string) => boolean;
  onToggleExpand: (id: string) => void;
  selectedId: string | null;
  hoveredId: string | null;
  onSelectNode: (id: string | null) => void;
  onHoverNode: (id: string | null) => void;
}

function TreeNodeRow({
  node,
  depth,
  isNodeExpanded,
  onToggleExpand,
  selectedId,
  hoveredId,
  onSelectNode,
  onHoverNode,
}: TreeNodeRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedId === node.id;
  const isHovered = hoveredId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = isNodeExpanded(node.id);

  // Auto-scroll selected row into view
  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isSelected]);

  const primaryId = node.id && !node.id.startsWith("node_") ? node.id : null;
  const classSummary = node.className
    ? node.className
        .split(" ")
        .filter((c) => c && !c.startsWith("dark:") && !c.includes(":"))
        .slice(0, 2)
        .join(".")
    : "";

  return (
    <div className="flex flex-col select-none">
      <div
        ref={rowRef}
        data-layer-id={node.id}
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(node.id);
        }}
        onMouseEnter={() => onHoverNode(node.id)}
        onMouseLeave={() => onHoverNode(null)}
        style={{ paddingLeft: `${Math.max(8, depth * 14 + 6)}px` }}
        className={`group flex items-center gap-1.5 py-1.5 pr-3 cursor-pointer text-xs transition-colors rounded-md mx-1 ${
          isSelected
            ? "bg-indigo-600/20 text-zinc-900 dark:text-zinc-100 border border-indigo-500/40 font-medium"
            : isHovered
            ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
      >
        {/* Expand / Collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded shrink-0 cursor-pointer"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        {/* Semantic Icon */}
        {getNodeIcon(node)}

        {/* Tag Name Badge */}
        <span
          className={`font-mono text-[11px] font-semibold tracking-tight ${
            isSelected ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-800 dark:text-zinc-300"
          }`}
        >
          {node.tagName}
        </span>

        {/* ID or Class detail preview */}
        {primaryId ? (
          <span className="text-[10px] text-amber-600 dark:text-amber-400/90 font-mono truncate max-w-[100px]">
            #{primaryId}
          </span>
        ) : classSummary ? (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate max-w-[110px]">
            .{classSummary}
          </span>
        ) : null}

        {/* Text snippet preview if available */}
        {node.textContent && !node.children?.length ? (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[90px] ml-auto italic">
            &ldquo;{node.textContent.trim()}&rdquo;
          </span>
        ) : null}
      </div>

      {/* Render children recursively if expanded */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {node.children!.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              isNodeExpanded={isNodeExpanded}
              onToggleExpand={onToggleExpand}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelectNode={onSelectNode}
              onHoverNode={onHoverNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LayersPanel({
  documentTree,
  selectedId,
  hoveredId,
  onSelectNode,
  onHoverNode,
  width,
  isCollapsed,
  onToggleCollapse,
  onMouseDownResize,
  onKeyDownResize,
}: LayersPanelProps) {
  // Local user expanded state override map (nodeId -> boolean)
  const [userToggledMap, setUserToggledMap] = useState<Record<string, boolean>>({});

  // Collect all expandable IDs in document
  const allIds = useMemo(() => {
    if (!documentTree) return [];
    const ids: string[] = [];
    function collect(node: SerializedNode) {
      if (node.children && node.children.length > 0) {
        ids.push(node.id);
        for (const child of node.children) {
          collect(child);
        }
      }
    }
    collect(documentTree);
    return ids;
  }, [documentTree]);

  // Compute ancestor path for selectedId
  const selectedAncestors = useMemo(() => {
    if (!selectedId || !documentTree) return new Set<string>();
    const ancestors = new Set<string>();

    function find(node: SerializedNode, path: string[]): boolean {
      if (node.id === selectedId) {
        for (const p of path) ancestors.add(p);
        return true;
      }
      if (node.children) {
        for (const c of node.children) {
          if (find(c, [...path, node.id])) return true;
        }
      }
      return false;
    }

    find(documentTree, []);
    return ancestors;
  }, [selectedId, documentTree]);

  // Expand state resolver
  const isNodeExpanded = useCallback(
    (id: string) => {
      // 1. User manual override has highest priority
      if (id in userToggledMap) {
        return userToggledMap[id];
      }
      // 2. Ancestors of selected node should be expanded automatically
      if (selectedAncestors.has(id)) {
        return true;
      }
      // 3. Default to expanded for top levels
      return true;
    },
    [userToggledMap, selectedAncestors]
  );

  const toggleExpand = (id: string) => {
    setUserToggledMap((prev) => ({
      ...prev,
      [id]: !isNodeExpanded(id),
    }));
  };

  const toggleExpandAll = () => {
    const someCollapsed = allIds.some((id) => !isNodeExpanded(id));
    const next: Record<string, boolean> = {};
    for (const id of allIds) {
      next[id] = someCollapsed;
    }
    setUserToggledMap(next);
  };

  if (isCollapsed) {
    return (
      <aside
        className="w-10 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-2 shrink-0 h-full select-none transition-colors"
        data-testid="layers-panel-collapsed"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          title="Expand Layers Tree"
          data-testid="layers-expand-btn"
          className="h-7 w-7 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <Layers className="w-4 h-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside
      className="relative bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 h-full overflow-hidden select-none transition-colors"
      style={{ width: width ? `${width}px` : "18rem" }}
      data-testid="layers-panel"
    >
      {/* Resizer */}
      <div
        data-testid="layers-panel-resizer"
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-30"
        onMouseDown={onMouseDownResize}
        onKeyDown={onKeyDownResize}
        role="separator"
        aria-label="Resize layers panel"
        tabIndex={0}
      />

      {/* Header */}
      <div className="h-10 px-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-zinc-500" />
          <span>Layers Tree</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleExpandAll}
            title="Expand / Collapse all"
            className="h-6 w-6"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </Button>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              title="Collapse Layers Tree"
              data-testid="layers-collapse-btn"
              className="h-6 w-6 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tree Content with ScrollArea */}
      <ScrollArea className="flex-1 py-2 pr-1">
        {documentTree ? (
          <TreeNodeRow
            node={documentTree}
            depth={0}
            isNodeExpanded={isNodeExpanded}
            onToggleExpand={toggleExpand}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelectNode={onSelectNode}
            onHoverNode={onHoverNode}
          />
        ) : (
          <div className="p-4 text-center text-xs text-zinc-400">Loading document tree...</div>
        )}
      </ScrollArea>

      {/* Footer / Shortcut hints */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800/80 text-[10px] text-zinc-500 flex items-center justify-between px-3">
        <span>Click layer to select</span>
        <span className="font-mono text-zinc-400 dark:text-zinc-600">Sync: Active</span>
      </div>
    </aside>
  );
}
