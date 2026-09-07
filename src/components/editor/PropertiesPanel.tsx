"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Sliders,
  Copy,
  Trash2,
  Plus,
  X,
  AlertCircle,
  Tag,
} from "lucide-react";
import { SerializedNode } from "@/lib/bridge/types";
import {
  parseClassList,
  resolveClassChange,
  getActiveClassForCategory,
  ClassCategory,
} from "@/lib/editor/class-utils";
import { EditorOperation } from "@/lib/editor/operation-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PropertiesPanelProps {
  selectedNode: SerializedNode | null;
  breadcrumbNodes: SerializedNode[];
  onApplyOperation: (op: EditorOperation, description: string, isBurst?: boolean) => void;
  onDuplicateNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

interface SelectedNodePropertiesProps {
  selectedNode: SerializedNode;
  breadcrumbNodes: SerializedNode[];
  onApplyOperation: (op: EditorOperation, description: string, isBurst?: boolean) => void;
  onDuplicateNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

function SelectedNodeProperties({
  selectedNode,
  breadcrumbNodes,
  onApplyOperation,
  onDuplicateNode,
  onDeleteNode,
}: SelectedNodePropertiesProps) {
  // Local debounced text state
  const [textValue, setTextValue] = useState(selectedNode.textContent || "");
  const [prevNodeText, setPrevNodeText] = useState(selectedNode.textContent);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if selectedNode.textContent changed from external undo/redo
  if (selectedNode.textContent !== prevNodeText) {
    setPrevNodeText(selectedNode.textContent);
    setTextValue(selectedNode.textContent || "");
  }

  // New class input state
  const [newClassInput, setNewClassInput] = useState("");
  const [showRawClasses, setShowRawClasses] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const currentClasses = useMemo(() => {
    return parseClassList(selectedNode.className);
  }, [selectedNode.className]);

  const hasNestedElements = selectedNode.children && selectedNode.children.length > 0;
  const isProtectedTag = ["html", "head", "body"].includes(selectedNode.tagName.toLowerCase());

  // Text update handler with debouncing
  const handleTextChange = (newValue: string) => {
    setTextValue(newValue);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onApplyOperation(
        {
          type: "update_text",
          nodeId: selectedNode.id,
          value: newValue,
        },
        `Update text of <${selectedNode.tagName}>`,
        true
      );
    }, 300);
  };

  // Quick class toggle helper
  const handleCategoryChange = (category: ClassCategory, newClass: string | null) => {
    const active = getActiveClassForCategory(currentClasses, category);
    const effectiveClass = active === newClass ? null : newClass;
    const { add, remove } = resolveClassChange(currentClasses, effectiveClass, category);

    onApplyOperation(
      {
        type: "update_classes",
        nodeId: selectedNode.id,
        add,
        remove,
      },
      `Update ${category} on <${selectedNode.tagName}>`
    );
  };

  // Removable class chip
  const handleRemoveClass = (classToRemove: string) => {
    onApplyOperation(
      {
        type: "update_classes",
        nodeId: selectedNode.id,
        add: [],
        remove: [classToRemove],
      },
      `Remove class "${classToRemove}"`
    );
  };

  // Add custom class
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassInput.trim();
    if (!trimmed) return;

    const classesToAdd = trimmed.split(/\s+/).filter((c) => !currentClasses.includes(c));
    if (classesToAdd.length > 0) {
      onApplyOperation(
        {
          type: "update_classes",
          nodeId: selectedNode.id,
          add: classesToAdd,
          remove: [],
        },
        `Add classes: ${classesToAdd.join(", ")}`
      );
      setNewClassInput("");
    }
  };

  // Attribute updates (id, title, aria-label, etc.)
  const handleAttributeChange = (name: string, value: string) => {
    if (!value.trim()) {
      onApplyOperation(
        {
          type: "remove_attribute",
          nodeId: selectedNode.id,
          name,
        },
        `Remove attribute ${name}`
      );
    } else {
      onApplyOperation(
        {
          type: "set_attribute",
          nodeId: selectedNode.id,
          name,
          value: value.trim(),
        },
        `Set attribute ${name}="${value.trim()}"`
      );
    }
  };

  return (
    <aside
      className="w-full bg-white dark:bg-zinc-950 flex flex-col shrink-0 h-full overflow-hidden text-zinc-900 dark:text-zinc-100 text-xs select-none transition-colors"
      data-testid="properties-panel"
    >
      {/* Header */}
      <div className="h-10 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-200">
          <Sliders className="w-3.5 h-3.5 text-zinc-500" />
          <span>Properties</span>
          <span className="font-mono text-zinc-500 font-normal">&lt;{selectedNode.tagName}&gt;</span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
          <span className="text-zinc-400 dark:text-zinc-500">Node ID</span>
          <span title={selectedNode.id} className="font-semibold text-amber-600 dark:text-amber-400/90 truncate max-w-[120px]">
            {selectedNode.id}
          </span>
        </div>
      </div>

      {/* Breadcrumbs Banner */}
      <div className="px-4 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-850 text-[10px] text-zinc-500 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
        <span>Path:</span>
        {breadcrumbNodes.map((n, idx) => (
          <React.Fragment key={n.id}>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">{n.tagName}</span>
            {idx < breadcrumbNodes.length - 1 && <span>&gt;</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Property Sections */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* 1. Text Content Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider">
                Content
              </span>
              {hasNestedElements && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Contains child elements
                </span>
              )}
            </div>

            <Input
              type="text"
              value={textValue}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Text content..."
              data-testid="property-text-input"
            />
          </div>

          <Separator />

          {/* 2. Layout Section */}
          <div className="space-y-3">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider block">
              Layout
            </span>

            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Display</span>
              <div className="grid grid-cols-3 gap-1">
                {(["block", "flex", "grid", "inline-block", "inline-flex", "hidden"] as const).map(
                  (mode) => {
                    const isActive = getActiveClassForCategory(currentClasses, "display") === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleCategoryChange("display", mode)}
                        className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                          isActive
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium shadow-xs"
                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                        }`}
                      >
                        {mode}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Align Items</span>
              <div className="grid grid-cols-3 gap-1">
                {(["items-start", "items-center", "items-end"] as const).map((item) => {
                  const isActive = getActiveClassForCategory(currentClasses, "items") === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleCategoryChange("items", item)}
                      className={`px-1.5 py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      {item.replace("items-", "")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Justify Content</span>
              <div className="grid grid-cols-4 gap-1">
                {(["justify-start", "justify-center", "justify-between", "justify-end"] as const).map(
                  (item) => {
                    const isActive = getActiveClassForCategory(currentClasses, "justify") === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleCategoryChange("justify", item)}
                        className={`px-1 py-1 rounded text-[10px] font-mono truncate transition-colors cursor-pointer ${
                          isActive
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                        }`}
                      >
                        {item.replace("justify-", "")}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* 3. Spacing Section */}
          <div className="space-y-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider block">
              Spacing
            </span>
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Padding</span>
              <div className="grid grid-cols-6 gap-1">
                {(["p-0", "p-2", "p-4", "p-6", "p-8", "p-12"] as const).map((val) => {
                  const isActive = getActiveClassForCategory(currentClasses, "paddingAll") === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleCategoryChange("paddingAll", val)}
                      className={`py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      {val.replace("p-", "")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Margin</span>
              <div className="grid grid-cols-5 gap-1">
                {(["m-0", "m-2", "m-4", "m-8", "mx-auto"] as const).map((val) => {
                  const isActive =
                    val === "mx-auto"
                      ? currentClasses.includes("mx-auto")
                      : getActiveClassForCategory(currentClasses, "marginAll") === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        if (val === "mx-auto") {
                          if (currentClasses.includes("mx-auto")) {
                            handleRemoveClass("mx-auto");
                          } else {
                            onApplyOperation(
                              {
                                type: "update_classes",
                                nodeId: selectedNode.id,
                                add: ["mx-auto"],
                                remove: [],
                              },
                              "Center margin auto"
                            );
                          }
                        } else {
                          handleCategoryChange("marginAll", val);
                        }
                      }}
                      className={`py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      {val.replace("m-", "")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Gap</span>
              <div className="grid grid-cols-5 gap-1">
                {(["gap-0", "gap-2", "gap-4", "gap-6", "gap-8"] as const).map((val) => {
                  const isActive = getActiveClassForCategory(currentClasses, "gapAll") === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleCategoryChange("gapAll", val)}
                      className={`py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      {val.replace("gap-", "")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Separator />

          {/* 4. Typography Section */}
          <div className="space-y-2.5">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider block">
              Typography
            </span>

            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Font Size</span>
              <div className="grid grid-cols-5 gap-1">
                {(["text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl"] as const).map((size) => {
                  const isActive = getActiveClassForCategory(currentClasses, "textSize") === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      data-testid={`prop-btn-${size}`}
                      onClick={() => handleCategoryChange("textSize", size)}
                      className={`py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      {size.replace("text-", "")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Weight</span>
              <div className="grid grid-cols-4 gap-1">
                {(["font-normal", "font-medium", "font-semibold", "font-bold"] as const).map((w) => {
                  const isActive = getActiveClassForCategory(currentClasses, "fontWeight") === w;
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => handleCategoryChange("fontWeight", w)}
                      className={`py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      {w.replace("font-", "")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Alignment</span>
              <div className="grid grid-cols-3 gap-1">
                {(["text-left", "text-center", "text-right"] as const).map((align) => {
                  const isActive = getActiveClassForCategory(currentClasses, "textAlign") === align;
                  return (
                    <button
                      key={align}
                      type="button"
                      onClick={() => handleCategoryChange("textAlign", align)}
                      className={`py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      {align.replace("text-", "")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Separator />

          {/* 5. Appearance Section */}
          <div className="space-y-2.5">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider block">
              Appearance
            </span>

            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Border Radius</span>
              <div className="grid grid-cols-6 gap-1">
                {(["rounded-none", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-full"] as const).map((rad) => {
                  const isActive = getActiveClassForCategory(currentClasses, "borderRadius") === rad;
                  return (
                    <button
                      key={rad}
                      type="button"
                      onClick={() => handleCategoryChange("borderRadius", rad)}
                      className={`py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      {rad.replace("rounded-", "")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500">Text Color</span>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    "text-white",
                    "text-zinc-900",
                    "text-zinc-600",
                    "text-zinc-400",
                    "text-indigo-400",
                    "text-sky-400",
                    "text-emerald-400",
                    "text-amber-400",
                  ] as const
                ).map((col) => {
                  const isActive = getActiveClassForCategory(currentClasses, "textColor") === col;
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => handleCategoryChange("textColor", col)}
                      className={`py-1 px-1 rounded text-[10px] font-mono truncate transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      {col.replace("text-", "")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Separator />

          {/* 6. Active Classes List & Adder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                <span>Classes ({currentClasses.length})</span>
              </span>

              <button
                type="button"
                onClick={() => setShowRawClasses(!showRawClasses)}
                className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline transition-colors cursor-pointer"
              >
                {showRawClasses ? "Done" : "Edit Raw"}
              </button>
            </div>

            {/* Quick Add Class Form */}
            <form onSubmit={handleAddClass} className="flex gap-1.5">
              <Input
                type="text"
                value={newClassInput}
                onChange={(e) => setNewClassInput(e.target.value)}
                placeholder="e.g. shadow-lg tracking-wider"
                data-testid="property-add-class-input"
                className="h-7 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                data-testid="property-add-class-button"
                disabled={!newClassInput.trim()}
                className="h-7 gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </Button>
            </form>

            {/* Render Current Class Chips */}
            <div className="flex flex-wrap gap-1 pt-1 max-h-48 overflow-y-auto custom-scrollbar">
              {currentClasses.map((cls) => (
                <span
                  key={cls}
                  data-testid={`class-chip-${cls}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
                >
                  <span>{cls}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveClass(cls)}
                    data-testid={`remove-class-${cls}`}
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded cursor-pointer"
                    aria-label={`Remove class ${cls}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <Separator />

          {/* 7. Common Semantic Attributes */}
          <div className="space-y-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider block">
              Attributes
            </span>

            <div className="space-y-2 font-mono text-[11px]">
              <div>
                <span className="text-[10px] text-zinc-500 font-sans block mb-0.5">
                  HTML ID (#)
                </span>
                <Input
                  type="text"
                  defaultValue={selectedNode.id || ""}
                  onBlur={(e) => handleAttributeChange("id", e.target.value)}
                  placeholder="Element ID"
                  className="h-7"
                />
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 font-sans block mb-0.5">
                  Title
                </span>
                <Input
                  type="text"
                  defaultValue=""
                  onBlur={(e) => handleAttributeChange("title", e.target.value)}
                  placeholder="Tooltip title"
                  className="h-7"
                />
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 font-sans block mb-0.5">
                  Aria Label
                </span>
                <Input
                  type="text"
                  defaultValue=""
                  onBlur={(e) => handleAttributeChange("aria-label", e.target.value)}
                  placeholder="Accessibility label"
                  className="h-7"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* 8. Destructive / Structural Actions */}
          <div className="space-y-2 pt-1 pb-6">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider block">
              Actions
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isProtectedTag}
                onClick={() => onDuplicateNode(selectedNode.id)}
                data-testid="property-btn-duplicate"
                className="gap-1.5 flex-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate</span>
              </Button>

              {!deleteConfirm ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isProtectedTag}
                  onClick={() => setDeleteConfirm(true)}
                  data-testid="property-btn-delete"
                  className="gap-1.5 flex-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </Button>
              ) : (
                <div className="flex items-center gap-1 flex-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteNode(selectedNode.id)}
                    data-testid="property-btn-confirm-delete"
                    className="flex-1 text-[11px] h-8"
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDeleteConfirm(false)}
                    className="h-8 text-[11px]"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

export function PropertiesPanel({
  selectedNode,
  breadcrumbNodes,
  onApplyOperation,
  onDuplicateNode,
  onDeleteNode,
}: PropertiesPanelProps) {
  if (!selectedNode) {
    return (
      <aside
        className="w-full bg-white dark:bg-zinc-950 flex flex-col shrink-0 h-full overflow-hidden select-none transition-colors"
        data-testid="properties-panel"
      >
        <div className="h-10 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          <Sliders className="w-3.5 h-3.5 text-zinc-500" />
          <span>Properties</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 text-xs">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
            <Sliders className="w-5 h-5" />
          </div>
          <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">No Element Selected</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed max-w-[200px]">
            Click on any element in the canvas or layers tree to inspect and edit its properties.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <SelectedNodeProperties
      key={selectedNode.id}
      selectedNode={selectedNode}
      breadcrumbNodes={breadcrumbNodes}
      onApplyOperation={onApplyOperation}
      onDuplicateNode={onDuplicateNode}
      onDeleteNode={onDeleteNode}
    />
  );
}
