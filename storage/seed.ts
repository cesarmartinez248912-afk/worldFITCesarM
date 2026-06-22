import type { AppState } from "@/types";

export const seededState: AppState = {
  schemaVersion: 4,
  exercises: [],
  routines: [],
  goals: [],
  sessions: [],
  weekSchedules: [],
  settings: {
    theme: "dark",
    units: "kg",
    notifications: true,
    activeRoutineId: undefined,
    lastBackupExportAt: undefined
  },
  lastUpdated: new Date().toISOString()
};
