"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Dumbbell, Play, Plus, Save, Sparkles, TimerReset, Trash2 } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Button, Card, Field, SelectField } from "@/components/ui";
import { ModalTopBar } from "@/components/top-bar";
import { useAppStore } from "@/hooks/use-app-store";
import { createId } from "@/utils/id";
import type { MuscleGroup, WorkoutEntry, WorkoutSession } from "@/types";
import { compareSessions, estimateOneRepMax, previousSessionWithSameRoutine, sortSessionsNewestFirst } from "@/utils/analytics";
import { formatKg, formatVolume } from "@/utils/format";
import { getLocalISOString, getLocalWeekDay } from "@/utils/schedule";

const muscleGroups: MuscleGroup[] = ["Pecho", "Espalda", "Pierna", "Hombros", "Bíceps", "Tríceps", "Core", "Cardio", "Full Body", "Otro"];

type DraftEntry = WorkoutEntry & { order: number; alternateExercises?: string[] };

type RoutineDayPreview = {
  label: string;
  exercises: number;
  sets: number;
  restSeconds: number;
  items: { exerciseName: string; reps: number; sets: number; restSeconds?: number; alternateExercises?: string[] }[];
};

function getRoutineDays(routine?: { items: { dayLabel: string; order: number }[] }) {
  return [...new Set(routine?.items.slice().sort((a, b) => a.order - b.order).map((item) => item.dayLabel) ?? [])];
}

function nextRoutineDay(days: string[], lastDay?: string) {
  if (!days.length) return "Manual";
  if (!lastDay) return days[0];
  const index = days.indexOf(lastDay);
  if (index === -1) return days[0];
  return days[(index + 1) % days.length];
}

function buildDraftEntry(entry: {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  reps: number;
  sets: number;
  restSeconds?: number;
  notes?: string;
  alternateExercises?: string[];
}, order: number): DraftEntry {
  return {
    id: createId("entry"),
    exerciseId: createId("ex"),
    exerciseName: entry.exerciseName,
    muscleGroup: entry.muscleGroup,
    weight: 0,
    reps: entry.reps,
    sets: entry.sets,
    restSeconds: entry.restSeconds ?? 60,
    notes: entry.notes,
    alternateExercises: entry.alternateExercises?.length ? [...new Set(entry.alternateExercises)] : undefined,
    order,
  };
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function summarizeRoutineDay(label: string, items: { exerciseName: string; reps: number; sets: number; restSeconds?: number }[]): RoutineDayPreview {
  return {
    label,
    exercises: items.length,
    sets: items.reduce((sum, item) => sum + item.sets, 0),
    restSeconds: items.reduce((sum, item) => sum + (item.restSeconds ?? 60), 0),
    items,
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const { state, addSession, updateSettings } = useAppStore();
  const [selectedRoutineId, setSelectedRoutineId] = useState(state.settings.activeRoutineId ?? state.routines[0]?.id ?? "");
  const selectedRoutine = state.routines.find((routine) => routine.id === selectedRoutineId) ?? state.routines[0];
  const routineDays = useMemo(() => getRoutineDays(selectedRoutine), [selectedRoutine]);
  const lastRoutineSession = useMemo(
    () => sortSessionsNewestFirst(state.sessions).find((session) => session.routineId && session.routineId === selectedRoutine?.id),
    [selectedRoutine?.id, state.sessions]
  );

  const [selectedDay, setSelectedDay] = useState("Manual");
  const [title, setTitle] = useState(selectedRoutine ? `${selectedRoutine.name}` : "Entrenamiento libre");
  const [notes, setNotes] = useState("");
  const [startedAt, setStartedAt] = useState(getLocalISOString());
  const [startedAtKey, setStartedAtKey] = useState(0);
  const [exerciseName, setExerciseName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("Pecho");
  const [reps, setReps] = useState(8);
  const [sets, setSets] = useState(3);
  const [restSeconds, setRestSeconds] = useState(60);
  const [manualAlternateExercises, setManualAlternateExercises] = useState<string[]>([]);
  const [manualAlternateDraft, setManualAlternateDraft] = useState("");
  const [pendingEntries, setPendingEntries] = useState<DraftEntry[]>([]);
  const [completedEntries, setCompletedEntries] = useState<WorkoutEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [weightPromptOpen, setWeightPromptOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [restTimer, setRestTimer] = useState<{ secondsLeft: number; nextIndex: number; nextExerciseName: string; endsAt: number } | null>(null);
  const workoutStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!selectedRoutine) return;
    const suggested = nextRoutineDay(routineDays, lastRoutineSession?.routineDay);
    setSelectedDay(suggested);
    setTitle(`${selectedRoutine.name}${suggested && suggested !== "Manual" ? ` · ${suggested}` : ""}`);
  }, [selectedRoutineId, selectedRoutine?.id, routineDays.join("|"), lastRoutineSession?.routineDay]);

  useEffect(() => {
    if (!selectedRoutine) return;
    setTitle(`${selectedRoutine.name}${selectedDay && selectedDay !== "Manual" ? ` · ${selectedDay}` : ""}`);
  }, [selectedDay, selectedRoutine]);

  useEffect(() => {
    if (selectedRoutineId && selectedRoutineId !== state.settings.activeRoutineId) {
      updateSettings({ activeRoutineId: selectedRoutineId });
    }
  }, [selectedRoutineId, state.settings.activeRoutineId, updateSettings]);

  useEffect(() => {
    if (state.settings.activeRoutineId && state.settings.activeRoutineId !== selectedRoutineId) {
      setSelectedRoutineId(state.settings.activeRoutineId);
    }
  }, [state.settings.activeRoutineId]);

  const routineEntries = useMemo(() => {
    if (!selectedRoutine || selectedDay === "Manual") return [];
    return selectedRoutine.items
      .filter((item) => item.dayLabel === selectedDay)
      .sort((a, b) => a.order - b.order)
      .map((item) => ({ ...item, alternateExercises: item.alternateExercises?.length ? [...item.alternateExercises] : undefined }));
  }, [selectedRoutine, selectedDay]);

  const routinePreview = useMemo<RoutineDayPreview[]>(() => {
    if (!selectedRoutine) return [];
    const days = routineDays.length ? routineDays : [...new Set(selectedRoutine.items.map((item) => item.dayLabel))];
    return days.map((day) => {
      const items = selectedRoutine.items
        .filter((item) => item.dayLabel === day)
        .sort((a, b) => a.order - b.order)
        .map((item) => ({ ...item, alternateExercises: item.alternateExercises?.length ? [...item.alternateExercises] : undefined }));
      return summarizeRoutineDay(day, items);
    });
  }, [routineDays, selectedRoutine]);

  const currentExercise = pendingEntries[activeIndex] ?? null;
  const hasWorkoutStarted = pendingEntries.length > 0;

  const replaceCurrentExercise = (exerciseName: string) => {
    setPendingEntries((current) => current.map((entry, index) => (index === activeIndex ? { ...entry, exerciseName } : entry)));
  };

  const addManualAlternativeExercise = () => {
    const value = manualAlternateDraft.trim();
    if (!value) return;
    setManualAlternateExercises((current) => [...new Set([...current, value])]);
    setManualAlternateDraft("");
  };

  const removeManualAlternativeExercise = (exerciseNameToRemove: string) => {
    setManualAlternateExercises((current) => current.filter((entry) => entry !== exerciseNameToRemove));
  };


  const resetWorkout = () => {
    setPendingEntries([]);
    setCompletedEntries([]);
    setActiveIndex(0);
    setWeightPromptOpen(false);
    setWeightInput("");
    setManualAlternateExercises([]);
    setManualAlternateDraft("");
    workoutStartTimeRef.current = 0;
    setStartedAt(getLocalISOString());
    setStartedAtKey((current) => current + 1);
  };

  const importRoutine = () => {
    if (!selectedRoutine) return;

    const assignedWeekDays = Object.values(selectedRoutine.scheduledWeekDays ?? {}).filter(Boolean);
    let dayForImport = selectedDay;

    if (assignedWeekDays.length > 0) {
      const todayWeekDay = getLocalWeekDay();
      if (!assignedWeekDays.includes(todayWeekDay)) {
        const proceed = window.confirm(`Hoy es ${todayWeekDay}. Esta rutina está programada para: ${assignedWeekDays.join(", ")}. ¿Iniciar de todas formas?`);
        if (!proceed) return;
      } else {
        const matchedDayLabel = Object.entries(selectedRoutine.scheduledWeekDays ?? {}).find(([, weekDay]) => weekDay === todayWeekDay)?.[0];
        if (matchedDayLabel) {
          dayForImport = matchedDayLabel;
          setSelectedDay(matchedDayLabel);
        }
      }
    }

    const source = dayForImport !== "Manual"
      ? selectedRoutine.items.filter((item) => item.dayLabel === dayForImport).sort((a, b) => a.order - b.order)
      : selectedRoutine.items;

    workoutStartTimeRef.current = Date.now();
    const next = source.map((item, index) =>
      buildDraftEntry(
        {
          exerciseName: item.exerciseName,
          muscleGroup: item.muscleGroup,
          reps: item.reps,
          sets: item.sets,
          restSeconds: item.restSeconds,
          notes: item.notes,
          alternateExercises: item.alternateExercises,
        },
        index + 1
      )
    );
    setPendingEntries(next);
    setCompletedEntries([]);
    setActiveIndex(0);
    setWeightPromptOpen(false);
    setWeightInput("");
  };

  const addLine = () => {
    const name = exerciseName.trim();
    if (!name) return;
    const alternates = [...new Set(manualAlternateExercises.map((entry) => entry.trim()).filter(Boolean))];
    setPendingEntries((current) => {
      if (!current.length) workoutStartTimeRef.current = Date.now();
      return [
        ...current,
        buildDraftEntry({ exerciseName: name, muscleGroup, reps, sets, restSeconds, alternateExercises: alternates }, current.length + 1)
      ];
    });
    setExerciseName("");
    setRestSeconds(60);
    setManualAlternateExercises([]);
    setManualAlternateDraft("");
    if (!hasWorkoutStarted) {
      setActiveIndex(0);
      setWeightInput("");
    }
  };

  useEffect(() => {
    if (currentExercise) {
      setWeightInput("");
    }
  }, [currentExercise?.id]);

  useEffect(() => {
    if (!restTimer) return;

    const finishRest = () => {
      try {
        if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
      } catch {
        // Silencioso: no todas las plataformas soportan vibración.
      }

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioContext = new AudioContextClass();
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 880;
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.24);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.25);
          oscillator.onended = () => audioContext.close().catch(() => {});
        }
      } catch {
        // Silencioso: el sonido puede estar bloqueado por el navegador.
      }

      setActiveIndex(restTimer.nextIndex);
      setRestTimer(null);
    };

    const update = () => {
      const secondsLeft = Math.max(0, Math.ceil((restTimer.endsAt - Date.now()) / 1000));
      if (secondsLeft <= 0) {
        finishRest();
        return;
      }
      setRestTimer((current) => (current ? { ...current, secondsLeft } : current));
    };

    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [restTimer?.endsAt, restTimer?.nextIndex]);

  const openFinishPrompt = () => {
    if (!currentExercise) return;
    const found = state.sessions.find((session) =>
      session.entries.some(
        (entry) =>
          entry.exerciseName.toLowerCase() === currentExercise.exerciseName.toLowerCase() &&
          entry.weight > 0
      )
    )?.entries.find(
      (entry) =>
        entry.exerciseName.toLowerCase() === currentExercise.exerciseName.toLowerCase() &&
        entry.weight > 0
    );
    setWeightInput(found ? String(found.weight) : "");
    setWeightPromptOpen(true);
  };

  const confirmFinishExercise = () => {
    if (!currentExercise) return;
    const kg = Number(weightInput);
    if (!Number.isFinite(kg) || kg < 0) return;
    const currentScore = estimateOneRepMax(kg, currentExercise.reps);
    const previousBest = Math.max(
      0,
      ...state.sessions.flatMap((session) =>
        session.entries
          .filter((entry) => entry.exerciseName.toLowerCase() === currentExercise.exerciseName.toLowerCase())
          .map((entry) => estimateOneRepMax(entry.weight, entry.reps))
      )
    );
    const isPersonalRecord = currentScore > previousBest;
    const finished = { ...currentExercise, weight: kg, isPersonalRecord, personalRecordValue: isPersonalRecord ? currentScore : undefined };
    const nextIndex = activeIndex + 1;
    const rest = currentExercise.restSeconds ?? 60;
    setCompletedEntries((current) => [...current, finished]);
    setWeightPromptOpen(false);
    setWeightInput("");
    if (nextIndex < pendingEntries.length && rest > 0) {
      setRestTimer({
        secondsLeft: rest,
        nextIndex,
        nextExerciseName: pendingEntries[nextIndex]?.exerciseName ?? "Siguiente ejercicio",
        endsAt: Date.now() + rest * 1000,
      });
    } else {
      setActiveIndex(nextIndex);
    }
  };

  const startedAtDate = new Date(startedAt);
  const startedAtIso = Number.isFinite(startedAtDate.getTime()) ? startedAtDate.toISOString() : new Date().toISOString();
  const workoutStartMillis = workoutStartTimeRef.current || startedAtDate.getTime() || Date.now();
  const estimatedDurationMinutes = Math.max(1, Math.round((Date.now() - workoutStartMillis) / 60000));

  const draftSession: WorkoutSession = {
    id: "draft",
    title,
    startedAt: startedAtIso,
    completedAt: new Date().toISOString(),
    durationMinutes: estimatedDurationMinutes,
    notes,
    entries: completedEntries,
    routineId: selectedRoutine?.id,
    routineName: selectedRoutine?.name,
    routineDay: selectedDay,
  };

  const previous = previousSessionWithSameRoutine(draftSession, state.sessions);
  const compare = compareSessions(draftSession, previous);
  const totalCompletedVolume = completedEntries.reduce((a, e) => a + e.weight * e.reps * e.sets, 0);
  const estimatedRest = routineEntries.length ? routineEntries.reduce((sum, item) => sum + (item.restSeconds ?? 60), 0) : selectedRoutine?.items.reduce((sum, item) => sum + (item.restSeconds ?? 60), 0) ?? 0;

  const saveSession = () => {
    if (!completedEntries.length) return;
    const startedMillis = workoutStartTimeRef.current || new Date(startedAt).getTime() || Date.now();
    const durationMinutes = Math.max(1, Math.round((Date.now() - startedMillis) / 60000));
    addSession({
      ...draftSession,
      entries: completedEntries,
      completedAt: new Date().toISOString(),
      durationMinutes,
    });
    router.push("/history");
  };

  return (
    <MobileShell showNav={false} active="/register">
      <ModalTopBar title="Iniciar rutina" closeLabel="Volver" />
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4 scrollbar-hide">
        <Card className="overflow-hidden border border-border/70 bg-gradient-to-br from-surface via-surface to-[rgba(255,179,181,0.08)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pantalla de inicio</div>
              <h1 className="mt-1 text-2xl font-black tracking-tight">{selectedRoutine?.name ?? "Selecciona una rutina"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedRoutine?.description ?? "Elige una rutina para verla de forma clara y empezar ejercicio por ejercicio."}
              </p>
            </div>
            <div className="rounded-full border border-border bg-surface-2 p-3 text-primary">
              <Dumbbell className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1">{selectedRoutine?.items.length ?? 0} ejercicios</span>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1">{routineDays.length || 0} días</span>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1">Descanso total: {formatSeconds(estimatedRest)}</span>
            {selectedDay && selectedDay !== "Manual" ? <span className="rounded-full border border-border bg-surface-2 px-3 py-1">Día: {selectedDay}</span> : null}
          </div>

          <div className="mt-4 flex gap-3">
            <Button className="flex-1 gap-2" onClick={importRoutine} disabled={!selectedRoutine || !!restTimer}>
              <Play className="h-4 w-4" />
              Iniciar rutina
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => {
                setSelectedDay("Manual");
                setPendingEntries([]);
                setCompletedEntries([]);
                setActiveIndex(0);
              }}
            >
              <TimerReset className="h-4 w-4" />
              Limpiar
            </Button>
          </div>
        </Card>

        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Selecciona la semana</div>
              <div className="mt-1 text-sm text-muted-foreground">Toca un día para ver solo esa parte de la rutina.</div>
            </div>
            <div className="rounded-full border border-border bg-surface-2 p-2 text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <SelectField label="Rutina" value={selectedRoutineId} onChange={(e) => setSelectedRoutineId(e.target.value)}>
              {state.routines.length ? state.routines.map((routine) => (
                <option key={routine.id} value={routine.id}>{routine.name}</option>
              )) : <option value="">No hay rutinas creadas</option>}
            </SelectField>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedDay("Manual")}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${selectedDay === "Manual" ? "border-primary bg-[rgba(255,179,181,0.16)] text-foreground" : "border-border bg-surface-2 text-muted-foreground"}`}
            >
              Manual
            </button>
            {routinePreview.map((day) => {
              const isActive = selectedDay === day.label;
              return (
                <button
                  key={day.label}
                  type="button"
                  onClick={() => setSelectedDay(day.label)}
                  className={`min-w-[170px] shrink-0 rounded-[1.25rem] border p-3 text-left transition ${isActive ? "border-primary bg-[rgba(255,179,181,0.12)]" : "border-border bg-surface-2"}`}
                >
                  <div className="text-sm font-semibold">{day.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{day.exercises} ejercicios · {day.sets} series</div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {day.items.slice(0, 2).map((item) => item.exerciseName).join(" · ")}
                    {day.items.length > 2 ? " · ..." : ""}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Vista rápida</div>
                <div className="mt-1 text-sm text-muted-foreground">{routineEntries.length ? `${routineEntries.length} ejercicios listos para hoy.` : selectedRoutine ? "Mira el plan completo de la rutina sin tanta información." : "Crea una rutina para verla aquí."}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">{selectedRoutine?.name ?? "Sin rutina"}</div>
                <div>{selectedDay === "Manual" ? "Modo manual" : selectedDay}</div>
              </div>
            </div>
          </div>
        </Card>

        {selectedRoutine ? (
          <Card className="mt-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Plan visual</div>
                <div className="mt-1 text-lg font-bold">{selectedDay === "Manual" ? "Rutina completa" : selectedDay}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{selectedRoutine.items.length} ejercicios</div>
                <div>{routineDays.length || 0} bloques</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(selectedDay === "Manual" ? routinePreview : routinePreview.filter((day) => day.label === selectedDay)).map((day) => (
                <div key={day.label} className="rounded-[1.35rem] border border-border bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{day.label}</div>
                      <div className="text-xs text-muted-foreground">{day.exercises} ejercicios · {day.sets} series</div>
                    </div>
                    <div className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                      {formatSeconds(day.restSeconds)} descanso total
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {day.items.map((item, index) => (
                      <div key={`${day.label}-${index}-${item.exerciseName}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{item.exerciseName}</div>
                          <div className="text-xs text-muted-foreground">{item.reps} reps · {item.sets} series</div>
                          {item.alternateExercises?.length ? (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Otras opciones: {item.alternateExercises.join(" · ")}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatSeconds(item.restSeconds ?? 60)}</div>
                      </div>
                    ))}
                    {!day.items.length ? <div className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">No hay ejercicios en este bloque.</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="mt-4 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Agregar ejercicio manual</div>
          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Grupo muscular" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}>
                {muscleGroups.map((group) => <option key={group}>{group}</option>)}
              </SelectField>
              <Field label="Ejercicio principal" value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Ej. Laterales" />
            </div>
            <div className="rounded-2xl border border-border bg-surface-2 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Otra opción de ejercicio</div>
              <div className="mt-1 text-xs text-muted-foreground">Guarda variantes para cambiar rápido durante la sesión.</div>
              <div className="mt-3 flex gap-2">
                <Field
                  className="flex-1"
                  label="Escribe una variante"
                  value={manualAlternateDraft}
                  onChange={(e) => setManualAlternateDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addManualAlternativeExercise();
                    }
                  }}
                  placeholder="Ej. Laterales en polea"
                />
                <Button variant="secondary" className="self-end gap-2" onClick={addManualAlternativeExercise}>
                  <Plus className="h-4 w-4" />
                  Añadir
                </Button>
              </div>
              {manualAlternateExercises.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {manualAlternateExercises.map((exercise) => (
                    <span key={exercise} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-foreground">
                      {exercise}
                      <button
                        type="button"
                        className="text-muted-foreground transition hover:text-foreground"
                        onClick={() => removeManualAlternativeExercise(exercise)}
                        aria-label={`Eliminar variante ${exercise}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-muted-foreground">Todavía no agregas variantes.</div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Repeticiones" type="number" value={reps} onChange={(e) => setReps(Number(e.target.value))} />
              <Field label="Series" type="number" value={sets} onChange={(e) => setSets(Number(e.target.value))} />
              <Field label="Descanso (s)" type="number" min={0} value={restSeconds} onChange={(e) => setRestSeconds(Number(e.target.value))} />
            </div>
            <Button variant="secondary" onClick={addLine} className="gap-2">
              <Plus className="h-4 w-4" />
              Añadir a la sesión
            </Button>
          </div>
        </Card>

        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sesión actual</div>
              <div className="mt-1 text-lg font-bold">
                {currentExercise ? `${activeIndex + 1} / ${pendingEntries.length}` : "Sin ejercicios cargados"}
              </div>
            </div>
            <button onClick={resetWorkout} className="rounded-full border border-border bg-surface-2 p-2 text-muted-foreground" type="button" aria-label="Vaciar sesión">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <Field
            key={startedAtKey}
            className="mt-4"
            label="Fecha y hora de inicio"
            type="datetime-local"
            defaultValue={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />

          {currentExercise ? (
            <div className="mt-4 rounded-[1.35rem] border border-border bg-surface-2 p-4">
              <div className="text-lg font-bold">{currentExercise.exerciseName}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {currentExercise.muscleGroup} · {currentExercise.reps} reps · {currentExercise.sets} series · Descanso {currentExercise.restSeconds ?? 60}s
              </div>
              {currentExercise.alternateExercises?.length ? (() => {
                const variants = currentExercise.alternateExercises ?? [];
                const preview = variants.slice(0, 3);
                const remaining = variants.length - preview.length;
                return (
                  <div className="mt-3 rounded-2xl border border-border bg-surface px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Opciones de ejercicio</div>
                        <div className="mt-1 text-xs text-muted-foreground">{variants.length} variantes disponibles</div>
                      </div>
                      <div className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{variants.length}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {preview.map((exercise) => (
                        <button
                          key={exercise}
                          type="button"
                          onClick={() => replaceCurrentExercise(exercise)}
                          className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:bg-[rgba(255,179,181,0.12)]"
                        >
                          {exercise}
                        </button>
                      ))}
                      {remaining > 0 ? (
                        <span className="rounded-full border border-dashed border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                          +{remaining} más
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })() : null}
              <Button className="mt-4 w-full gap-2" onClick={openFinishPrompt} disabled={!!restTimer}>
                Finalizar ejercicio
              </Button>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface-2 p-4 text-sm text-muted-foreground">
              Pulsa “Iniciar rutina” para cargar el plan o agrega ejercicios manuales para empezar.
            </div>
          )}

          <div className="mt-4 space-y-2">
            {completedEntries.some((entry) => entry.isPersonalRecord) ? (
              <div className="rounded-2xl border border-[rgba(255,179,181,0.35)] bg-[rgba(255,179,181,0.10)] px-4 py-3 text-sm font-semibold text-primary">
                ¡Nuevo récord detectado en esta sesión!
              </div>
            ) : null}
            {completedEntries.map((entry, index) => (
              <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{index + 1}. {entry.exerciseName}</div>
                    {entry.isPersonalRecord ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,179,181,0.40)] bg-[rgba(255,179,181,0.12)] px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <Sparkles className="h-3 w-3" />
                        ¡Nuevo récord!
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{entry.muscleGroup}</div>
                </div>
                <div className="text-right text-muted-foreground">
                  {formatKg(entry.weight, state.settings.units)} · {entry.reps}x{entry.sets} · {entry.restSeconds ?? 60}s
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
            {completedEntries.length ? `Volumen estimado: ${formatVolume(totalCompletedVolume, state.settings.units)}` : "Todavía no has finalizado ejercicios."}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
            {compare.volumeDelta >= 0 ? "+" : ""}{formatVolume(Math.abs(compare.volumeDelta), state.settings.units)} · {compare.repsDelta >= 0 ? "+" : ""}{compare.repsDelta} reps vs. sesión previa.
          </div>
        </Card>

        <Button className="mt-4 w-full gap-2" onClick={saveSession} disabled={!completedEntries.length || !!restTimer}>
          <Save className="h-4 w-4" />
          Guardar entrenamiento
        </Button>
      </div>

      {restTimer ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-4 pb-4 pt-20 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-[430px] rounded-3xl border border-border bg-background p-5 shadow-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tiempo de descanso</div>
            <div className="mt-1 text-xl font-bold">{restTimer.nextExerciseName}</div>
            <div className="mt-2 text-sm text-muted-foreground">Empieza el siguiente ejercicio cuando termine este cronómetro.</div>
            <div className="mt-5 flex items-end justify-center rounded-[1.5rem] border border-border bg-surface-2 py-8">
              <div className="text-6xl font-black tracking-tight tabular-nums">{String(Math.max(0, restTimer.secondsLeft)).padStart(2, "0")}</div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setActiveIndex(restTimer.nextIndex);
                  setRestTimer(null);
                }}
              >
                Saltar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {weightPromptOpen && currentExercise ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-4 pb-4 pt-20 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-[430px] rounded-3xl border border-border bg-background p-4 shadow-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Finalizar ejercicio</div>
            <div className="mt-1 text-xl font-bold">{currentExercise.exerciseName}</div>
            <div className="mt-1 text-sm text-muted-foreground">Escribe los kilogramos que levantaste para guardar este ejercicio y pasar al siguiente.</div>
            <Field
              className="mt-4"
              label={`Peso real (${state.settings.units})`}
              type="number"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="0"
            />
            <div className="mt-4 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setWeightPromptOpen(false);
                  setWeightInput("");
                }}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={confirmFinishExercise}>
                Guardar y seguir
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </MobileShell>
  );
}
