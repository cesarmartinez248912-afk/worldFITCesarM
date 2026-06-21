"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Button, Card, Field, SelectField } from "@/components/ui";
import { ModalTopBar } from "@/components/top-bar";
import { useAppStore } from "@/hooks/use-app-store";
import { createId } from "@/utils/id";
import type { MuscleGroup, WorkoutEntry, WorkoutSession } from "@/types";
import { compareSessions, previousSessionWithSameRoutine, sortSessionsNewestFirst } from "@/utils/analytics";
import { formatKg, formatVolume } from "@/utils/format";

const muscleGroups: MuscleGroup[] = ["Pecho", "Espalda", "Pierna", "Hombros", "Bíceps", "Tríceps", "Core", "Cardio", "Full Body", "Otro"];

type DraftEntry = WorkoutEntry & { order: number };

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
    order,
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
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 16));
  const [exerciseName, setExerciseName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("Pecho");
  const [reps, setReps] = useState(8);
  const [sets, setSets] = useState(3);
  const [restSeconds, setRestSeconds] = useState(60);
  const [pendingEntries, setPendingEntries] = useState<DraftEntry[]>([]);
  const [completedEntries, setCompletedEntries] = useState<WorkoutEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [weightPromptOpen, setWeightPromptOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [restTimer, setRestTimer] = useState<{ secondsLeft: number; nextIndex: number; nextExerciseName: string } | null>(null);

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
    return selectedRoutine.items.filter((item) => item.dayLabel === selectedDay).sort((a, b) => a.order - b.order);
  }, [selectedRoutine, selectedDay]);

  const currentExercise = pendingEntries[activeIndex] ?? null;
  const hasWorkoutStarted = pendingEntries.length > 0;

  const resetWorkout = () => {
    setPendingEntries([]);
    setCompletedEntries([]);
    setActiveIndex(0);
    setWeightPromptOpen(false);
    setWeightInput("");
  };

  const importRoutine = () => {
    if (!selectedRoutine) return;
    const source = routineEntries.length ? routineEntries : selectedRoutine.items;
    const next = source.map((item, index) =>
      buildDraftEntry(
        {
          exerciseName: item.exerciseName,
          muscleGroup: item.muscleGroup,
          reps: item.reps,
          sets: item.sets,
          restSeconds: item.restSeconds,
          notes: item.notes,
        },
        index + 1
      )
    );
    setPendingEntries(next);
    setCompletedEntries([]);
    setActiveIndex(0);
    setWeightPromptOpen(false);
    setWeightInput("");

    if (next.length) {
      setWeightInput("");
    }
  };

  const addLine = () => {
    const name = exerciseName.trim();
    if (!name) return;
    setPendingEntries((current) => [
      ...current,
      buildDraftEntry({ exerciseName: name, muscleGroup, reps, sets, restSeconds }, current.length + 1)
    ]);
    setExerciseName("");
    setRestSeconds(60);
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
    if (restTimer.secondsLeft <= 0) {
      setActiveIndex(restTimer.nextIndex);
      setRestTimer(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      setRestTimer((current) => (current ? { ...current, secondsLeft: current.secondsLeft - 1 } : current));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [restTimer]);

  const openFinishPrompt = () => {
    if (!currentExercise) return;
    setWeightInput("");
    setWeightPromptOpen(true);
  };

  const confirmFinishExercise = () => {
    if (!currentExercise) return;
    const kg = Number(weightInput);
    if (!Number.isFinite(kg) || kg < 0) return;
    const finished = { ...currentExercise, weight: kg };
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
      });
    } else {
      setActiveIndex(nextIndex);
    }
  };

  const draftSession: WorkoutSession = {
    id: "draft",
    title,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date().toISOString(),
    durationMinutes: Math.max(20, Math.round(completedEntries.length * 8 + 20)),
    notes,
    entries: completedEntries,
    routineId: selectedRoutine?.id,
    routineName: selectedRoutine?.name,
    routineDay: selectedDay,
  };

  const previous = previousSessionWithSameRoutine(draftSession, state.sessions);
  const compare = compareSessions(draftSession, previous);

  const saveSession = () => {
    if (!completedEntries.length) return;
    addSession(draftSession);
    router.push("/history");
  };

  return (
    <MobileShell showNav={false} active="/register">
      <ModalTopBar title="Registrar" closeLabel="Volver" />
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4 scrollbar-hide">
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Selecciona una rutina</div>
          <div className="mt-3 grid gap-3">
            <SelectField label="Rutina" value={selectedRoutineId} onChange={(e) => setSelectedRoutineId(e.target.value)}>
              {state.routines.length ? state.routines.map((routine) => (
                <option key={routine.id} value={routine.id}>{routine.name}</option>
              )) : <option value="">No hay rutinas creadas</option>}
            </SelectField>
            <SelectField label="Día sugerido" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
              <option value="Manual">Manual</option>
              {routineDays.map((day) => <option key={day} value={day}>{day}</option>)}
            </SelectField>
            <Field label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Pierna pesada" />
            <Field label="Fecha y hora" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </div>
        </Card>

        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Importación rápida</div>
              <div className="mt-1 text-sm text-muted-foreground">Carga la plantilla y ve avanzando ejercicio por ejercicio.</div>
            </div>
            <Button variant="secondary" className="gap-2" onClick={importRoutine} disabled={!selectedRoutine}>
              <Sparkles className="h-4 w-4" />
              Cargar rutina
            </Button>
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
            {routineEntries.length ? `${routineEntries.length} ejercicios listos para hoy.` : selectedRoutine ? "No hay día seleccionado o la rutina está vacía." : "Crea una rutina para poder cargarla aquí."}
          </div>
        </Card>

        <Card className="mt-4 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Agregar ejercicio manual</div>
          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Grupo muscular" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}>
                {muscleGroups.map((group) => <option key={group}>{group}</option>)}
              </SelectField>
              <Field label="Ejercicio" value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Ej. Laterales" />
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
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ejercicio actual</div>
              <div className="mt-1 text-lg font-bold">
                {currentExercise ? `${activeIndex + 1} / ${pendingEntries.length}` : "Sin ejercicios cargados"}
              </div>
            </div>
            <button onClick={resetWorkout} className="rounded-full border border-border bg-surface-2 p-2 text-muted-foreground" type="button" aria-label="Vaciar sesión">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {currentExercise ? (
            <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-4">
              <div className="text-sm font-semibold">{currentExercise.exerciseName}</div>
              <div className="mt-1 text-xs text-muted-foreground">{currentExercise.muscleGroup} · {currentExercise.reps} reps · {currentExercise.sets} series · Descanso {currentExercise.restSeconds ?? 60}s</div>
              <Button className="mt-4 w-full gap-2" onClick={openFinishPrompt} disabled={!!restTimer}>
                Finalizar ejercicio
              </Button>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface-2 p-4 text-sm text-muted-foreground">
              Carga una rutina o agrega ejercicios manuales para empezar.
            </div>
          )}

          <div className="mt-4 space-y-2">
            {completedEntries.map((entry, index) => (
              <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold">{index + 1}. {entry.exerciseName}</div>
                  <div className="text-xs text-muted-foreground">{entry.muscleGroup}</div>
                </div>
                <div className="text-right text-muted-foreground">
                  {formatKg(entry.weight, state.settings.units)} · {entry.reps}x{entry.sets} · {entry.restSeconds ?? 60}s
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
            {completedEntries.length ? `Volumen estimado: ${formatVolume(completedEntries.reduce((a, e) => a + e.weight * e.reps * e.sets, 0), state.settings.units)}` : "Todavía no has finalizado ejercicios."}
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
