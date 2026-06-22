"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { MobileShell, TopAccent } from "@/components/mobile-shell";
import { Button, Card, SelectField } from "@/components/ui";
import { useAppStore } from "@/hooks/use-app-store";
import { formatDuration } from "@/utils/format";
import {
  WEEK_DAYS,
  buildWeekSchedule,
  getLocalDateString,
  getLocalWeekStart,
  missedMuscleGroups,
  sortScheduleDays
} from "@/utils/schedule";
import type { ScheduledDay, WeekSchedule } from "@/types";

function addDaysToLocalDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function formatDayLabel(dateString: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(`${dateString}T12:00:00`));
}

function statusBadge(status: ScheduledDay["status"] | "rest") {
  switch (status) {
    case "done":
      return { label: "Completado ✓", className: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
    case "missed":
      return { label: "No entrenado", className: "border border-red-500/30 bg-red-500/10 text-red-300" };
    case "skipped":
      return { label: "Omitido", className: "border border-amber-500/30 bg-amber-500/10 text-amber-300" };
    case "pending":
      return { label: "Pendiente", className: "border border-border bg-surface-2 text-muted-foreground" };
    default:
      return { label: "Descanso 🛌", className: "border border-border bg-surface-2 text-muted-foreground" };
  }
}

export default function SchedulePage() {
  const { state, updateSettings, upsertWeekSchedule, markDayMissed, markDaySkipped } = useAppStore();

  const activeRoutineId = state.settings.activeRoutineId && state.routines.some((routine) => routine.id === state.settings.activeRoutineId)
    ? state.settings.activeRoutineId
    : state.routines[0]?.id ?? "";
  const activeRoutine = state.routines.find((routine) => routine.id === activeRoutineId) ?? null;
  const weekStart = getLocalWeekStart();
  const todayDate = getLocalDateString();
  const assignedWeekDays = activeRoutine?.scheduledWeekDays ?? {};
  const hasAssignedDays = Object.keys(assignedWeekDays).length > 0;

  const schedule = useMemo(
    () => state.weekSchedules.find((item) => item.routineId === activeRoutineId && item.weekStart === weekStart) ?? null,
    [state.weekSchedules, activeRoutineId, weekStart]
  );

  const displaySchedule = schedule ?? (activeRoutine && hasAssignedDays
    ? ({
        id: "",
        routineId: activeRoutine.id,
        weekStart,
        days: sortScheduleDays(buildWeekSchedule(activeRoutine, weekStart).days),
        createdAt: ""
      } as WeekSchedule)
    : null);

  const orderedScheduleDays = sortScheduleDays(displaySchedule?.days ?? []);
  const scheduleDaysByWeekDay = useMemo(() => new Map(orderedScheduleDays.map((day) => [day.weekDay, day] as const)), [orderedScheduleDays]);

  useEffect(() => {
    if (!activeRoutine || !hasAssignedDays) return;
    if (schedule) return;
    upsertWeekSchedule(buildWeekSchedule(activeRoutine, weekStart));
  }, [activeRoutine?.id, hasAssignedDays, schedule?.id, upsertWeekSchedule, weekStart]);

  const routineOptions = state.routines;

  return (
    <MobileShell active="/schedule">
      <div className="flex-1 overflow-y-auto pb-28 scrollbar-hide">
        <TopAccent
          subtitle="Semana"
          title="Calendario"
          right={
            <div className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface-2 text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
          }
        />

        <div className="px-5">
          <Card className="p-4">
            <SelectField
              label="Rutina activa"
              value={activeRoutineId}
              onChange={(e) => updateSettings({ activeRoutineId: e.target.value })}
              disabled={!routineOptions.length}
            >
              {routineOptions.length ? (
                routineOptions.map((routine) => (
                  <option key={routine.id} value={routine.id}>
                    {routine.name}
                  </option>
                ))
              ) : (
                <option value="">No hay rutinas creadas</option>
              )}
            </SelectField>
          </Card>

          {!activeRoutine || !hasAssignedDays ? (
            <Card className="mt-4 p-4">
              <div className="text-sm font-semibold">Esta rutina no tiene días de la semana asignados. Ve a Rutinas y asigna cada bloque a un día.</div>
              <Link href="/routines" className="mt-4 inline-flex rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold">
                Ir a Rutinas
              </Link>
            </Card>
          ) : (
            <>
              <div className="mt-4 grid gap-3">
                {WEEK_DAYS.map((weekDay, index) => {
                  const dayDate = addDaysToLocalDateString(weekStart, index);
                  const scheduledDay = scheduleDaysByWeekDay.get(weekDay);
                  const isRestDay = !scheduledDay;
                  const isTodayOrPast = dayDate <= todayDate;
                  const dayMuscleGroups = scheduledDay
                    ? [...new Set(activeRoutine.items.filter((item) => item.dayLabel === scheduledDay.routineDay).map((item) => item.muscleGroup))]
                    : [];
                  const session = scheduledDay?.status === "done" && scheduledDay.sessionId
                    ? state.sessions.find((entry) => entry.id === scheduledDay.sessionId)
                    : undefined;

                  return (
                    <Card key={weekDay} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold">{weekDay}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{formatDayLabel(dayDate)}</div>
                        </div>
                        <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusBadge(scheduledDay?.status ?? "rest").className}`}>
                          {statusBadge(scheduledDay?.status ?? "rest").label}
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3">
                        {isRestDay ? (
                          <div className="text-sm text-muted-foreground">Descanso programado para este día.</div>
                        ) : (
                          <>
                            <div className="text-sm font-semibold">{scheduledDay?.routineDay}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {dayMuscleGroups.length ? dayMuscleGroups.join(" · ") : "Sin grupos musculares asignados"}
                            </div>

                            {session ? (
                              <div className="mt-3 rounded-2xl border border-border bg-surface px-3 py-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sesión completada</div>
                                <div className="mt-1 text-sm font-semibold">{session.title}</div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {formatDuration(session.durationMinutes)}
                                </div>
                              </div>
                            ) : null}

                            {schedule?.id && isTodayOrPast && (scheduledDay?.status === "pending" || scheduledDay?.status === "missed") ? (
                              <div className="mt-4 flex gap-2">
                                <Button
                                  variant="secondary"
                                  className="flex-1"
                                  onClick={() => markDayMissed(schedule.id, weekDay)}
                                >
                                  Marcar como no entrenado
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="flex-1 border border-border bg-surface-2"
                                  onClick={() => markDaySkipped(schedule.id, weekDay)}
                                >
                                  Omitir
                                </Button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>

                      {scheduledDay && scheduledDay.status === "done" && !session ? (
                        <div className="mt-3 rounded-2xl border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
                          Se marcó como completado, pero la sesión original ya no está disponible.
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </div>

              {displaySchedule?.days.some((day) => day.status === "missed") ? (
                <Card className="mt-4 p-4">
                  <div className="text-sm font-semibold">Músculos sin entrenar esta semana: {missedMuscleGroups(displaySchedule as WeekSchedule, activeRoutine).join(", ") || "Ninguno"}</div>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
