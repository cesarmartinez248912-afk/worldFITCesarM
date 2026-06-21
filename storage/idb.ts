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

export async function loadOrSeedState(): Promise<AppState> {
  const existing = await loadState();
  if (existing && existing.schemaVersion === CURRENT_SCHEMA_VERSION) return existing;
  if (existing) {
    await clearState();
  }
  await saveState(seededState);
  return seededState;
}
