"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Layers,
  BarChart3,
  FlaskConical,
  ArrowRight,
  Globe,
  Sliders,
  CheckCircle2,
  Lock,
  Cpu,
  MousePointerClick,
  FileCode2,
  FolderKanban,
  Sun,
  Moon,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { ProjectDashboardDialog } from "@/components/dashboard/ProjectDashboardDialog";
import { UserMenu } from "@/components/auth/UserMenu";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchEditor: (projectId?: string) => void;
}

export function WelcomeLandingView({
  onLaunchEditor,
}: {
  onLaunchEditor: (projectId?: string) => void;
}) {
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showDashboardDialog, setShowDashboardDialog] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // Check initial auth
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) setCurrentUser(data.user);
        }
      } catch (err) {
        console.warn("Auth check error:", err);
      }
    }
    void checkAuth();

    // Check saved theme
    if (typeof localStorage !== "undefined") {
      const savedTheme = localStorage.getItem("proofui_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof document !== "undefined") {
      if (next === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("proofui_theme", next);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
      {/* Glow background ambient lighting */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/20 to-pink-600/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute top-[600px] -left-40 w-[600px] h-[600px] bg-indigo-500/10 blur-[150px] pointer-events-none rounded-full" />

      {/* Navigation Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">ProofUI</span>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-[10px] py-0">
                Senior Project
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-zinc-400 hover:text-zinc-100"
              title="Toggle Theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {currentUser ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDashboardDialog(true)}
                  className="text-xs border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200 gap-1.5"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-indigo-400" />
                  <span>My Projects</span>
                </Button>
                <UserMenu
                  user={currentUser}
                  onOpenAuth={() => setShowAuthDialog(true)}
                  onLogout={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    setCurrentUser(null);
                  }}
                />
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAuthDialog(true)}
                className="text-xs border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200"
              >
                Sign In
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => onLaunchEditor()}
              data-testid="landing-btn-launch-editor"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-md shadow-indigo-600/30 gap-1.5"
            >
              <span>Open Editor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center text-center z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-8 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Evidence-Based UX/UI Optimization with Human-in-the-Loop Validation</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl leading-[1.1] mb-6">
          Design, Validate, and Optimize Websites with{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Measurable Evidence.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-zinc-400 max-w-3xl mb-10 leading-relaxed">
          ProofUI bridges generative AI, visual canvas editing, and objective user telemetry. 
          Stop guessing conversion bottlenecks—let multimodal LLMs identify guideline flaws while retaining full human control.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <Button
            size="lg"
            onClick={() => onLaunchEditor()}
            className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xl shadow-indigo-600/25 gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Launch Canvas Editor</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              if (currentUser) {
                setShowDashboardDialog(true);
              } else {
                setShowAuthDialog(true);
              }
            }}
            className="h-12 px-8 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 text-sm gap-2"
          >
            <FolderKanban className="w-4 h-4 text-indigo-400" />
            <span>Manage Projects</span>
          </Button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-left mb-20">
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur hover:border-zinc-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <MousePointerClick className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-base mb-2">Visual Canvas & Resizing</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Standard presets (1440px desktop, tablet, mobile), 1px precision stepper controls, and real-time contentEditable text updates.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur hover:border-zinc-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-base mb-2">Multimodal AI Engine</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Generate pages and components via Google Vertex AI (Gemini 2.5 Flash), Google AI Studio, or Qwen with SSE streaming progress.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur hover:border-zinc-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-base mb-2">Evidence-Based UX Analyzer</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Evaluates visual hierarchy, color contrast, tap target sizing, and Nielsen heuristics with quantitative diagnostic scores.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur hover:border-zinc-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <FlaskConical className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-base mb-2">A/B Testing & Production</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Split traffic across Control vs Challenger variants, calculate statistical p-values, and promote winners with 1-click deploy.
            </p>
          </div>
        </div>

        {/* Closed-Loop Research Workflow Banner */}
        <div className="w-full rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/60 to-zinc-950 p-8 sm:p-12 text-left relative overflow-hidden">
          <div className="max-w-3xl">
            <Badge className="bg-indigo-600 text-white mb-4 text-xs font-semibold">
              Closed-Loop Workflow
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Human-in-the-Loop Design Iteration
            </h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              AI suggests heuristic improvements based on objective metrics. The human designer retains full sovereignty to inspect side-by-side diffs, adjust Tailwind styles via the inspector, and decide what gets published.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Extract & Inspect</div>
                  <div className="text-[11px] text-zinc-400">Import DOM and design tokens</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Evidence Diagnosis</div>
                  <div className="text-[11px] text-zinc-400">Heuristic scores & heatmaps</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Review & Promote</div>
                  <div className="text-[11px] text-zinc-400">A/B validation before release</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-8 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            ProofUI © 2026 — Senior Project Advisor: <strong>Dr. Santawat Thanyadit</strong>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/Tachapol/ProofUI" target="_blank" rel="noreferrer" className="hover:text-zinc-300 transition-colors">
              GitHub
            </a>
            <button onClick={() => onLaunchEditor()} className="hover:text-zinc-300 transition-colors cursor-pointer">
              Launch Editor
            </button>
          </div>
        </div>
      </footer>

      {/* Auth Dialog */}
      <AuthDialog
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          setShowDashboardDialog(true);
        }}
      />

      {/* Project Dashboard Dialog */}
      <ProjectDashboardDialog
        isOpen={showDashboardDialog}
        onClose={() => setShowDashboardDialog(false)}
        onSelectProject={(id) => {
          setShowDashboardDialog(false);
          onLaunchEditor(id);
        }}
      />
    </div>
  );
}
