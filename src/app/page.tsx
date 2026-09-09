"use client";

import { useState, useEffect } from "react";
import { EditorShell } from "@/components/editor/EditorShell";
import { WelcomeLandingView } from "@/components/welcome/WelcomeLandingView";

export default function Home() {
  const [activeView, setActiveView] = useState<"welcome" | "editor">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get("view") === "editor" ||
        window.localStorage.getItem("proofui_last_view") === "editor" ||
        process.env.NEXT_PUBLIC_E2E === "true" ||
        document.cookie.includes("proofui_e2e=true")
      ) {
        return "editor";
      }
    }
    return "welcome";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "editor") {
        setActiveView("editor");
      }
    }
  }, []);

  const handleLaunchEditor = () => {
    setActiveView("editor");
    if (typeof window !== "undefined") {
      window.localStorage.setItem("proofui_last_view", "editor");
      window.history.replaceState(null, "", "?view=editor");
    }
  };

  const handleReturnWelcome = () => {
    setActiveView("welcome");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("proofui_last_view");
      window.history.replaceState(null, "", "/");
    }
  };

  if (activeView === "welcome") {
    return <WelcomeLandingView onLaunchEditor={handleLaunchEditor} />;
  }

  return <EditorShell onOpenWelcome={handleReturnWelcome} />;
}
