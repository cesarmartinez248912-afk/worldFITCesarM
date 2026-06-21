export function formatKg(value: number, units: "kg" | "lb" = "kg"): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("es-MX")} ${units}`;
}

export function formatVolume(value: number, units: "kg" | "lb" = "kg"): string {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString("es-MX")} ${units}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short"
  }).format(date);
}

export function toIsoDateOnly(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function daysAgo(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / 86400000);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// FIX 15: sum se eliminó porque no se usa en el proyecto.
