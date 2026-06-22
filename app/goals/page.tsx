"use client";

import { useState } from "react";
import { Plus, CheckCircle2, Trash2 } from "lucide-react";
import { MobileShell, TopAccent } from "@/components/mobile-shell";
import { Button, Card, Field, SelectField } from "@/components/ui";
import { useAppStore } from "@/hooks/use-app-store";
import type { MuscleGroup } from "@/types";
import { formatDateLabel, formatKg } from "@/utils/format";

const groups: MuscleGroup[] = ["Pecho", "Espalda", "Pierna", "Hombros", "Bíceps", "Tríceps", "Core", "Cardio", "Full Body", "Otro"];

export default function GoalsPage() {
  const { state, addGoal, updateGoal, deleteGoal } = useAppStore();
  const [exerciseName, setExerciseName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("Pecho");
  const [targetWeight, setTargetWeight] = useState(0);
  const [currentWeight, setCurrentWeight] = useState(0);
  const [targetDate, setTargetDate] = useState(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10));

  const createGoal = () => {
    if (!exerciseName.trim()) return;
    if (!Number.isFinite(targetWeight) || targetWeight <= 0) {
      window.alert("La meta debe ser mayor que 0.");
      return;
    }
    addGoal({
      exerciseName: exerciseName.trim(),
      muscleGroup,
      targetWeight,
      currentWeight,
      targetDate: new Date(targetDate).toISOString(),
    });
    setExerciseName("");
    setTargetWeight(0);
    setCurrentWeight(0);
  };

  const activeGoals = state.goals.filter((goal) => !goal.completed);
  const completedGoals = state.goals.filter((goal) => goal.completed);

  return (
    <MobileShell active="/goals">
      <div className="flex-1 overflow-y-auto pb-28 scrollbar-hide">
        <TopAccent subtitle="Metas" title="Objetivos" />
        <div className="px-5">
          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Activos</div>
            <div className="mt-3 space-y-3">
              {activeGoals.map((goal) => {
                const safeTarget = goal.targetWeight > 0 ? goal.targetWeight : 1;
                const progress = Math.min(100, Math.max(0, Math.round((goal.currentWeight / safeTarget) * 100)));
                return (
                  <div key={goal.id} className="rounded-2xl border border-border bg-surface-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{goal.exerciseName}</div>
                        <div className="text-xs text-muted-foreground">{goal.muscleGroup} · {formatDateLabel(goal.targetDate)}</div>
                      </div>
                      <button onClick={() => deleteGoal(goal.id)} className="rounded-full border border-border bg-surface p-2 text-muted-foreground">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>{formatKg(goal.currentWeight, state.settings.units)}</span>
                      <span>{progress}%</span>
                      <span>{formatKg(goal.targetWeight, state.settings.units)}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" className="flex-1 gap-2" onClick={() => updateGoal(goal.id, { currentWeight: goal.currentWeight + 1 })}>+1 {state.settings.units}</Button>
                      <Button className="flex-1 gap-2" onClick={() => updateGoal(goal.id, { currentWeight: goal.targetWeight, completed: true })}>
                        <CheckCircle2 className="h-4 w-4" />
                        Completar
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!activeGoals.length ? <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-4 text-sm text-muted-foreground">No tienes metas activas.</div> : null}
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nueva meta</div>
            <div className="mt-3 grid gap-3">
              <Field label="Ejercicio" value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} />
              <SelectField label="Grupo muscular" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}>
                {groups.map((group) => <option key={group}>{group}</option>)}
              </SelectField>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Meta (${state.settings.units})`} type="number" min={0} step="0.1" value={targetWeight} onChange={(e) => setTargetWeight(Number(e.target.value))} />
                <Field label={`Actual (${state.settings.units})`} type="number" min={0} step="0.1" value={currentWeight} onChange={(e) => setCurrentWeight(Number(e.target.value))} />
              </div>
              <div className="rounded-2xl border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
                La meta objetivo debe ser mayor que 0 para calcular el progreso correctamente.
              </div>
              <Field label="Fecha objetivo" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              <Button onClick={createGoal} className="gap-2">
                <Plus className="h-4 w-4" />
                Añadir meta
              </Button>
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Completadas</div>
            <div className="mt-3 space-y-3">
              {completedGoals.map((goal) => (
                <div key={goal.id} className="rounded-2xl border border-border bg-surface-2 p-4 opacity-90">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-success">Completada</div>
                      <div className="mt-1 text-lg font-semibold">{goal.exerciseName}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{formatDateLabel(goal.targetDate)}</div>
                    </div>
                    <button onClick={() => deleteGoal(goal.id)} className="rounded-full border border-border bg-surface p-2 text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {!completedGoals.length ? <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-4 text-sm text-muted-foreground">No has completado metas todavía.</div> : null}
            </div>
          </Card>
        </div>
      </div>
    </MobileShell>
  );
}
