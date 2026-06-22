"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppSettings, AppState, Goal, MuscleGroup, RoutineTemplate, ScheduledDay, WeekDay, WeekSchedule, WorkoutSession } from "@/types";
import { createId } from "@/utils/id";
import { buildWeekSchedule, getLocalWeekDay, getLocalWeekStart } from "@/utils/schedule";
import { loadOrSeedState, saveState } from "@/storage/idb";
import { seededState } from "@/storage/seed";

type RoutineInput = Omit<RoutineTemplate, "id" | "createdAt" | "updatedAt"> & { id?: string };

type WeekScheduleInput = Omit<WeekSchedule, "id" | "createdAt"> & { id?: string };

type StoreContextValue = {
  state: AppState;
  ready: boolean;
  addExercise: (name: string, muscleGroup: MuscleGroup) => void;
  addSession: (session: Omit<WorkoutSession, "id">) => void;
  deleteSession: (id: string) => void;
  addGoal: (goal: Omit<Goal, "id" | "createdAt" | "completed">) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  upsertRoutine: (routine: RoutineInput) => string;
  deleteRoutine: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  upsertWeekSchedule: (schedule: WeekScheduleInput) => string;
  updateScheduledDay: (scheduleId: string, weekDay: WeekDay, patch: Partial<ScheduledDay>) => void;
  markDayMissed: (scheduleId: string, weekDay: WeekDay) => void;
  markDaySkipped: (scheduleId: string, weekDay: WeekDay) => void;
  resetData: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function withDefaults(state: AppState): AppState {
  const routines = state.routines?.length ? state.routines : seededState.routines;
  const activeRoutineId =
    state.settings?.activeRoutineId && routines.some((routine) => routine.id === state.settings.activeRoutineId)
      ? state.settings.activeRoutineId
      : routines[0]?.id;
  return {
    ...seededState,
    ...state,
    settings: { ...seededState.settings, ...state.settings, activeRoutineId },
    exercises: state.exercises?.length ? state.exercises : seededState.exercises,
    routines,
    sessions: state.sessions ?? [],
    goals: state.goals ?? [],
    weekSchedules: state.weekSchedules ?? [],
  };
}

function mergeScheduleDays(existing: WeekSchedule, next: WeekScheduleInput): ScheduledDay[] {
  const existingByWeekDay = new Map(existing.days.map((day) => [day.weekDay, day] as const));
  return next.days.map((day) => {
    const current = existingByWeekDay.get(day.weekDay);
    if (!current) return { ...day };
    return {
      ...day,
      ...current,
      routineDay: day.routineDay,
    };
  });
}

function applyScheduledDayPatch(current: AppState, scheduleId: string, weekDay: WeekDay, patch: Partial<ScheduledDay>): AppState {
  return {
    ...current,
    weekSchedules: current.weekSchedules.map((schedule) => {
      if (schedule.id !== scheduleId) return schedule;
      const found = schedule.days.some((day) => day.weekDay === weekDay);
      if (!found) return schedule;
      return {
        ...schedule,
        days: schedule.days.map((day) => (day.weekDay === weekDay ? { ...day, ...patch } : day))
      };
    }),
    lastUpdated: new Date().toISOString()
  };
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(seededState);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    loadOrSeedState()
      .then((loaded) => {
        setState(withDefaults(loaded));
        setReady(true);
      })
      .catch(() => {
        setState(seededState);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveState({ ...state, lastUpdated: new Date().toISOString() }).catch(() => {});
    }, 180);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state, ready]);

  const api = useMemo<StoreContextValue>(() => ({
    state,
    ready,
    addExercise: (name, muscleGroup) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setState((current) => {
        if (current.exercises.some((exercise) => exercise.name.toLowerCase() === trimmed.toLowerCase())) return current;
        return {
          ...current,
          exercises: [...current.exercises, { id: createId("ex"), name: trimmed, muscleGroup, createdAt: new Date().toISOString(), isCustom: true }],
          lastUpdated: new Date().toISOString()
        };
      });
    },
    addSession: (session) => {
      const sessionId = createId("sess");
      const now = new Date().toISOString();
      setState((current) => {
        const nextSession = { ...session, id: sessionId };
        const startedAt = new Date(session.startedAt);
        const sessionWeekStart = session.routineId ? getLocalWeekStart(startedAt) : null;
        const sessionWeekDay = session.routineId ? getLocalWeekDay(startedAt) : null;
        const weekSchedules = session.routineId && sessionWeekStart && sessionWeekDay
          ? current.weekSchedules.map((schedule) => {
              if (schedule.routineId !== session.routineId || schedule.weekStart !== sessionWeekStart) return schedule;
              const matched = schedule.days.some((day) => day.weekDay === sessionWeekDay);
              if (!matched) return schedule;
              return {
                ...schedule,
                days: schedule.days.map((day) => (
                  day.weekDay === sessionWeekDay
                    ? { ...day, status: "done" as const, sessionId, missedAt: undefined }
                    : day
                ))
              };
            })
          : current.weekSchedules;

        return {
          ...current,
          sessions: [nextSession, ...current.sessions],
          weekSchedules,
          lastUpdated: now
        };
      });
    },
    deleteSession: (id) => {
      setState((current) => ({
        ...current,
        sessions: current.sessions.filter((session) => session.id !== id),
        lastUpdated: new Date().toISOString()
      }));
    },
    addGoal: (goal) => {
      setState((current) => ({
        ...current,
        goals: [{ ...goal, id: createId("goal"), createdAt: new Date().toISOString(), completed: false }, ...current.goals],
        lastUpdated: new Date().toISOString()
      }));
    },
    updateGoal: (id, patch) => {
      setState((current) => ({
        ...current,
        goals: current.goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)),
        lastUpdated: new Date().toISOString()
      }));
    },
    deleteGoal: (id) => {
      setState((current) => ({
        ...current,
        goals: current.goals.filter((goal) => goal.id !== id),
        lastUpdated: new Date().toISOString()
      }));
    },
    upsertRoutine: (routine) => {
      const id = routine.id ?? createId("rt");
      const now = new Date().toISOString();
      setState((current) => {
        const exists = current.routines.some((item) => item.id === id);
        const previous = current.routines.find((item) => item.id === id);
        const nextRoutine: RoutineTemplate = {
          id,
          name: routine.name.trim() || "Rutina nueva",
          description: routine.description.trim() || "Rutina personalizada",
          items: routine.items.map((item) => {
            const alternateExercises = (item.alternateExercises ?? [])
              .map((exercise) => exercise.trim())
              .filter((exercise): exercise is string => Boolean(exercise));
            return {
              id: item.id || createId("ri"),
              dayLabel: item.dayLabel,
              exerciseName: item.exerciseName,
              muscleGroup: item.muscleGroup,
              reps: item.reps,
              sets: item.sets,
              restSeconds: item.restSeconds,
              order: item.order,
              notes: item.notes,
              alternateExercises: alternateExercises.length ? alternateExercises : undefined,
            };
          }).sort((a, b) => a.order - b.order),
          scheduledWeekDays: routine.scheduledWeekDays && Object.keys(routine.scheduledWeekDays).length ? { ...routine.scheduledWeekDays } : undefined,
          createdAt: exists ? previous?.createdAt ?? now : now,
          updatedAt: now
        };
        return {
          ...current,
          routines: exists ? current.routines.map((item) => (item.id === id ? nextRoutine : item)) : [nextRoutine, ...current.routines],
          settings: {
            ...current.settings,
            activeRoutineId: current.settings.activeRoutineId ?? id
          },
          lastUpdated: now
        };
      });
      return id;
    },
    deleteRoutine: (id) => {
      setState((current) => {
        const routines = current.routines.filter((routine) => routine.id !== id);
        const weekSchedules = current.weekSchedules.filter((schedule) => schedule.routineId !== id);
        const fallback = current.settings.activeRoutineId === id ? routines[0]?.id : current.settings.activeRoutineId;
        return {
          ...current,
          routines,
          weekSchedules,
          settings: { ...current.settings, activeRoutineId: fallback },
          lastUpdated: new Date().toISOString()
        };
      });
    },
    updateSettings: (patch) => {
      setState((current) => ({
        ...current,
        settings: { ...current.settings, ...patch },
        lastUpdated: new Date().toISOString()
      }));
    },
    upsertWeekSchedule: (schedule) => {
      let finalId = createId("ws");
      setState((current) => {
        const existing = current.weekSchedules.find((item) => item.routineId === schedule.routineId && item.weekStart === schedule.weekStart);
        if (existing) {
          finalId = existing.id;
          return {
            ...current,
            weekSchedules: current.weekSchedules.map((item) => (
              item.id === existing.id
                ? {
                    ...item,
                    routineId: schedule.routineId,
                    weekStart: schedule.weekStart,
                    days: mergeScheduleDays(item, schedule),
                  }
                : item
            )),
            lastUpdated: new Date().toISOString()
          };
        }
        return {
          ...current,
          weekSchedules: [
            {
              id: finalId,
              routineId: schedule.routineId,
              weekStart: schedule.weekStart,
              days: schedule.days.map((day) => ({ ...day })),
              createdAt: new Date().toISOString()
            },
            ...current.weekSchedules
          ],
          lastUpdated: new Date().toISOString()
        };
      });
      return finalId;
    },
    updateScheduledDay: (scheduleId, weekDay, patch) => {
      setState((current) => applyScheduledDayPatch(current, scheduleId, weekDay, patch));
    },
    markDayMissed: (scheduleId, weekDay) => {
      setState((current) => applyScheduledDayPatch(current, scheduleId, weekDay, { status: "missed", missedAt: new Date().toISOString() }));
    },
    markDaySkipped: (scheduleId, weekDay) => {
      setState((current) => applyScheduledDayPatch(current, scheduleId, weekDay, { status: "skipped" }));
    },
    resetData: () => {
      setState({ ...seededState, lastUpdated: new Date().toISOString() });
    }
  }), [state, ready]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useAppStore debe usarse dentro de AppStoreProvider");
  return ctx;
}
