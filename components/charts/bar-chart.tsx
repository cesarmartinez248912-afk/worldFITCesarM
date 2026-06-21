import { cn } from "@/utils/cn";

export function BarChart({
  data,
  className,
}: {
  data: { label: string; value: number }[];
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("flex h-40 items-end gap-2 rounded-2xl border border-border bg-surface-2 p-3", className)}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="text-[10px] font-medium text-muted-foreground">{d.label}</div>
          <div className="flex h-28 w-full items-end rounded-full bg-white/5 p-1">
            <div
              className="w-full rounded-full bg-[rgba(255,179,181,0.70)]"
              style={{ height: `${Math.max(8, (d.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
