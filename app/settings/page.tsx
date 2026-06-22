"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileDown, FileUp, LogOut, MoonStar, RefreshCw, Scale, Settings2, Bell, SunMedium, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsTopBar } from "@/components/top-bar";
import { Button, Card, SelectField, Toggle } from "@/components/ui";
import { useAppStore } from "@/hooks/use-app-store";
import { useAuth } from "@/components/providers";
import { normalizeImportedState } from "@/storage/idb";
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

function formatDaysSince(dateIso?: string) {
  if (!dateIso) return "Nunca";
  const diff = Date.now() - new Date(dateIso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "Hoy";
  return `${Math.floor(diff / (1000 * 60 * 60 * 24))} días`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { state, updateSettings, resetData, replaceState } = useAppStore();
  const { logout } = useAuth();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [storagePersistStatus, setStoragePersistStatus] = useState<"desconocido" | "concedido" | "no concedido">("desconocido");

  useEffect(() => {
    const persisted = localStorage.getItem("pure-lift-storage-persist");
    if (persisted === "1") setStoragePersistStatus("concedido");
    else if (persisted === "0") setStoragePersistStatus("no concedido");
  }, []);

  const exportJson = () => {
    const exportedAt = new Date().toISOString();
    const nextState = {
      ...state,
      settings: {
        ...state.settings,
        lastBackupExportAt: exportedAt
      }
    };
    updateSettings({ lastBackupExportAt: exportedAt });
    download(`worldfit-backup-${exportedAt.slice(0, 10)}.json`, JSON.stringify(nextState, null, 2), "application/json");
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

  const openImportPicker = () => {
    importInputRef.current?.click();
  };

  const importBackup = async (file: File | null) => {
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith(".json")) {
        window.alert("Selecciona un archivo .json exportado desde WorldFit.");
        return;
      }

      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        window.alert("El archivo no es un JSON válido.");
        return;
      }

      const normalized = normalizeImportedState(parsed);
      if (!normalized) {
        window.alert("La copia de seguridad no tiene la estructura esperada.");
        return;
      }

      const shouldOverwrite = window.confirm(
        "Esto reemplazará TODOS los datos actuales de la app por los contenidos del backup. ¿Deseas continuar?"
      );
      if (!shouldOverwrite) return;

      replaceState(normalized);
      window.alert("Copia de seguridad importada correctamente.");
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    } catch {
      window.alert("No se pudo leer la copia de seguridad.");
    }
  };

  const backupReminderDue = !state.settings.lastBackupExportAt || Date.now() - new Date(state.settings.lastBackupExportAt).getTime() > 1000 * 60 * 60 * 24 * 30;

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col overflow-hidden bg-background text-foreground">
      <SettingsTopBar title="Configuración" />
      <div className="flex-1 overflow-y-auto px-5 pb-28 pt-4 scrollbar-hide">
        <Card className="overflow-hidden">
          <Row icon={<Settings2 className="h-4 w-4" />} label="Acceso local" value="Bloqueo suave en el dispositivo" />
          <Row icon={<Scale className="h-4 w-4" />} label="Unidades" right={<SelectField value={state.settings.units} onChange={(e) => updateSettings({ units: e.target.value as UnitSystem })} className="w-28"><option value="kg">kg</option><option value="lb">lb</option></SelectField>} />
          <Row icon={<Bell className="h-4 w-4" />} label="Notificaciones" value="Próximamente" right={<Toggle disabled checked={state.settings.notifications} onChange={(value) => updateSettings({ notifications: value })} />} />
          <Row icon={state.settings.theme === "dark" ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />} label="Tema" right={<SelectField value={state.settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as ThemeMode })} className="w-28"><option value="dark">Oscuro</option><option value="light">Claro</option></SelectField>} />
        </Card>

        <Card className="mt-4 overflow-hidden">
          <Row icon={<Download className="h-4 w-4" />} label="Exportar JSON" onClick={exportJson} />
          <Row icon={<FileDown className="h-4 w-4" />} label="Exportar CSV" onClick={exportCsv} />
          <Row icon={<FileUp className="h-4 w-4" />} label="Importar copia de seguridad" onClick={openImportPicker} />
          <Row icon={<RefreshCw className="h-4 w-4" />} label="Borrar todo y reiniciar" onClick={() => {
            if (!window.confirm("¿Seguro que deseas borrar todos tus datos? Esta acción no se puede deshacer.")) return;
            resetData();
          }} />
          <Row icon={<LogOut className="h-4 w-4" />} label="Cerrar sesión" onClick={logout} />
        </Card>

        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            void importBackup(e.target.files?.[0] ?? null);
          }}
        />

        <Card className={`mt-4 p-4 ${backupReminderDue ? "border border-warning/40 bg-[rgba(255,179,181,0.06)]" : ""}`}>
          <div className="flex items-start gap-3">
            <div className={`grid h-10 w-10 place-items-center rounded-full ${backupReminderDue ? "bg-[rgba(255,179,181,0.16)] text-warning" : "bg-surface-2 text-muted-foreground"}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Respaldo</div>
              <div className="mt-1 text-lg font-semibold">
                {backupReminderDue ? "Haz una copia de seguridad" : "Tu copia de seguridad está al día"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Última exportación: {formatDaysSince(state.settings.lastBackupExportAt)}.
              </div>
            </div>
          </div>
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
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Persistencia</div>
              <div className="text-xs text-muted-foreground">Evita que Safari limpie datos por presión de espacio</div>
            </div>
            <div className="text-sm text-muted-foreground">{storagePersistStatus}</div>
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
