"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Plus, Save, Trash2, Upload } from "lucide-react";
import { MobileShell, TopAccent } from "@/components/mobile-shell";
import { Button, Card, Field, SelectField } from "@/components/ui";
import { useAppStore } from "@/hooks/use-app-store";
import { createId } from "@/utils/id";
import type { MuscleGroup, RoutineItem, RoutineTemplate } from "@/types";

const groups: MuscleGroup[] = ["Pecho", "Espalda", "Pierna", "Hombros", "Bíceps", "Tríceps", "Core", "Cardio", "Full Body", "Otro"];
const validGroups = new Set<MuscleGroup>(groups);

function emptyRoutine(): RoutineTemplate {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "",
    description: "",
    createdAt: now,
    updatedAt: now,
    items: []
  };
}

function groupDays(items: RoutineItem[]) {
  const map = new Map<string, RoutineItem[]>();
  [...items].sort((a, b) => a.order - b.order).forEach((item) => {
    if (!map.has(item.dayLabel)) map.set(item.dayLabel, []);
    map.get(item.dayLabel)!.push(item);
  });
  return [...map.entries()];
}

function downloadFile(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeImportedRoutine(input: unknown): RoutineTemplate | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<RoutineTemplate> & { items?: unknown };

  const items = Array.isArray(raw.items) ? raw.items : [];
  const normalizedItems = items
    .map((item, index): RoutineItem | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<RoutineItem>;
      const exerciseName = typeof row.exerciseName === "string" ? row.exerciseName.trim() : "";
      const dayLabel = typeof row.dayLabel === "string" ? row.dayLabel.trim() : "Día 1";
      const muscleGroup = typeof row.muscleGroup === "string" && validGroups.has(row.muscleGroup as MuscleGroup)
        ? (row.muscleGroup as MuscleGroup)
        : "Otro";
      if (!exerciseName) return null;

      return {
        id: createId("ri"),
        dayLabel,
        exerciseName,
        muscleGroup,
        weight: Number.isFinite(Number(row.weight)) ? Number(row.weight) : 0,
        reps: Number.isFinite(Number(row.reps)) ? Number(row.reps) : 8,
        sets: Number.isFinite(Number(row.sets)) ? Number(row.sets) : 3,
        order: Number.isFinite(Number(row.order)) ? Number(row.order) : index + 1,
        notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : undefined,
      };
    })
    .filter((item): item is RoutineItem => item !== null)
    .sort((a, b) => a.order - b.order);

  if (!normalizedItems.length) return null;

  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Rutina importada";
  const description = typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : "Rutina importada desde archivo";

  return {
    id: createId("rt"),
    name,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: normalizedItems,
  };
}

function normalizePayload(payload: unknown): RoutineTemplate[] {
  if (!payload || typeof payload !== "object") return [];
  const raw = payload as any;
  if (Array.isArray(raw.routines)) {
    return raw.routines.map((routine: unknown) => normalizeImportedRoutine(routine)).filter((routine): routine is RoutineTemplate => Boolean(routine));
  }
  if (Array.isArray(raw.items)) {
    const routine = normalizeImportedRoutine(raw);
    return routine ? [routine] : [];
  }
  return [];
}

export default function RoutinesPage() {
  const { state, upsertRoutine, deleteRoutine, updateSettings } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoutineTemplate>(emptyRoutine());
  const [dayLabel, setDayLabel] = useState("Día 1");
  const [exerciseName, setExerciseName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("Pecho");
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(8);
  const [sets, setSets] = useState(3);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedId === "new") {
      setDraft(emptyRoutine());
      return;
    }
    const current = state.routines.find((routine) => routine.id === selectedId);
    if (current) setDraft(current);
  }, [selectedId, state.routines]);

  useEffect(() => {
    if (selectedId !== "new" && selectedId && selectedId !== state.settings.activeRoutineId) {
      updateSettings({ activeRoutineId: selectedId });
    }
  }, [selectedId, state.settings.activeRoutineId, updateSettings]);

  const currentRoutine = useMemo(() => {
    if (!selectedId) return null;
    if (selectedId === "new") return draft;
    return state.routines.find((routine) => routine.id === selectedId) ?? null;
  }, [draft, selectedId, state.routines]);

  const routineCount = state.routines.length;
  const selectedIsNew = selectedId === "new";
  const groupedDays = useMemo(() => groupDays(draft.items), [draft.items]);

  const addItem = () => {
    const trimmed = exerciseName.trim();
    if (!trimmed) return;
    const nextOrder = draft.items.filter((item) => item.dayLabel === dayLabel).length + 1;
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: createId("ri"),
          dayLabel,
          exerciseName: trimmed,
          muscleGroup,
          weight,
          reps,
          sets,
          order: nextOrder
        }
      ]
    }));
    setExerciseName("");
    setWeight(0);
  };

  const saveRoutine = () => {
    const id = upsertRoutine({
      ...draft,
      name: draft.name.trim() || "Rutina nueva",
      description: draft.description.trim() || "Rutina personalizada",
      id: draft.id || undefined,
    });
    setSelectedId(id);
    updateSettings({ activeRoutineId: id });
  };

  const cloneRoutine = () => {
    const source = selectedId === "new" ? state.routines[0] : state.routines.find((routine) => routine.id === selectedId);
    if (!source) return;
    setDraft({
      ...source,
      id: "",
      name: `${source.name} (copia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: source.items.map((item) => ({ ...item, id: createId("ri") }))
    });
    setSelectedId("new");
  };

  const openRoutine = (id: string) => {
    setSelectedId(id);
  };

  const startNew = () => {
    setSelectedId("new");
    setDraft(emptyRoutine());
  };

  const setActive = (id: string) => {
    if (!id || id === "new") return;
    updateSettings({ activeRoutineId: id });
    setSelectedId(id);
  };

  const exportRoutine = () => {
    const routine = currentRoutine ?? state.routines.find((routine) => routine.id === state.settings.activeRoutineId) ?? state.routines[0];
    if (!routine) return;
    downloadFile(
      `${routine.name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "rutina"}.json`,
      JSON.stringify(routine, null, 2),
      "application/json"
    );
  };

  const importRoutine = () => {
    fileInputRef.current?.click();
  };

  const onImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const routines = normalizePayload(parsed);
      if (!routines.length) return;
      routines.forEach((routine) => upsertRoutine(routine));
      const last = routines[0];
      setSelectedId(last.id);
      setDraft(last);
      updateSettings({ activeRoutineId: last.id });
    } catch {
      // Silencioso: el archivo no tenía el formato esperado.
    }
  };

  return (
    <MobileShell active="/routines">
      <div className="flex-1 overflow-y-auto pb-28 scrollbar-hide">
        <TopAccent
          subtitle="Rutinas"
          title="Tus planes"
          right={
            <div className="flex gap-2">
              <Button variant="secondary" className="h-11 gap-2 px-3" onClick={importRoutine}>
                <Upload className="h-4 w-4" />
                Subir
              </Button>
              <Button variant="secondary" className="h-11 gap-2 px-3" onClick={startNew}>
                <Plus className="h-4 w-4" />
                Nueva
              </Button>
            </div>
          }
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            void onImportFile(e.target.files?.[0] ?? null);
            e.currentTarget.value = "";
          }}
        />

        <div className="px-5">
          <div className="grid gap-3">
            {state.routines.map((routine) => {
              const active = routine.id === state.settings.activeRoutineId;
              const selected = routine.id === selectedId;
              return (
                <button
                  key={routine.id}
                  onClick={() => openRoutine(routine.id)}
                  className={`rounded-2xl border p-4 text-left transition ${selected ? "border-primary bg-[rgba(255,179,181,0.10)]" : "border-border bg-surface-2"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">{routine.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{routine.items.length ? `${new Set(routine.items.map((item) => item.dayLabel)).size} días · ${routine.items.length} ejercicios` : "Sin ejercicios"}</div>
                    </div>
                    {active ? <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-background">Activa</span> : null}
                  </div>
                </button>
              );
            })}
            {!state.routines.length ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-4 text-sm text-muted-foreground">
                Aún no tienes rutinas creadas. Pulsa “Nueva” para empezar desde cero.
              </div>
            ) : null}
          </div>

          <Card className="mt-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Biblioteca</div>
                <div className="mt-1 text-sm text-muted-foreground">{routineCount} rutinas guardadas · puedes descargarlas o subirlas en JSON.</div>
              </div>
              <Button variant="secondary" className="gap-2" onClick={exportRoutine} disabled={!currentRoutine && !state.routines.length}>
                <Download className="h-4 w-4" />
                Descargar
              </Button>
            </div>
          </Card>

          {selectedId ? (
            <>
              <Card className="mt-4 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Editar rutina</div>
                    <div className="mt-1 text-lg font-bold">{selectedIsNew ? "Nueva rutina" : currentRoutine?.name || "Rutina"}</div>
                  </div>
                  <Button variant="secondary" className="gap-2" onClick={() => setActive(selectedId)} disabled={selectedIsNew}>
                    <Check className="h-4 w-4" />
                    Usar
                  </Button>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Nombre" value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} placeholder="Ej. Recomposición corporal" />
                    <Field label="Descripción" value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} placeholder="Ej. Rutina base para 4 días" />
                  </div>
                </div>
              </Card>

              <Card className="mt-4 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Agregar serie</div>
                <div className="mt-3 grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Día" value={dayLabel} onChange={(e) => setDayLabel(e.target.value)} placeholder="Día 1 · Pierna" />
                    <SelectField label="Grupo muscular" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}>
                      {groups.map((group) => <option key={group} value={group}>{group}</option>)}
                    </SelectField>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ejercicio" value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Ej. Press militar" />
                    <Field label={`Peso (${state.settings.units})`} type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Repeticiones" type="number" value={reps} onChange={(e) => setReps(Number(e.target.value))} />
                    <Field label="Series" type="number" value={sets} onChange={(e) => setSets(Number(e.target.value))} />
                  </div>
                  <Button onClick={addItem} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Añadir serie
                  </Button>
                </div>
              </Card>

              <Card className="mt-4 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contenido</div>
                    <div className="mt-1 text-lg font-bold">{draft.items.length} series</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="gap-2" onClick={cloneRoutine} disabled={!state.routines.length && selectedIsNew}>
                      <Copy className="h-4 w-4" />
                      Duplicar
                    </Button>
                    {draft.id && !selectedIsNew ? (
                      <Button variant="danger" className="gap-2" onClick={() => deleteRoutine(draft.id)}>
                        <Trash2 className="h-4 w-4" />
                        Borrar
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {groupedDays.map(([label, items]) => (
                    <div key={label} className="rounded-2xl border border-border bg-surface-2 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold">{label}</div>
                        <div className="text-xs text-muted-foreground">{items.length} series</div>
                      </div>
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-border bg-surface p-3">
                            <div className="grid gap-2 md:grid-cols-2">
                              <SelectField label="Grupo" value={item.muscleGroup} onChange={(e) => setDraft((current) => ({ ...current, items: current.items.map((row) => row.id === item.id ? { ...row, muscleGroup: e.target.value as MuscleGroup } : row) }))}>
                                {groups.map((group) => <option key={group} value={group}>{group}</option>)}
                              </SelectField>
                              <Field label="Ejercicio" value={item.exerciseName} onChange={(e) => setDraft((current) => ({ ...current, items: current.items.map((row) => row.id === item.id ? { ...row, exerciseName: e.target.value } : row) }))} />
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-3">
                              <Field type="number" value={item.weight} onChange={(e) => setDraft((current) => ({ ...current, items: current.items.map((row) => row.id === item.id ? { ...row, weight: Number(e.target.value) } : row) }))} label="Peso" />
                              <Field type="number" value={item.reps} onChange={(e) => setDraft((current) => ({ ...current, items: current.items.map((row) => row.id === item.id ? { ...row, reps: Number(e.target.value) } : row) }))} label="Reps" />
                              <Field type="number" value={item.sets} onChange={(e) => setDraft((current) => ({ ...current, items: current.items.map((row) => row.id === item.id ? { ...row, sets: Number(e.target.value) } : row) }))} label="Series" />
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <div className="text-xs text-muted-foreground">Orden: {item.order}</div>
                              <Button variant="secondary" className="gap-2" onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((row) => row.id !== item.id) }))}>
                                <Trash2 className="h-4 w-4" />
                                Quitar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {!draft.items.length ? (
                    <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-4 text-sm text-muted-foreground">
                      Aún no hay series. Pulsa “Nueva” para construir una rutina desde cero.
                    </div>
                  ) : null}
                </div>
              </Card>

              <div className="mt-4 flex gap-3">
                <Button variant="secondary" className="flex-1 gap-2" onClick={startNew}>
                  Nueva
                </Button>
                <Button className="flex-1 gap-2" onClick={saveRoutine}>
                  <Save className="h-4 w-4" />
                  Guardar rutina
                </Button>
              </div>
            </>
          ) : (
            <Card className="mt-4 p-4 text-sm text-muted-foreground">
              Toca una rutina para editarla o pulsa “Nueva” para crear una desde cero.
            </Card>
          )}

        </div>
      </div>
    </MobileShell>
  );
}
