import { cn } from "@/utils/cn";

export function LineChart({
  data,
  className,
}: {
  data: { label: string; value: number }[];
  className?: string;
}) {
  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const points = data
    .map((d, index) => {
      const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 100;
      const y = 100 - (d.value / max) * 80 - 10;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className={cn("relative h-40 w-full overflow-hidden rounded-2xl border border-border bg-surface-2", className)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="var(--primary)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" points={points} />
        {data.map((d, index) => {
          const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 100;
          const y = 100 - (d.value / max) * 80 - 10;
          return <circle key={`${d.label}-${index}`} cx={x} cy={y} r="1.7" fill="var(--background)" stroke="var(--primary)" strokeWidth="2" />;
        })}
        <polygon
          fill="url(#chartFill)"
          points={`0,100 ${points} 100,100`}
          opacity="0.9"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 px-3 pb-3">
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
            <div className="text-[10px] font-medium text-muted-foreground">{d.label}</div>
            <div className="h-1.5 w-full rounded-full bg-white/5">
              <div className="h-full rounded-full bg-[rgba(255,179,181,0.60)]" style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
