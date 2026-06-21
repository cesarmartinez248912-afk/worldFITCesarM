import type { AppState, DashboardSummary, ExerciseProgressPoint, Goal, MuscleGroup, PeriodComparison, RoutineTemplate, WorkoutEntry, WorkoutSession } from "@/types";
import { formatDateLabel } from "@/utils/format";

const GROUPS: MuscleGroup[] = ["Pecho", "Espalda", "Pierna", "Hombros", "Bíceps", "Tríceps", "Core", "Cardio", "Full Body", "Otro"];

export function entryVolume(entry: WorkoutEntry): number {
  return entry.weight * entry.reps * entry.sets;
}

export function sessionVolume(session: WorkoutSession): number {
  return session.entries.reduce((total, entry) => total + entryVolume(entry), 0);
}

export function sessionReps(session: WorkoutSession): number {
  return session.entries.reduce((total, entry) => total + entry.reps * entry.sets, 0);
}

export function sessionSets(session: WorkoutSession): number {
  return session.entries.reduce((total, entry) => total + entry.sets, 0);
}

export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export function sortSessionsNewestFirst(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
}

export function getWeeklyRange(now = new Date()): { start: Date; end: Date; previousStart: Date; previousEnd: Date } {
  const end = new Date(now);
  const day = (end.getDay() + 6) % 7;
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const previousEnd = new Date(start);
  previousEnd.setMilliseconds(-1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - 6);
  previousStart.setHours(0, 0, 0, 0);
  return { start, end, previousStart, previousEnd };
}

// FIX 8: una sola pasada para volumen, reps y series en el rango pedido.
function periodStats(sessions: WorkoutSession[], start: Date, end: Date): { volume: number; reps: number; sets: number } {
  let volume = 0;
  let reps = 0;
  let sets = 0;
  const startMs = start.getTime();
  const endMs = end.getTime();

  for (const session of sessions) {
    const time = new Date(session.startedAt).getTime();
    if (time < startMs || time > endMs) continue;
    volume += sessionVolume(session);
    reps += sessionReps(session);
    sets += sessionSets(session);
  }

  return { volume, reps, sets };
}

function periodVolume(sessions: WorkoutSession[], start: Date, end: Date): number {
  return periodStats(sessions, start, end).volume;
}

function periodReps(sessions: WorkoutSession[], start: Date, end: Date): number {
  return periodStats(sessions, start, end).reps;
}

function periodSets(sessions: WorkoutSession[], start: Date, end: Date): number {
  return periodStats(sessions, start, end).sets;
}

function periodComparison(current: number, previous: number): PeriodComparison {
  const delta = current - previous;
  const deltaPercent = previous === 0 ? (current > 0 ? 100 : 0) : (delta / previous) * 100;
  return { current, previous, delta, deltaPercent };
}

export function weekComparison(sessions: WorkoutSession[], now = new Date()): {
  volume: PeriodComparison;
  reps: PeriodComparison;
  sets: PeriodComparison;
  label: string;
} {
  const { start, end, previousStart, previousEnd } = getWeeklyRange(now);
  const current = periodStats(sessions, start, end);
  const previous = periodStats(sessions, previousStart, previousEnd);
  return {
    volume: periodComparison(current.volume, previous.volume),
    reps: periodComparison(current.reps, previous.reps),
    sets: periodComparison(current.sets, previous.sets),
    label: `${start.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`
  };
}

export function getMonthlyVolume(sessions: WorkoutSession[], now = new Date()): number {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return sessions
    .filter((session) => new Date(session.startedAt).getTime() >= monthStart)
    .reduce((total, session) => total + sessionVolume(session), 0);
}

export function getYearlyVolume(sessions: WorkoutSession[], now = new Date()): number {
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  return sessions
    .filter((session) => new Date(session.startedAt).getTime() >= yearStart)
    .reduce((total, session) => total + sessionVolume(session), 0);
}

export function groupVolumeByMuscle(sessions: WorkoutSession[]): Record<MuscleGroup, number> {
  const result = Object.fromEntries(GROUPS.map((group) => [group, 0])) as Record<MuscleGroup, number>;
  for (const session of sessions) {
    for (const entry of session.entries) {
      result[entry.muscleGroup] += entryVolume(entry);
    }
  }
  return result;
}

export function mostAndLeastWorkedGroup(sessions: WorkoutSession[]): { most: string; least: string } {
  const volume = groupVolumeByMuscle(sessions);
  const entries = GROUPS.map((group) => [group, volume[group]] as const).filter(([, value]) => value > 0);
  if (entries.length === 0) return { most: "Sin datos", least: "Sin datos" };
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  return { most: sorted[0][0], least: sorted[sorted.length - 1][0] };
}

export function bestExerciseName(sessions: WorkoutSession[]): string {
  const best: Record<string, number> = {};
  for (const session of sessions) {
    for (const entry of session.entries) {
      const score = estimateOneRepMax(entry.weight, entry.reps);
      best[entry.exerciseName] = Math.max(best[entry.exerciseName] ?? 0, score);
    }
  }
  const sorted = Object.entries(best).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "Sin datos";
}

// FIX 4: iterar de más antigua a más reciente para que el último PR sea realmente el más reciente.
export function latestPRLabel(sessions: WorkoutSession[]): string {
  const sorted = [...sessions].sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt));
  const allTimeBest: Record<string, number> = {};
  let latestPR = "";

  for (const session of sorted) {
    for (const entry of session.entries) {
      const score = estimateOneRepMax(entry.weight, entry.reps);
      const bestSoFar = allTimeBest[entry.exerciseName] ?? 0;
      if (score > bestSoFar) {
        allTimeBest[entry.exerciseName] = score;
        latestPR = `${entry.exerciseName} · ${Math.round(score)} kg 1RM · ${formatDateLabel(session.startedAt)}`;
      }
    }
  }

  return latestPR || "Sin récord reciente";
}

export function latestSession(sessions: WorkoutSession[]): WorkoutSession | undefined {
  return sortSessionsNewestFirst(sessions)[0];
}

export function compareSessions(current: WorkoutSession, previous?: WorkoutSession) {
  const prev = previous ?? undefined;
  const currentBest = Math.max(...current.entries.map((entry) => estimateOneRepMax(entry.weight, entry.reps)));
  const previousBest = prev ? Math.max(...prev.entries.map((entry) => estimateOneRepMax(entry.weight, entry.reps))) : 0;
  const currentTopWeight = Math.max(...current.entries.map((entry) => entry.weight));
  const previousTopWeight = prev ? Math.max(...prev.entries.map((entry) => entry.weight)) : 0;
  return {
    currentVolume: sessionVolume(current),
    previousVolume: prev ? sessionVolume(prev) : 0,
    volumeDelta: sessionVolume(current) - (prev ? sessionVolume(prev) : 0),
    repsDelta: sessionReps(current) - (prev ? sessionReps(prev) : 0),
    setsDelta: sessionSets(current) - (prev ? sessionSets(prev) : 0),
    best1rmDelta: currentBest - previousBest,
    topWeightDelta: currentTopWeight - previousTopWeight,
    currentBest,
    previousBest,
  };
}

export function previousSessionWithSameRoutine(current: WorkoutSession, sessions: WorkoutSession[]): WorkoutSession | undefined {
  const sorted = sortSessionsNewestFirst(sessions).filter((session) => session.id !== current.id && session.startedAt < current.startedAt);
  if (current.routineId) {
    const byRoutine = sorted.find((session) => session.routineId === current.routineId);
    if (byRoutine) return byRoutine;
  }
  if (current.title) {
    const byTitle = sorted.find((session) => session.title === current.title);
    if (byTitle) return byTitle;
  }
  return sorted[0];
}

export function progressByExercise(sessions: WorkoutSession[], exerciseName: string): ExerciseProgressPoint[] {
  return sortSessionsNewestFirst(sessions)
    .filter((session) => session.entries.some((entry) => entry.exerciseName === exerciseName))
    .slice(0, 12)
    .reverse()
    .map((session) => {
      const relevant = session.entries.filter((entry) => entry.exerciseName === exerciseName);
      const best = Math.max(...relevant.map((entry) => estimateOneRepMax(entry.weight, entry.reps)));
      return { date: session.startedAt, value: best };
    });
}

export function weeklyBuckets(sessions: WorkoutSession[], bucketCount = 7): { label: string; value: number }[] {
  const now = new Date();
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (bucketCount - 1 - index));
    return { date, value: 0 };
  });
  for (const session of sessions) {
    const time = new Date(session.startedAt).getTime();
    const dt = new Date(time);
    for (const bucket of buckets) {
      const sameDay =
        bucket.date.getFullYear() === dt.getFullYear() &&
        bucket.date.getMonth() === dt.getMonth() &&
        bucket.date.getDate() === dt.getDate();
      if (sameDay) {
        bucket.value += sessionVolume(session);
      }
    }
  }
  return buckets.map((bucket) => ({
    label: bucket.date.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", ""),
    value: bucket.value
  }));
}

export function monthlyBuckets(sessions: WorkoutSession[]): { label: string; value: number }[] {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const buckets = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), index + 1);
    return { date, value: 0 };
  });
  for (const session of sessions) {
    const dt = new Date(session.startedAt);
    const day = dt.getDate();
    if (dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()) {
      buckets[day - 1].value += sessionVolume(session);
    }
  }
  return buckets.map((bucket) => ({ label: `${bucket.date.getDate()}`, value: bucket.value }));
}

export function yearlyBuckets(sessions: WorkoutSession[]): { label: string; value: number }[] {
  const now = new Date();
  const buckets = Array.from({ length: 12 }, (_, index) => ({ label: new Date(now.getFullYear(), index, 1).toLocaleDateString("es-MX", { month: "short" }), value: 0 }));
  for (const session of sessions) {
    const dt = new Date(session.startedAt);
    if (dt.getFullYear() === now.getFullYear()) {
      buckets[dt.getMonth()].value += sessionVolume(session);
    }
  }
  return buckets;
}

export function activeGoalsCount(goals: Goal[]): number {
  return goals.filter((goal) => !goal.completed).length;
}

export function improvementTrendLabel(sessions: WorkoutSession[]): string {
  const sorted = sortSessionsNewestFirst(sessions);
  if (sorted.length < 2) return "Sin tendencia";
  const recent = sorted.slice(0, 4).reduce((sum, session) => sum + sessionVolume(session), 0);
  const prev = sorted.slice(4, 8).reduce((sum, session) => sum + sessionVolume(session), 0);
  if (prev === 0) return "Tendencia positiva";
  const diff = ((recent - prev) / prev) * 100;
  if (diff > 0) return `+${diff.toFixed(1)}% vs. período anterior`;
  if (diff < 0) return `${diff.toFixed(1)}% vs. período anterior`;
  return "Sin cambios";
}

export function stagnatingExercises(sessions: WorkoutSession[]): string[] {
  const names = new Set<string>();
  sessions.forEach((session) => session.entries.forEach((entry) => names.add(entry.exerciseName)));
  const stagnant: string[] = [];
  for (const name of names) {
    const points = progressByExercise(sessions, name);
    if (points.length < 3) continue;
    const last = points[points.length - 1]?.value ?? 0;
    const prevMax = Math.max(...points.slice(0, -1).map((p) => p.value));
    if (last <= prevMax) stagnant.push(name);
  }
  return stagnant.slice(0, 3);
}

export function appSummary(state: AppState): DashboardSummary {
  const weekly = weekComparison(state.sessions);
  const monthlyVolume = getMonthlyVolume(state.sessions);
  const bestExercise = bestExerciseName(state.sessions);
  const latestPR = latestPRLabel(state.sessions);
  const groups = mostAndLeastWorkedGroup(state.sessions);
  const activeGoals = activeGoalsCount(state.goals);
  return {
    weeklyVolume: weekly.volume.current,
    monthlyVolume,
    bestExercise,
    latestPR,
    mostWorkedGroup: groups.most,
    leastWorkedGroup: groups.least,
    activeGoals,
    totalGoals: state.goals.length,
    weeklyReps: weekly.reps.current,
    weeklySets: weekly.sets.current,
    trendLabel: improvementTrendLabel(state.sessions)
  };
}

export function sessionsByWeekBucket(sessions: WorkoutSession[]) {
  return weeklyBuckets(sessions);
}
