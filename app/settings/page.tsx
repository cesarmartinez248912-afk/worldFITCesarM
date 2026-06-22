"use client";

import { Download, FileDown, LogOut, MoonStar, RefreshCw, Scale, Settings2, Bell, SunMedium } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsTopBar } from "@/components/top-bar";
import { Button, Card, SelectField, Toggle } from "@/components/ui";
import { useAppStore } from "@/hooks/use-app-store";
import { useAuth } from "@/components/providers";
import type { ThemeMode, UnitSystem } from "@/types";

function download(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const router = useRouter();
  const { state, updateSettings, resetData } = useAppStore();
  const { logout } = useAuth();

  const exportJson = () => {
    download(`worldfit-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");
  };

  const exportCsv = () => {
    const rows = [
      ["session_title", "date", "exercise", "muscle_group", "weight", "reps", "sets", "volume"].join(","),
      ...state.sessions.flatMap((session) =>
        session.entries.map((entry) =>
          [session.title, session.startedAt, entry.exerciseName, entry.muscleGroup, entry.weight, entry.reps, entry.sets, entry.weight * entry.reps * entry.sets].join(",")
        )
      )
    ];
    download(`worldfit-export-${new Date().toISOString().slice(0, 10)}.csv`, rows.join("\n"), "text/csv");
  };

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col overflow-hidden bg-background text-foreground">
      <SettingsTopBar title="Configuración" />
      <div className="flex-1 overflow-y-auto px-5 pb-28 pt-4 scrollbar-hide">
        <Card className="overflow-hidden">
          <Row icon={<Settings2 className="h-4 w-4" />} label="Acceso local" value="Protegido con contraseña" />
          <Row icon={<Scale className="h-4 w-4" />} label="Unidades" right={<SelectField value={state.settings.units} onChange={(e) => updateSettings({ units: e.target.value as UnitSystem })} className="w-28"><option value="kg">kg</option><option value="lb">lb</option></SelectField>} />
          <Row icon={<Bell className="h-4 w-4" />} label="Notificaciones" value="Próximamente" right={<Toggle disabled checked={state.settings.notifications} onChange={(value) => updateSettings({ notifications: value })} />} />
          <Row icon={state.settings.theme === "dark" ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />} label="Tema" right={<SelectField value={state.settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as ThemeMode })} className="w-28"><option value="dark">Oscuro</option><option value="light">Claro</option></SelectField>} />
        </Card>

        <Card className="mt-4 overflow-hidden">
          <Row icon={<Download className="h-4 w-4" />} label="Exportar JSON" onClick={exportJson} />
          <Row icon={<FileDown className="h-4 w-4" />} label="Exportar CSV" onClick={exportCsv} />
          <Row icon={<RefreshCw className="h-4 w-4" />} label="Borrar todo y reiniciar" onClick={() => {
            if (!window.confirm("¿Seguro que deseas borrar todos tus datos? Esta acción no se puede deshacer.")) return;
            resetData();
          }} />
          <Row icon={<LogOut className="h-4 w-4" />} label="Cerrar sesión" onClick={logout} />
        </Card>

        <Card className="mt-4 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estado</div>
          <div className="mt-2 text-lg font-semibold">Offline listo</div>
          <div className="mt-1 text-sm text-muted-foreground">Los entrenamientos se guardan localmente en este dispositivo.</div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Versión</div>
              <div className="text-xs text-muted-foreground">IndexedDB · PWA</div>
            </div>
            <div className="text-sm text-muted-foreground">2.0.0</div>
          </div>
        </Card>

        <div className="mt-4 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => router.push("/")}>Volver</Button>
          <Button className="flex-1" onClick={exportJson}>Guardar copia</Button>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value, right, onClick }: { icon: ReactNode; label: string; value?: string; right?: ReactNode; onClick?: () => void }) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-3 text-muted-foreground">{icon}</div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          {value ? <div className="text-xs text-muted-foreground">{value}</div> : null}
        </div>
      </div>
      {right ?? null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-4 text-left last:border-b-0">
        {content}
      </button>
    );
  }

  return <div className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-4 text-left last:border-b-0">{content}</div>;
}
