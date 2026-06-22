"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Plus, Save, Trash2, Upload } from "lucide-react";
import { MobileShell, TopAccent } from "@/components/mobile-shell";
import { Button, Card, Field, SelectField } from "@/components/ui";
import { useAppStore } from "@/hooks/use-app-store";
import { createId } from "@/utils/id";
import type { MuscleGroup, RoutineItem, RoutineTemplate, WeekDay } from "@/types";

const groups: MuscleGroup[] = ["Pecho", "Espalda", "Pierna", "Hombros", "Bíceps", "Tríceps", "Core", "Cardio", "Full Body", "Otro"];
const validGroups = new Set<MuscleGroup>(groups);
const weekDays: ("" | WeekDay)[] = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function emptyRoutine(): RoutineTemplate {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "",
    description: "",
    createdAt: now,
    updatedAt: now,
    items: [],
    scheduledWeekDays: {}
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

function normalizeScheduledWeekDays(input: unknown): Partial<Record<string, WeekDay>> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const entries = Object.entries(input as Record<string, unknown>).reduce<Partial<Record<string, WeekDay>>>((acc, [dayLabel, value]) => {
    if (weekDays.includes(value as WeekDay) && value) {
      acc[dayLabel] = value as WeekDay;
    }
    return acc;
  }, {});
  return Object.keys(entries).length ? entries : undefined;
}

function normalizeAlternativeExercises(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return items.length ? [...new Set(items)] : undefined;
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
        reps: Number.isFinite(Number(row.reps)) ? Number(row.reps) : 8,
        sets: Number.isFinite(Number(row.sets)) ? Number(row.sets) : 3,
        restSeconds: Number.isFinite(Number(row.restSeconds)) ? Number(row.restSeconds) : undefined,
        order: Number.isFinite(Number(row.order)) ? Number(row.order) : index + 1,
        notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : undefined,
        alternateExercises: normalizeAlternativeExercises((row as { alternateExercises?: unknown; alternativeExercises?: unknown }).alternateExercises)
          ?? normalizeAlternativeExercises((row as { alternateExercises?: unknown; alternativeExercises?: unknown }).alternativeExercises),
      };
    })
    .filter((item): item is RoutineItem => item !== null)
    .sort((a, b) => a.order - b.order);

  if (!normalizedItems.length) return null;

  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Rutina importada";
  const description = typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : "Rutina importada desde archivo";
  const scheduledWeekDays = normalizeScheduledWeekDays(raw.scheduledWeekDays);

  return {
    id: createId("rt"),
    name,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: normalizedItems,
    scheduledWeekDays,
  };
}

function normalizePayload(payload: unknown): RoutineTemplate[] {
  if (!payload || typeof payload !== "object") return [];
  const raw = payload as { routines?: unknown; items?: unknown };
  if (Array.isArray(raw.routines)) {
    return raw.routines
      .map((routine: unknown) => normalizeImportedRoutine(routine))
      .filter((routine): routine is RoutineTemplate => routine !== null);
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
  const [reps, setReps] = useState(8);
  const [sets, setSets] = useState(3);
  const [restSeconds, setRestSeconds] = useState(60);
  const [newItemAlternateExercises, setNewItemAlternateExercises] = useState<string[]>([]);
  const [newItemAlternateDraft, setNewItemAlternateDraft] = useState("");
  const [variantDrafts, setVariantDrafts] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateRoutineItem = (itemId: string, patch: Partial<RoutineItem>) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((row) => (row.id === itemId ? { ...row, ...patch } : row))
    }));
  };

  const addAlternativeExercise = (itemId: string) => {
    const value = (variantDrafts[itemId] ?? "").trim();
    if (!value) return;
    setDraft((current) => ({
      ...current,
      items: current.items.map((row) => {
        if (row.id !== itemId) return row;
        const next = [...(row.alternateExercises ?? []), value].map((entry) => entry.trim()).filter(Boolean);
        return {
          ...row,
          alternateExercises: [...new Set(next)]
        };
      })
    }));
    setVariantDrafts((current) => ({ ...current, [itemId]: "" }));
  };

  const removeAlternativeExercise = (itemId: string, exerciseNameToRemove: string) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((row) => {
        if (row.id !== itemId) return row;
        const next = (row.alternateExercises ?? []).filter((entry) => entry !== exerciseNameToRemove);
        return {
          ...row,
          alternateExercises: next.length ? next : undefined
        };
      })
    }));
  };

  const addNewItemAlternativeExercise = () => {
    const value = newItemAlternateDraft.trim();
    if (!value) return;
    setNewItemAlternateExercises((current) => [...new Set([...current, value])]);
    setNewItemAlternateDraft("");
  };

  const removeNewItemAlternativeExercise = (exerciseNameToRemove: string) => {
    setNewItemAlternateExercises((current) => current.filter((entry) => entry !== exerciseNameToRemove));
  };

  useEffect(() => {
    if (selectedId === "new") {
      setDraft(emptyRoutine());
      return;
    }
    const current = state.routines.find((routine) => routine.id === selectedId);
    if (current) setDraft(current);
  }, [selectedId, state.routines]);

  useEffect(() => {
    const selectedExists = selectedId ? state.routines.some((routine) => routine.id === selectedId) : false;
    if (selectedId === "new" || selectedExists) return;
    const fallback = state.settings.activeRoutineId && state.routines.some((routine) => routine.id === state.settings.activeRoutineId)
      ? state.settings.activeRoutineId
      : state.routines[0]?.id;
    if (fallback) setSelectedId(fallback);
  }, [selectedId, state.routines, state.settings.activeRoutineId]);

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
  const uniqueDays = useMemo(() => [...new Set(draft.items.map((item) => item.dayLabel))], [draft.items]);

  const addItem = () => {
    const trimmed = exerciseName.trim();
    if (!trimmed) return;
    const nextOrder = draft.items.filter((item) => item.dayLabel === dayLabel).length + 1;
    const alternates = [...new Set(newItemAlternateExercises.map((entry) => entry.trim()).filter(Boolean))];
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: createId("ri"),
          dayLabel,
          exerciseName: trimmed,
          muscleGroup,
          reps,
          sets,
          restSeconds,
          order: nextOrder,
          alternateExercises: alternates.length ? alternates : undefined,
        }
      ]
    }));
    setExerciseName("");
    setRestSeconds(60);
    setNewItemAlternateExercises([]);
    setNewItemAlternateDraft("");
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
    setNewItemAlternateExercises([]);
    setNewItemAlternateDraft("");
    setVariantDrafts({});
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
                  className={`rounded-2xl border p-4 text-left transition ${selected ? "border-primary bg-[rgba(124,140,255,0.10)]" : "border-border bg-surface-2"}`}
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

                  {draft.items.length ? (
                    <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Días de la semana</div>
                      <div className="mt-3 space-y-3">
                        {uniqueDays.map((label) => (
                          <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-3 py-2">
                            <div className="text-sm font-semibold">{label}</div>
                            <SelectField
                              className="w-44"
                              value={draft.scheduledWeekDays?.[label] ?? ""}
                              onChange={(e) => {
                                const value = e.target.value as "" | WeekDay;
                                setDraft((current) => {
                                  const next = { ...(current.scheduledWeekDays ?? {}) };
                                  if (!value) {
                                    delete next[label];
                                  } else {
                                    next[label] = value;
                                  }
                                  return {
                                    ...current,
                                    scheduledWeekDays: Object.keys(next).length ? next : undefined
                                  };
                                });
                              }}
                            >
                              {weekDays.map((day) => (
                                <option key={day || "empty"} value={day}>{day || "Sin asignar"}</option>
                              ))}
                            </SelectField>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <Field label="Ejercicio principal" value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Ej. Press militar" />
                    <div className="rounded-2xl border border-border bg-surface-2 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Otra opción de ejercicio</div>
                      <div className="mt-1 text-xs text-muted-foreground">Agrega variantes para elegir otro movimiento después.</div>
                      <div className="mt-3 flex gap-2">
                        <Field
                          className="flex-1"
                          label="Escribe una variante"
                          value={newItemAlternateDraft}
                          onChange={(e) => setNewItemAlternateDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addNewItemAlternativeExercise();
                            }
                          }}
                          placeholder="Ej. Press en máquina"
                        />
                        <Button variant="secondary" className="self-end gap-2" onClick={addNewItemAlternativeExercise}>
                          <Plus className="h-4 w-4" />
                          Añadir
                        </Button>
                      </div>
                      {newItemAlternateExercises.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {newItemAlternateExercises.map((exercise) => (
                            <span key={exercise} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-foreground">
                              {exercise}
                              <button
                                type="button"
                                className="text-muted-foreground transition hover:text-foreground"
                                onClick={() => removeNewItemAlternativeExercise(exercise)}
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
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Repeticiones" type="number" value={reps} onChange={(e) => setReps(Number(e.target.value))} />
                    <Field label="Series" type="number" value={sets} onChange={(e) => setSets(Number(e.target.value))} />
                    <Field label="Descanso (s)" type="number" min={0} value={restSeconds} onChange={(e) => setRestSeconds(Number(e.target.value))} />
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
                      <Button variant="danger" className="gap-2" onClick={() => {
                        if (!window.confirm("¿Seguro que deseas borrar esta rutina? Esta acción no se puede deshacer.")) return;
                        deleteRoutine(draft.id);
                      }}>
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
                            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                              <Field type="number" value={item.reps} onChange={(e) => updateRoutineItem(item.id, { reps: Number(e.target.value) })} label="Reps" />
                              <Field type="number" value={item.sets} onChange={(e) => updateRoutineItem(item.id, { sets: Number(e.target.value) })} label="Series" />
                              <Field type="number" min={0} value={item.restSeconds ?? 60} onChange={(e) => updateRoutineItem(item.id, { restSeconds: Number(e.target.value) })} label="Descanso (s)" />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1">{item.muscleGroup}</span>
                              <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1">{item.reps} reps</span>
                              <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1">{item.sets} series</span>
                              <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1">{item.restSeconds ?? 60}s</span>
                              <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1">{item.alternateExercises?.length ?? 0} variantes</span>
                            </div>

                            <div className="mt-3 rounded-2xl border border-border bg-surface-2 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Otra opción de ejercicio</div>
                                  <div className="mt-1 text-xs text-muted-foreground">Añade variantes por si quieres cambiar este movimiento durante la rutina.</div>
                                </div>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                                <Field
                                  label="Escribe una variante"
                                  value={variantDrafts[item.id] ?? ""}
                                  onChange={(e) => setVariantDrafts((current) => ({ ...current, [item.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addAlternativeExercise(item.id);
                                    }
                                  }}
                                  placeholder="Ej. Press en máquina"
                                />
                                <Button variant="secondary" className="self-end gap-2" onClick={() => addAlternativeExercise(item.id)}>
                                  <Plus className="h-4 w-4" />
                                  Agregar
                                </Button>
                              </div>

                              {item.alternateExercises?.length ? (() => {
                                const variants = item.alternateExercises;
                                const preview = variants.slice(0, 3);
                                const remaining = variants.length - preview.length;
                                return (
                                  <div className="mt-3 rounded-2xl border border-border bg-surface px-3 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Otras opciones de ejercicio</div>
                                        <div className="mt-1 text-xs text-muted-foreground">{variants.length} variantes guardadas</div>
                                      </div>
                                      <div className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                                        {variants.length}
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {preview.map((exercise) => (
                                        <span key={exercise} className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground">
                                          <span className="max-w-[170px] truncate">{exercise}</span>
                                          <button
                                            type="button"
                                            className="text-muted-foreground transition hover:text-foreground"
                                            onClick={() => removeAlternativeExercise(item.id, exercise)}
                                            aria-label={`Eliminar variante ${exercise}`}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </span>
                                      ))}
                                      {remaining > 0 ? (
                                        <span className="inline-flex items-center rounded-full border border-dashed border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-muted-foreground">
                                          +{remaining} más
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })() : (
                                <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface-2 p-3 text-xs text-muted-foreground">Todavía no agregas variantes para este ejercicio.</div>
                              )}
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3">
                              <div className="text-xs text-muted-foreground">Orden: {item.order} · Descanso: {item.restSeconds ?? 60}s</div>
                              <Button variant="secondary" className="gap-2" onClick={() => {
                                setDraft((current) => ({ ...current, items: current.items.filter((row) => row.id !== item.id) }));
                                setVariantDrafts((current) => {
                                  const next = { ...current };
                                  delete next[item.id];
                                  return next;
                                });
                              }}>
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
