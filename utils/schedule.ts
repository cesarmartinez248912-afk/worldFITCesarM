import type { RoutineTemplate, ScheduledDay, WeekDay, WeekSchedule } from "@/types";

export const WEEK_DAYS: WeekDay[] = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo"
];

export function getLocalWeekDay(date = new Date()): WeekDay {
  const map: Record<number, WeekDay> = {
    0: "Domingo",
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado"
  };
  return map[date.getDay()];
}

export function getLocalDateString(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function getLocalISOString(date = new Date()): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function getLocalWeekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return getLocalDateString(d);
}

export function buildWeekSchedule(
  routine: RoutineTemplate,
  weekStart: string
): Omit<WeekSchedule, "id" | "createdAt"> {
  const assigned = routine.scheduledWeekDays ?? {};
  const days: ScheduledDay[] = Object.entries(assigned).flatMap(([routineDay, weekDay]) =>
    weekDay
      ? [{
          weekDay: weekDay as WeekDay,
          routineDay,
          status: "pending" as const
        }]
      : []
  );
  return { routineId: routine.id, weekStart, days };
}

export function sortScheduleDays(days: ScheduledDay[]): ScheduledDay[] {
  return [...days].sort((a, b) => WEEK_DAYS.indexOf(a.weekDay) - WEEK_DAYS.indexOf(b.weekDay));
}

export function missedMuscleGroups(schedule: WeekSchedule, routine: RoutineTemplate): string[] {
  const missed = schedule.days
    .filter((d) => d.status === "missed" || d.status === "pending")
    .map((d) => d.routineDay);

  const groups = new Set<string>();
  for (const dayLabel of missed) {
    for (const item of routine.items) {
      if (item.dayLabel === dayLabel) groups.add(item.muscleGroup);
    }
  }
  return [...groups];
}
