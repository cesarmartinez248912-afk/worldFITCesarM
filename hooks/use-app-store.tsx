"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppSettings, AppState, Goal, MuscleGroup, RoutineTemplate, WorkoutSession } from "@/types";
import { createId } from "@/utils/id";
import { loadOrSeedState, saveState } from "@/storage/idb";
import { seededState } from "@/storage/seed";

type RoutineInput = Omit<RoutineTemplate, "id" | "createdAt" | "updatedAt"> & { id?: string };

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
      setState((current) => ({
        ...current,
        sessions: [{ ...session, id: createId("sess") }, ...current.sessions],
        lastUpdated: new Date().toISOString()
      }));
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
        const nextRoutine = {
          id,
          name: routine.name.trim() || "Rutina nueva",
          description: routine.description.trim() || "Rutina personalizada",
          items: routine.items.map((item) => ({ ...item, id: item.id || createId("ri") })).sort((a, b) => a.order - b.order),
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
        const fallback = current.settings.activeRoutineId === id ? routines[0]?.id : current.settings.activeRoutineId;
        return {
          ...current,
          routines,
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
