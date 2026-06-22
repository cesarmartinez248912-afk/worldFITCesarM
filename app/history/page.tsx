"use client";

import { useMemo, useState } from "react";
import { Trash2, GitCompare, Award } from "lucide-react";
import { MobileShell, TopAccent } from "@/components/mobile-shell";
import { Card, Field } from "@/components/ui";
import { useAppStore } from "@/hooks/use-app-store";
import { compareSessions, previousSessionWithSameRoutine, sessionVolume, sessionReps, sessionSets, sortSessionsNewestFirst } from "@/utils/analytics";
import { formatDateLabel, formatDateTime, formatDuration, formatVolume, formatKg } from "@/utils/format";

export default function HistoryPage() {
  const { state, deleteSession } = useAppStore();
  const [query, setQuery] = useState("");

  const sessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = sortSessionsNewestFirst(state.sessions);
    return sorted.filter((session) => {
      if (!normalized) return true;
      const haystack = [
        session.title,
        session.routineName,
        session.routineDay,
        session.startedAt,
        ...session.entries.map((entry) => `${entry.exerciseName} ${entry.muscleGroup}`)
      ].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [state.sessions, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    sessions.forEach((session) => {
      const label = new Date(session.startedAt).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
      if (!map.has(label)) map.set(label, []);
      map.get(label)?.push(session);
    });
    return [...map.entries()];
  }, [sessions]);

  return (
    <MobileShell active="/history">
      <div className="flex-1 overflow-y-auto pb-28 scrollbar-hide">
        <TopAccent subtitle="Historial" title="Sesiones" />
        <div className="px-5">
          <Field label="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ejercicio, rutina o fecha" />

          <div className="mt-4 space-y-5">
            {grouped.map(([label, items]) => (
              <div key={label}>
                <div className="mb-2 text-sm font-semibold text-muted-foreground">{label}</div>
                <div className="space-y-3">
                  {items.map((session) => {
                    const previous = previousSessionWithSameRoutine(session, state.sessions);
                    const compare = compareSessions(session, previous);
                    const hasPR = session.entries.some((entry) => entry.isPersonalRecord);
                    return (
                      <Card key={session.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{session.routineName ?? "Entrenamiento"}</div>
                              {hasPR ? (
                                <div className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,179,181,0.40)] bg-[rgba(255,179,181,0.12)] px-2 py-1 text-[10px] font-semibold text-primary">
                                  <Award className="h-3 w-3" />
                                  ¡Nuevo récord!
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-1 text-lg font-semibold">{session.title}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{formatDateTime(session.startedAt)} · {formatDuration(session.durationMinutes)}</div>
                          </div>
                          <button onClick={() => {
                            if (!window.confirm("¿Seguro que deseas borrar esta sesión? Esta acción no se puede deshacer.")) return;
                            deleteSession(session.id);
                          }} className="rounded-full border border-border bg-surface-2 p-2 text-muted-foreground">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                          <Stat label="Volumen" value={formatVolume(sessionVolume(session), state.settings.units)} />
                          <Stat label="Reps" value={`${sessionReps(session)}`} />
                          <Stat label="Series" value={`${sessionSets(session)}`} />
                        </div>

                        <div className="mt-4 space-y-2">
                          {session.entries.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold">{entry.exerciseName}</div>
                                  {entry.isPersonalRecord ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,179,181,0.40)] bg-[rgba(255,179,181,0.12)] px-2 py-0.5 text-[10px] font-semibold text-primary">
                                      <Award className="h-3 w-3" />
                                      PR
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-muted-foreground">{entry.muscleGroup}</div>
                              </div>
                              <div className="text-right text-muted-foreground">
                                {formatKg(entry.weight, state.settings.units)} · {entry.reps}x{entry.sets}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <GitCompare className="h-4 w-4 text-primary" />
                            Comparación
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                            <div>Volumen {compare.volumeDelta >= 0 ? "+" : ""}{formatVolume(Math.abs(compare.volumeDelta), state.settings.units)}</div>
                            <div>Reps {compare.repsDelta >= 0 ? "+" : ""}{compare.repsDelta}</div>
                            <div>1RM {compare.best1rmDelta >= 0 ? "+" : ""}{Math.round(Math.abs(compare.best1rmDelta))}</div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">{previous ? `vs. ${previous.title} · ${formatDateLabel(previous.startedAt)}` : "Sin sesión anterior para comparar"}</div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}

            {!sessions.length ? <Card className="p-4 text-sm text-muted-foreground">No hay sesiones registradas todavía.</Card> : null}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-bold">{value}</div>
    </div>
  );
}
