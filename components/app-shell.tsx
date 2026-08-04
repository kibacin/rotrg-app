import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function AppPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 pb-8 pt-5 sm:px-6 sm:pt-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  icon: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/20 to-blue-500/10 text-cyan-300 shadow-[0_12px_40px_rgba(34,211,238,0.12)]">
          <Icon size={23} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/75">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

export function LoadingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[65vh] items-center justify-center px-4">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span className="size-5 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
        {label}
      </div>
    </div>
  );
}
