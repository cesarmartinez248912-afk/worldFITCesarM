import { cn } from "@/utils/cn";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles: Record<string, string> = {
    primary: "bg-primary text-primary-foreground shadow-glow",
    secondary: "bg-surface-3 text-foreground border border-border",
    ghost: "bg-transparent text-foreground",
    danger: "bg-danger text-danger-foreground"
  };
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-border bg-surface shadow-soft", className)}>{children}</div>;
}

export function Field({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      {label ? <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span> : null}
      <input
        className="h-12 rounded-2xl border border-border bg-surface-2 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        {...props}
      />
    </label>
  );
}

export function SelectField({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      {label ? <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span> : null}
      <select
        className="h-12 rounded-2xl border border-border bg-surface-2 px-4 text-sm text-foreground outline-none focus:border-primary"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        // FIX 16: el control puede deshabilitarse sin perder la UI visible.
        if (!disabled) onChange(!checked);
      }}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full border border-border transition disabled:pointer-events-none disabled:opacity-50",
        checked ? "bg-primary" : "bg-surface-3"
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

export function SegmentedControl({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid rounded-2xl border border-border bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={cn(
            "rounded-[0.95rem] px-3 py-2 text-xs font-semibold transition",
            value === item ? "bg-surface-4 text-foreground shadow-soft" : "text-muted-foreground"
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
