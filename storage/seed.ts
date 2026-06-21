import type { AppState } from "@/types";

export const seededState: AppState = {
  schemaVersion: 3,
  exercises: [],
  routines: [],
  goals: [],
  sessions: [],
  settings: {
    theme: "dark",
    units: "kg",
    notifications: true,
    activeRoutineId: undefined
  },
  lastUpdated: new Date().toISOString()
};
