import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, Dumbbell, History, Home, Settings, TimerReset } from "lucide-react";
import { cn } from "@/utils/cn";

const items = [
  { href: "/", label: "Resumen", icon: Home },
  { href: "/history", label: "Historial", icon: History },
  { href: "/register", label: "Registrar", icon: Dumbbell, center: true },
  { href: "/routines", label: "Rutinas", icon: TimerReset },
  { href: "/stats", label: "Progreso", icon: BarChart3 }
];

export function MobileShell({
  children,
  active = "/",
  showNav = true,
}: {
  children: ReactNode;
  active?: string;
  showNav?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col overflow-hidden bg-background text-foreground shadow-2xl">
      {children}
      {showNav ? (
        <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-border/60 bg-background/70 px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 backdrop-blur-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.22)]">
          <div className="grid grid-cols-5 items-end gap-2">
            {items.map(({ href, label, icon: Icon, center }) => {
              const activeState = active === href || (href !== "/" && active.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition",
                    center
                      ? "mx-auto -mt-8 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-glow"
                      : activeState
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  <Icon className={cn(center ? "h-6 w-6" : "h-5 w-5", activeState && !center ? "text-primary" : "")} />
                  {!center ? <span>{label}</span> : null}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

export function TopAccent({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-6">
      <div>
        <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{subtitle}</div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function PageFrame({
  children,
  active = "/",
  showNav = true,
  className,
}: {
  children: ReactNode;
  active?: string;
  showNav?: boolean;
  className?: string;
}) {
  return (
    <MobileShell active={active} showNav={showNav}>
      <div className={cn("flex-1", className)}>{children}</div>
    </MobileShell>
  );
}
