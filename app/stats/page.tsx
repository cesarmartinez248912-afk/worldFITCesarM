"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Flame, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { MobileShell, TopAccent } from "@/components/mobile-shell";
import { Card, SelectField } from "@/components/ui";
import { BarChart } from "@/components/charts/bar-chart";
import { LineChart } from "@/components/charts/line-chart";
import { useAppStore } from "@/hooks/use-app-store";
import {
  getMonthlyVolume,
  getYearlyVolume,
  groupVolumeByMuscle,
  stagnatingExercises,
  weekComparison,
  weeklyBuckets,
  monthlyBuckets,
  yearlyBuckets,
  progressByExercise
} from "@/utils/analytics";
import { formatVolume, formatKg } from "@/utils/format";

export default function StatsPage() {
  const { state } = useAppStore();
  const week = weekComparison(state.sessions);
  const monthly = getMonthlyVolume(state.sessions);
  const yearly = getYearlyVolume(state.sessions);
  const byGroup = groupVolumeByMuscle(state.sessions);
  const stagnating = stagnatingExercises(state.sessions);

  const exerciseOptions = useMemo(() => {
    const names = new Set<string>();
    state.sessions.forEach((session) => session.entries.forEach((entry) => names.add(entry.exerciseName)));
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [state.sessions]);

  const [selectedExercise, setSelectedExercise] = useState("");

  useEffect(() => {
    if (!selectedExercise && exerciseOptions.length) {
      setSelectedExercise(exerciseOptions[0]);
    }
    if (selectedExercise && !exerciseOptions.includes(selectedExercise) && exerciseOptions.length) {
      setSelectedExercise(exerciseOptions[0]);
    }
  }, [exerciseOptions, selectedExercise]);

  const exerciseProgress = useMemo(() => progressByExercise(state.sessions, selectedExercise), [state.sessions, selectedExercise]);
  const progressChartData = exerciseProgress.map((point, index) => ({
    label: new Date(point.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
    value: point.value
  }));
  const topValue = exerciseProgress.length ? Math.max(...exerciseProgress.map((point) => point.value)) : 0;
  const latestValue = exerciseProgress.at(-1)?.value ?? 0;
  const firstValue = exerciseProgress[0]?.value ?? 0;

  const groupData = Object.entries(byGroup)
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value }))
    .slice(0, 7);

  return (
    <MobileShell active="/stats">
      <div className="flex-1 overflow-y-auto pb-28 scrollbar-hide">
        <TopAccent subtitle="Progreso" title="Estadísticas" />
        <div className="px-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoCard icon={<TrendingUp className="h-4 w-4" />} label="Semana" value={formatVolume(week.volume.current, state.settings.units)} sub={state.sessions.length ? `${week.volume.delta >= 0 ? "+" : ""}${Math.round(week.volume.deltaPercent)}% vs. semana previa` : "Sin datos todavía"} />
            <InfoCard icon={<BarChart3 className="h-4 w-4" />} label="Mes" value={formatVolume(monthly, state.settings.units)} sub="Volumen acumulado del mes" />
            <InfoCard icon={<Zap className="h-4 w-4" />} label="Año" value={formatVolume(yearly, state.settings.units)} sub="Volumen acumulado del año" />
            <InfoCard icon={<TrendingDown className="h-4 w-4" />} label="Estancados" value={`${stagnating.length}`} sub={stagnating.length ? stagnating.join(", ") : "Sin ejercicios estancados"} />
          </div>

          {state.sessions.length ? (
            <>
              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Evolución semanal</div>
                <BarChart data={weeklyBuckets(state.sessions)} />
              </Card>

              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Evolución mensual</div>
                <LineChart data={monthlyBuckets(state.sessions).slice(-14)} />
              </Card>

              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Evolución anual</div>
                <BarChart data={yearlyBuckets(state.sessions)} />
              </Card>

              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Progreso por ejercicio</div>
                {exerciseOptions.length ? (
                  <div className="space-y-3">
                    <SelectField value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)}>
                      {exerciseOptions.map((exercise) => (
                        <option key={exercise} value={exercise}>
                          {exercise}
                        </option>
                      ))}
                    </SelectField>

                    {selectedExercise ? (
                      <>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <MiniStat label="Inicio" value={formatKg(firstValue, state.settings.units)} />
                          <MiniStat label="Actual" value={formatKg(latestValue, state.settings.units)} />
                          <MiniStat label="Mejor" value={formatKg(topValue, state.settings.units)} />
                        </div>
                        <LineChart data={progressChartData.length ? progressChartData : [{ label: "Sin datos", value: 0 }]} />
                        <div className="text-xs text-muted-foreground">
                          La línea muestra la mejor estimación de 1RM para cada sesión donde apareció este ejercicio.
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-4 text-sm text-muted-foreground">
                    Aún no hay ejercicios suficientes para mostrar una evolución por nombre.
                  </div>
                )}
              </Card>

              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Grupos más trabajados</div>
                <div className="space-y-3">
                  {groupData.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.label}</span>
                        <span>{formatVolume(item.value, state.settings.units)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (item.value / Math.max(...groupData.map((g) => g.value), 1)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full border border-border bg-surface-2 p-3 text-primary">
                  <Flame className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Aún no hay entrenamientos</div>
                  <div className="text-sm text-muted-foreground">Cuando guardes tu primera sesión, aquí aparecerán las gráficas y comparaciones.</div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function InfoCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
          <div className="mt-2 text-lg font-bold">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
        </div>
        <div className="rounded-full border border-border bg-surface-2 p-2 text-primary">{icon}</div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-bold">{value}</div>
    </div>
  );
}
