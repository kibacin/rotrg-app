"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings2, UserRound } from "lucide-react";

export function ProfileMenu({
  displayName,
  onSignOut,
}: {
  displayName: string;
  onSignOut: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  };

  return (
    <div ref={menuRef} className="relative z-30 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
        className="flex items-center gap-1.5 rounded-2xl border border-cyan-200/15 bg-cyan-300/10 p-1.5 pr-2 text-cyan-200 transition hover:border-cyan-200/25 hover:bg-cyan-300/15"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-cyan-300/10 text-sm font-bold uppercase">
          {displayName.charAt(0)}
        </span>
        <ChevronDown
          size={15}
          className={`transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.6rem)] w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1521]/98 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        >
          <div className="border-b border-white/7 px-3 py-2.5">
            <p className="truncate text-xs font-semibold text-white">{displayName}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
              <UserRound size={11} /> ROTRG account
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push("/settings");
            }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <Settings2 size={16} className="text-cyan-300" />
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-400 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
          >
            <LogOut size={16} />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
