import type { ReactNode } from "react";
import { NexoMark, NexoWordmark } from "@/components/brand/NexoMark";

type AuthShellProps = {
  title: string;
  subtitle: string;
  intro?: ReactNode;
  children: ReactNode;
};

export function AuthShell({ title, subtitle, intro, children }: AuthShellProps) {
  return (
    <main id="main-content" className="auth-shell">
      <div className="auth-card">
        <div className="mb-6 flex items-center gap-3">
          <NexoMark className="h-12 w-12" />
          <div className="min-w-0">
            <p className="text-2xl leading-none">
              <NexoWordmark />
            </p>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        <h1 className="sr-only">{title}</h1>
        {intro ? (
          <div className="rounded-xl border border-border bg-accent-muted/70 px-4 py-3 text-sm leading-6 text-slate-600">
            {intro}
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}
