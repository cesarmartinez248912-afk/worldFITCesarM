import type { AppState } from "@/types";
import { seededState } from "@/storage/seed";

const DB_NAME = "pure-lift-tracker";
const STORE = "state";
const KEY = "main";
const CURRENT_SCHEMA_VERSION = 3;

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

// FIX 1: migración acumulativa sin borrar datos existentes.
function applyDefaults(state: Partial<AppState> & { schemaVersion: number }): AppState {
  const settings = state.settings ?? seededState.settings;
  return {
    schemaVersion: state.schemaVersion,
    exercises: Array.isArray(state.exercises) ? state.exercises : [],
    routines: Array.isArray(state.routines) ? state.routines : [],
    sessions: Array.isArray(state.sessions) ? state.sessions : [],
    goals: Array.isArray(state.goals) ? state.goals : [],
    settings: {
      theme: settings.theme ?? seededState.settings.theme,
      units: settings.units ?? seededState.settings.units,
      notifications: settings.notifications ?? seededState.settings.notifications,
      activeRoutineId: settings.activeRoutineId,
    },
    lastUpdated: typeof state.lastUpdated === "string" ? state.lastUpdated : seededState.lastUpdated,
  };
}

function migrateState(state: Partial<AppState> & { schemaVersion: number }): AppState {
  let current = applyDefaults(state);

  for (let version = current.schemaVersion; version < CURRENT_SCHEMA_VERSION; version += 1) {
    switch (version) {
      case 1:
      case 2:
        current = {
          ...applyDefaults({ ...current, schemaVersion: version + 1 }),
          schemaVersion: version + 1,
        };
        break;
      default:
        return seededState;
    }
  }

  return current;
}

export async function loadOrSeedState(): Promise<AppState> {
  const existing = await loadState();

  if (!existing) {
    await saveState(seededState);
    return seededState;
  }

  const version = existing.schemaVersion;

  if (version === CURRENT_SCHEMA_VERSION) {
    return existing;
  }

  if (version === undefined || version === 0 || version > CURRENT_SCHEMA_VERSION) {
    console.warn("WorldFit: schemaVersion inválida, se restauró el estado semilla.");
    await saveState(seededState);
    return seededState;
  }

  const migrated = migrateState(existing as Partial<AppState> & { schemaVersion: number });
  await saveState(migrated);
  return migrated;
}
