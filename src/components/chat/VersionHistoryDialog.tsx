"use client";

import React, { useState } from "react";
import { History, RotateCcw, X, Clock, CheckCircle2 } from "lucide-react";
import { DocumentVersion } from "@/lib/generation/schemas";
import { Button } from "@/components/ui/button";

interface VersionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  versions: DocumentVersion[];
  currentRevision: number;
  onRestoreVersion: (versionId: string) => void;
}

export function VersionHistoryDialog({
  isOpen,
  onClose,
  versions,
  currentRevision,
  onRestoreVersion,
}: VersionHistoryDialogProps) {
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div
      data-testid="version-history-dialog"
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs"
    >
      <div className="bg-popover border border-border rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Document Version History</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No previous versions recorded yet.
            </div>
          ) : (
            [...versions].reverse().map((ver) => {
              const isCurrent = ver.revision === currentRevision;
              const formattedDate = new Date(ver.createdAt).toLocaleString();

              return (
                <div
                  key={ver.id}
                  data-testid={`version-item-${ver.id}`}
                  className={`p-3 rounded-lg border text-xs space-y-1.5 transition-colors ${
                    isCurrent
                      ? "bg-accent/40 border-primary/40"
                      : "bg-card border-border hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Rev {ver.revision}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-medium bg-muted text-muted-foreground">
                        {ver.source}
                      </span>
                    </div>

                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Current</span>
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmRestoreId(ver.id)}
                        data-testid={`btn-restore-version-${ver.id}`}
                        className="h-6 px-2 text-[11px] gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </Button>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground">{ver.summary}</p>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                    <Clock className="w-3 h-3" />
                    <span>{formattedDate}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Restore Confirmation Dialog */}
        {confirmRestoreId && (
          <div className="p-4 border-t border-border bg-muted/40 flex items-center justify-between gap-3 text-xs">
            <p className="text-foreground font-medium">
              Restore this version as the new document head?
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRestoreId(null)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onRestoreVersion(confirmRestoreId);
                  setConfirmRestoreId(null);
                  onClose();
                }}
                data-testid="btn-confirm-restore-version"
                className="h-7 text-xs bg-primary text-primary-foreground"
              >
                Confirm Restore
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
