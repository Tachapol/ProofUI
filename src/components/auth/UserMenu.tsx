"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { User, LogOut } from "lucide-react";

interface UserMenuProps {
  user: { id: string; email: string; name: string } | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function UserMenu({ user, onOpenAuth, onLogout }: UserMenuProps) {
  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenAuth}
        data-testid="btn-open-auth"
        className="gap-1.5 text-xs font-medium border-zinc-200 dark:border-zinc-800"
      >
        <User className="w-3.5 h-3.5 text-indigo-500" />
        <span>Sign In</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="user-account-menu">
      <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
        <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
          {user.name[0]?.toUpperCase() || "U"}
        </div>
        <span className="font-medium max-w-[100px] truncate">{user.name}</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onLogout}
        title="Sign Out"
        data-testid="btn-user-logout"
        className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
