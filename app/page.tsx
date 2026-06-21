"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarDays, Dumbbell, History, Settings2, TrendingUp } from "lucide-react";
import { MobileShell, TopAccent } from "@/components/mobile-shell";
import { Card } from "@/components/ui";
import { useAppStore } from "@/hooks/use-app-store";
import { appSummary, latestSession, previousSessionWithSameRoutine, compareSessions, weekComparison } from "@/utils/analytics";
import { formatDateTime, formatDuration, formatVolume, toIsoDateOnly } from "@/utils/format";

export default function DashboardPage() {
  const { state } = useAppStore();
  const summary = appSummary(state);
  const currentWeek = weekComparison(state.sessions);
  const lastSession = latestSession(state.sessions);
  const previous = lastSession ? previousSessionWithSameRoutine(lastSession, state.sessions) : undefined;
  const comparison = lastSession ? compareSessions(lastSession, previous) : null;
  const activeRoutine = state.routines.find((routine) => routine.id === state.settings.activeRoutineId) ?? state.routines[0];

  const miniCards = useMemo(() => ([
    { label: "Rutinas", value: `${state.routines.length}` },
    { label: "Sesiones", value: `${state.sessions.length}` },
    { label: "Metas", value: `${state.goals.filter((goal) => !goal.completed).length}` },
  ]), [state.goals, state.routines.length, state.sessions.length]);

  const sessionDays = useMemo(() => new Set(state.sessions.map((session) => toIsoDateOnly(session.startedAt))), [state.sessions]);

  const currentStreak = useMemo(() => {
    if (!state.sessions.length) return 0;
    const latestTime = Math.max(...state.sessions.map((session) => new Date(session.startedAt).getTime()));
    if (!Number.isFinite(latestTime)) return 0;
    const cursor = new Date(latestTime);
    cursor.setHours(0, 0, 0, 0);
    let count = 0;
    while (sessionDays.has(toIsoDateOnly(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [sessionDays, state.sessions]);

  const recentDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (13 - index));
      return {
        label: date.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", ""),
        iso: toIsoDateOnly(date),
        active: sessionDays.has(toIsoDateOnly(date)),
      };
    });
  }, [sessionDays]);

  return (
    <MobileShell active="/">
      <div className="flex-1 overflow-y-auto pb-28 scrollbar-hide">
        <TopAccent
          subtitle="Resumen"
          title="WorldFit"
          right={
            <Link href="/settings" className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface-2 text-muted-foreground">
              <Settings2 className="h-4 w-4" />
            </Link>
          }
        />

        <div className="px-5">
          <div className="grid grid-cols-3 gap-3">
            {miniCards.map((item) => (
              <Card key={item.label} className="p-4 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
                <div className="mt-2 text-lg font-bold">{item.value}</div>
              </Card>
            ))}
          </div>

          <Card className="mt-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rutina activa</div>
                <div className="mt-1 text-xl font-bold">{activeRoutine?.name ?? "Sin rutina"}</div>
                <div className="mt-1 text-sm text-muted-foreground">{activeRoutine?.description ?? "Crea una rutina y selecciónala desde la pestaña Rutinas."}</div>
              </div>
              <Link href="/routines" className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold">
                Ver
              </Link>
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Esta semana</div>
                <div className="mt-1 text-2xl font-bold">{currentWeek.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {state.sessions.length ? "Compara tu volumen contra la semana anterior." : "Todavía no hay entrenamientos para comparar."}
                </div>
              </div>
              <div className="rounded-full border border-border bg-surface-2 p-3 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <MiniStat
                label="Volumen"
                value={formatVolume(currentWeek.volume.current, state.settings.units)}
                sub={comparison ? `${comparison.volumeDelta >= 0 ? "+" : ""}${formatVolume(Math.abs(comparison.volumeDelta), state.settings.units)}` : "Sin datos"}
              />
              <MiniStat label="Reps" value={`${currentWeek.reps.current}`} sub={state.sessions.length ? `${currentWeek.reps.delta >= 0 ? "+" : ""}${currentWeek.reps.delta}` : "Sin datos"} />
              <MiniStat label="Series" value={`${currentWeek.sets.current}`} sub={state.sessions.length ? `${currentWeek.sets.delta >= 0 ? "+" : ""}${currentWeek.sets.delta}` : "Sin datos"} />
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Racha de entrenamiento</div>
                <div className="mt-1 text-2xl font-bold">{currentStreak} {currentStreak === 1 ? "día" : "días"}</div>
                <div className="mt-1 text-sm text-muted-foreground">Entrenamientos consecutivos en tu secuencia más reciente.</div>
              </div>
              <div className="rounded-full border border-border bg-surface-2 p-3 text-secondary">
                <CalendarDays className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${recentDays.length}, minmax(0, 1fr))` }}>
              {recentDays.map((day) => (
                <div key={day.iso} className="flex flex-col items-center gap-2">
                  <div className={`h-3 w-3 rounded-full border ${day.active ? "border-primary bg-primary" : "border-border bg-surface-2"}`} aria-label={day.active ? "Día con entrenamiento" : "Día sin entrenamiento"} />
                  <div className="text-[10px] font-medium text-muted-foreground">{day.label}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/register" className="rounded-2xl border border-[rgba(255,179,181,0.30)] bg-[rgba(255,179,181,0.10)] p-4 shadow-soft">
              <Dumbbell className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-semibold">Iniciar rutina</div>
              <div className="mt-1 text-xs text-muted-foreground">Abre tu pantalla visual de rutina</div>
            </Link>
            <Link href="/history" className="rounded-2xl border border-border bg-surface-2 p-4">
              <History className="h-5 w-5 text-secondary" />
              <div className="mt-3 text-sm font-semibold">Historial</div>
              <div className="mt-1 text-xs text-muted-foreground">Sesiones y comparaciones</div>
            </Link>
            <Link href="/stats" className="rounded-2xl border border-border bg-surface-2 p-4">
              <TrendingUp className="h-5 w-5 text-success" />
              <div className="mt-3 text-sm font-semibold">Progreso</div>
              <div className="mt-1 text-xs text-muted-foreground">Tendencias y volumen</div>
            </Link>
            <Link href="/goals" className="rounded-2xl border border-border bg-surface-2 p-4">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-semibold">Metas</div>
              <div className="mt-1 text-xs text-muted-foreground">Objetivos y avance</div>
            </Link>
          </div>

          <Card className="mt-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Última sesión</div>
                <div className="mt-1 text-lg font-semibold">{lastSession?.title ?? "Todavía no has registrado nada"}</div>
                <div className="mt-1 text-sm text-muted-foreground">{lastSession ? formatDateTime(lastSession.startedAt) : "Tu entrenamiento se guarda localmente."}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-primary">{lastSession ? formatDuration(lastSession.durationMinutes) : "--"}</div>
                <div className="text-sm text-muted-foreground">{lastSession ? formatVolume(lastSession.entries.reduce((a, e) => a + e.weight * e.reps * e.sets, 0), state.settings.units) : "--"}</div>
              </div>
            </div>
            {comparison ? (
              <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-surface-2 p-3 text-xs text-muted-foreground">
                <div>Volumen {comparison.volumeDelta >= 0 ? "+" : ""}{formatVolume(Math.abs(comparison.volumeDelta), state.settings.units)}</div>
                <div>Reps {comparison.repsDelta >= 0 ? "+" : ""}{comparison.repsDelta}</div>
                <div>1RM {comparison.best1rmDelta >= 0 ? "+" : ""}{Math.round(Math.abs(comparison.best1rmDelta))}</div>
              </div>
            ) : null}
          </Card>

          {summary.latestPR && summary.latestPR !== "Sin récord reciente" ? (
            <Card className="mt-4 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Último récord</div>
              <div className="mt-1 text-lg font-semibold">{summary.latestPR}</div>
              <div className="mt-1 text-sm text-muted-foreground">{summary.trendLabel}</div>
            </Card>
          ) : null}
        </div>
      </div>
    </MobileShell>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
