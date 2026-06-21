"use client";

import { BarChart3, Flame, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { MobileShell, TopAccent } from "@/components/mobile-shell";
import { Card } from "@/components/ui";
import { BarChart } from "@/components/charts/bar-chart";
import { LineChart } from "@/components/charts/line-chart";
import { useAppStore } from "@/hooks/use-app-store";
import { getMonthlyVolume, getYearlyVolume, groupVolumeByMuscle, stagnatingExercises, weekComparison, weeklyBuckets, monthlyBuckets, yearlyBuckets } from "@/utils/analytics";
import { formatVolume } from "@/utils/format";

export default function StatsPage() {
  const { state } = useAppStore();
  const week = weekComparison(state.sessions);
  const monthly = getMonthlyVolume(state.sessions);
  const yearly = getYearlyVolume(state.sessions);
  const byGroup = groupVolumeByMuscle(state.sessions);
  const stagnating = stagnatingExercises(state.sessions);

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
        <div className="rounded-full border border-border bg-surface-3 p-2 text-primary">{icon}</div>
      </div>
    </Card>
  );
}
