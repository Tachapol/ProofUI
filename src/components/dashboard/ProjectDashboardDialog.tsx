"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  Plus,
  Archive,
  RotateCcw,
  Edit2,
  Check,
  Calendar,
  ExternalLink,
  Layers,
} from "lucide-react";
import { ProjectMetadata } from "@/lib/projects/service";

interface ProjectDashboardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId?: string;
  onSelectProject: (projectId: string) => void;
  onImportLocalWorkspace?: () => void;
  hasLocalWorkspaceData?: boolean;
}

export function ProjectDashboardDialog({
  isOpen,
  onClose,
  currentProjectId,
  onSelectProject,
  onImportLocalWorkspace,
  hasLocalWorkspaceData,
}: ProjectDashboardDialogProps) {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects?includeArchived=${showArchived}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Failed to load projects", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen, showArchived]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewProjectName("");
        setIsCreating(false);
        fetchProjects();
        if (data.project?.metadata?.id) {
          onSelectProject(data.project.metadata.id);
          onClose();
        }
      }
    } catch (err) {
      console.error("Failed to create project", err);
    }
  };

  const handleRename = async (projectId: string) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to rename project", err);
    }
  };

  const handleToggleArchive = async (projectId: string, isArchived: boolean) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !isArchived }),
      });
      if (res.ok) {
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to archive project", err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FolderKanban className="w-5 h-5 text-indigo-500" />
              <span>Project Dashboard</span>
            </DialogTitle>
            <Button
              size="sm"
              onClick={() => setIsCreating(true)}
              data-testid="btn-create-new-project"
              className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </Button>
          </div>
          <DialogDescription>
            Manage and switch between persistent website projects and experiments.
          </DialogDescription>
        </DialogHeader>

        {hasLocalWorkspaceData && onImportLocalWorkspace && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg flex items-center justify-between">
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Local Workspace Detected:</strong> Unsaved changes found in your browser cache.
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onImportLocalWorkspace}
              className="text-xs border-amber-500/40 text-amber-700 dark:text-amber-300"
            >
              Import to Cloud
            </Button>
          </div>
        )}

        {isCreating && (
          <form onSubmit={handleCreate} className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700 flex gap-2">
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Acme SaaS Redesign"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100"
            />
            <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreating(false)}
              className="text-xs text-zinc-500"
            >
              Cancel
            </Button>
          </form>
        )}

        <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
          <span>{projects.length} {showArchived ? "total" : "active"} projects</span>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="hover:text-zinc-900 dark:hover:text-zinc-100 underline cursor-pointer"
          >
            {showArchived ? "Hide Archived" : "Show Archived"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
          {loading ? (
            <div className="text-center py-8 text-xs text-zinc-400">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-400">
              No projects yet. Click "New Project" to get started.
            </div>
          ) : (
            projects.map((proj) => {
              const isCurrent = proj.id === currentProjectId;
              const isEditing = editingId === proj.id;

              return (
                <div
                  key={proj.id}
                  data-testid={`project-item-${proj.id}`}
                  className={`p-3 rounded-lg border text-sm flex items-center justify-between gap-3 transition-colors ${
                    isCurrent
                      ? "border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="px-2 py-0.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleRename(proj.id)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {proj.name}
                        </span>
                      )}

                      {isCurrent && (
                        <Badge variant="default" className="text-[10px] py-0 px-1.5 bg-indigo-600 text-white">
                          Current
                        </Badge>
                      )}
                      {proj.isArchived && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 text-zinc-500">
                          Archived
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        <span>Rev {proj.revision}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(proj.updatedAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onSelectProject(proj.id);
                          onClose();
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Open
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(proj.id);
                        setEditingName(proj.name);
                      }}
                      title="Rename"
                      className="h-8 w-8 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleToggleArchive(proj.id, proj.isArchived)}
                      title={proj.isArchived ? "Unarchive" : "Archive"}
                      className="h-8 w-8 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      {proj.isArchived ? (
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
