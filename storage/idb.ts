import type { AppSettings, AppState } from "@/types";
import { seededState } from "@/storage/seed";

const DB_NAME = "pure-lift-tracker";
const STORE = "state";
const KEY = "main";
const CURRENT_SCHEMA_VERSION = 4;

type StoredState = Partial<AppState> & {
  schemaVersion?: number;
  settings?: Partial<AppSettings>;
};

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB no disponible"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB"));
    request.onsuccess = () => resolve(request.result);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStoredState(input: StoredState): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exercises: Array.isArray(input.exercises) ? (input.exercises as AppState["exercises"]) : [],
    routines: Array.isArray(input.routines) ? (input.routines as AppState["routines"]) : [],
    goals: Array.isArray(input.goals) ? (input.goals as AppState["goals"]) : [],
    sessions: Array.isArray(input.sessions) ? (input.sessions as AppState["sessions"]) : [],
    weekSchedules: Array.isArray(input.weekSchedules) ? (input.weekSchedules as AppState["weekSchedules"]) : [],
    settings: {
      ...seededState.settings,
      ...(input.settings ?? {}),
      activeRoutineId: input.settings?.activeRoutineId,
      lastBackupExportAt: input.settings?.lastBackupExportAt
    },
    lastUpdated: typeof input.lastUpdated === "string" ? input.lastUpdated : new Date().toISOString()
  };
}

function migrateV1toV2(state: StoredState): StoredState {
  return {
    ...state,
    schemaVersion: 2,
    weekSchedules: Array.isArray(state.weekSchedules) ? state.weekSchedules : [],
    settings: {
      ...seededState.settings,
      ...(state.settings ?? {})
    }
  };
}

function migrateV2toV3(state: StoredState): StoredState {
  return {
    ...state,
    schemaVersion: 3,
    weekSchedules: Array.isArray(state.weekSchedules) ? state.weekSchedules : [],
    settings: {
      ...seededState.settings,
      ...(state.settings ?? {})
    }
  };
}

function migrateV3toV4(state: StoredState): StoredState {
  return {
    ...state,
    schemaVersion: 4,
    settings: {
      ...seededState.settings,
      ...(state.settings ?? {}),
      lastBackupExportAt: state.settings?.lastBackupExportAt
    }
  };
}

const migrations: Record<number, (state: StoredState) => StoredState> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4
};

function migrateStoredState(input: unknown): AppState | null {
  if (!isRecord(input)) return null;

  const rawVersion = Number(input.schemaVersion);
  let current: StoredState = {
    ...(input as StoredState)
  };

  let version = Number.isFinite(rawVersion) && rawVersion > 0 ? rawVersion : 1;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations[version];
    current = migration ? migration(current) : { ...current, schemaVersion: version + 1 };
    version += 1;
  }

  return normalizeStoredState(current);
}

export async function loadState(): Promise<AppState | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const request = store.get(KEY);
    request.onerror = () => reject(request.error ?? new Error("No se pudo leer estado"));
    request.onsuccess = () => resolve((request.result as AppState | undefined) ?? null);
  });
}

export async function saveState(state: AppState): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo guardar estado"));
    tx.objectStore(STORE).put(state, KEY);
  });
}

export async function clearState(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo limpiar estado"));
    tx.objectStore(STORE).delete(KEY);
  });
}

export function normalizeImportedState(input: unknown): AppState | null {
  return migrateStoredState(input);
}

export async function loadOrSeedState(): Promise<AppState> {
  const existing = await loadState();
  if (existing) {
    const migrated = migrateStoredState(existing);
    if (migrated) {
      if (migrated.schemaVersion !== existing.schemaVersion || migrated.lastUpdated !== existing.lastUpdated) {
        await saveState(migrated);
      }
      return migrated;
    }
  }

  await saveState(seededState);
  return seededState;
}
