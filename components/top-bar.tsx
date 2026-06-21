import { ChevronLeft, Settings, Share2 } from "lucide-react";
import Link from "next/link";

export function ModalTopBar({ title, backHref = "/", closeLabel = "Atrás" }: { title: string; backHref?: string; closeLabel?: string }) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-5 pb-3 pt-5 backdrop-blur-xl">
      <Link href={backHref} className="flex items-center gap-1 text-sm font-medium text-primary">
        <ChevronLeft className="h-5 w-5" />
        <span>{closeLabel}</span>
      </Link>
      <div className="text-base font-semibold">{title}</div>
      <div className="w-[52px]" />
    </div>
  );
}

export function SettingsTopBar({ title, backHref = "/" }: { title: string; backHref?: string }) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background px-5 pb-3 pt-5 backdrop-blur-xl">
      <Link href={backHref} className="flex items-center gap-2 text-sm font-medium text-primary">
        <ChevronLeft className="h-5 w-5" />
        <span>Volver</span>
      </Link>
      <div className="text-base font-semibold">{title}</div>
      <div className="w-[52px]" />
    </div>
  );
}

export function SimpleActions({ settingsHref = "/settings" }: { settingsHref?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={settingsHref} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-2 text-muted-foreground">
        <Settings className="h-4 w-4" />
      </Link>
    </div>
  );
}
