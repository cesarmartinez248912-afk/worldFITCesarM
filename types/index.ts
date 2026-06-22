export type ThemeMode = "dark" | "light";
export type UnitSystem = "kg" | "lb";

export type MuscleGroup =
  | "Pecho"
  | "Espalda"
  | "Pierna"
  | "Hombros"
  | "Bíceps"
  | "Tríceps"
  | "Core"
  | "Cardio"
  | "Full Body"
  | "Otro";

export type WeekDay =
  | "Lunes"
  | "Martes"
  | "Miércoles"
  | "Jueves"
  | "Viernes"
  | "Sábado"
  | "Domingo";

export type ScheduledDayStatus = "pending" | "done" | "missed" | "skipped";

export interface ScheduledDay {
  weekDay: WeekDay;
  routineDay: string;
  status: ScheduledDayStatus;
  sessionId?: string;
  missedAt?: string;
}

export interface WeekSchedule {
  id: string;
  routineId: string;
  weekStart: string;
  days: ScheduledDay[];
  createdAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  createdAt: string;
  isCustom?: boolean;
}

export interface RoutineItem {
  id: string;
  dayLabel: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  reps: number;
  sets: number;
  restSeconds?: number;
  order: number;
  notes?: string;
  alternateExercises?: string[];
}

export interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  items: RoutineItem[];
  scheduledWeekDays?: Partial<Record<string, WeekDay>>;
}

export interface WorkoutEntry {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  weight: number;
  reps: number;
  sets: number;
  restSeconds?: number;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  title: string;
  startedAt: string;
  completedAt: string;
  durationMinutes: number;
  notes?: string;
  entries: WorkoutEntry[];
  routineId?: string;
  routineName?: string;
  routineDay?: string;
}

export interface Goal {
  id: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  targetWeight: number;
  currentWeight: number;
  targetDate: string;
  createdAt: string;
  completed: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  units: UnitSystem;
  notifications: boolean;
  activeRoutineId?: string;
}

export interface AppState {
  schemaVersion: number;
  exercises: Exercise[];
  routines: RoutineTemplate[];
  sessions: WorkoutSession[];
  goals: Goal[];
  weekSchedules: WeekSchedule[];
  settings: AppSettings;
  lastUpdated: string;
}

export interface DashboardSummary {
  weeklyVolume: number;
  monthlyVolume: number;
  bestExercise: string;
  latestPR: string;
  mostWorkedGroup: string;
  leastWorkedGroup: string;
  activeGoals: number;
  totalGoals: number;
  weeklyReps: number;
  weeklySets: number;
  trendLabel: string;
}

export interface ExerciseProgressPoint {
  date: string;
  value: number;
}

export interface PeriodComparison {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
}
