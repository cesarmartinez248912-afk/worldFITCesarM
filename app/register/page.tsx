"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, Sparkles } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Button, Card, Field, SelectField } from "@/components/ui";
import { ModalTopBar } from "@/components/top-bar";
import { useAppStore } from "@/hooks/use-app-store";
import { createId } from "@/utils/id";
import type { MuscleGroup, WorkoutEntry, WorkoutSession } from "@/types";
import { compareSessions, previousSessionWithSameRoutine, sessionReps, sortSessionsNewestFirst } from "@/utils/analytics";
import { formatKg, formatVolume } from "@/utils/format";

const muscleGroups: MuscleGroup[] = ["Pecho", "Espalda", "Pierna", "Hombros", "Bíceps", "Tríceps", "Core", "Cardio", "Full Body", "Otro"];

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
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(8);
  const [sets, setSets] = useState(3);
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);

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

  const importRoutine = () => {
    if (!selectedRoutine) return;
    const source = routineEntries.length ? routineEntries : selectedRoutine.items;
    setEntries(
      source.map((item) => ({
        id: createId("entry"),
        exerciseId: createId("ex"),
        exerciseName: item.exerciseName,
        muscleGroup: item.muscleGroup,
        weight: item.weight,
        reps: item.reps,
        sets: item.sets,
        notes: item.notes,
      }))
    );
  };

  const addLine = () => {
    const name = exerciseName.trim();
    if (!name) return;
    setEntries((current) => [
      { id: createId("entry"), exerciseId: createId("ex"), exerciseName: name, muscleGroup, weight, reps, sets },
      ...current
    ]);
    setExerciseName("");
    setWeight(0);
  };

  const draftSession: WorkoutSession = {
    id: "draft",
    title,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date().toISOString(),
    durationMinutes: Math.max(20, Math.round(entries.length * 8 + 20)),
    notes,
    entries,
    routineId: selectedRoutine?.id,
    routineName: selectedRoutine?.name,
    routineDay: selectedDay,
  };

  const previous = previousSessionWithSameRoutine(draftSession, state.sessions);
  const compare = compareSessions(draftSession, previous);

  const saveSession = () => {
    if (!entries.length) return;
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
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Importación rápida</div>
              <div className="mt-1 text-sm text-muted-foreground">Carga la plantilla del día elegido y luego ajusta lo que necesites.</div>
            </div>
            <Button variant="secondary" className="gap-2" onClick={importRoutine}>
              <Sparkles className="h-4 w-4" />
              Importar
            </Button>
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
            {routineEntries.length ? `${routineEntries.length} ejercicios listos para hoy.` : selectedRoutine ? "No hay día seleccionado o la rutina está vacía." : "Crea una rutina para poder importarla aquí."}
          </div>
        </Card>

        <Card className="mt-4 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Agregar serie manual</div>
          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Grupo muscular" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}>
                {muscleGroups.map((group) => <option key={group}>{group}</option>)}
              </SelectField>
              <Field label="Ejercicio" value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Ej. Laterales" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Peso (${state.settings.units})`} type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Repeticiones" type="number" value={reps} onChange={(e) => setReps(Number(e.target.value))} />
                <Field label="Series" type="number" value={sets} onChange={(e) => setSets(Number(e.target.value))} />
              </div>
            </div>
            <Button variant="secondary" onClick={addLine} className="gap-2">
              <Plus className="h-4 w-4" />
              Añadir serie
            </Button>
          </div>
        </Card>

        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sesión</div>
              <div className="mt-1 text-lg font-bold">{entries.length} series agregadas</div>
            </div>
            <button onClick={() => setEntries([])} className="rounded-full border border-border bg-surface-2 p-2 text-muted-foreground">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold">{entry.exerciseName}</div>
                  <div className="text-xs text-muted-foreground">{entry.muscleGroup}</div>
                </div>
                <div className="text-right text-muted-foreground">
                  {formatKg(entry.weight, state.settings.units)} · {entry.reps}x{entry.sets}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
            {entries.length ? `Volumen estimado: ${formatVolume(entries.reduce((a, e) => a + e.weight * e.reps * e.sets, 0), state.settings.units)}` : "Todavía no agregas series."}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
            {compare.volumeDelta >= 0 ? "+" : ""}{formatVolume(Math.abs(compare.volumeDelta), state.settings.units)} · {compare.repsDelta >= 0 ? "+" : ""}{compare.repsDelta} reps vs. sesión previa.
          </div>
        </Card>

        <Button className="mt-4 w-full gap-2" onClick={saveSession} disabled={!entries.length}>
          <Save className="h-4 w-4" />
          Guardar entrenamiento
        </Button>
      </div>
    </MobileShell>
  );
}
