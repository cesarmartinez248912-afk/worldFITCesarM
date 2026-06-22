"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppStoreProvider, useAppStore } from "@/hooks/use-app-store";

const LOGIN_KEY = "worldfit-auth-session";
const LOGIN_PASSWORD = process.env.NEXT_PUBLIC_WORLD_FIT_PASSWORD ?? "";

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

type AuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    try {
      const session = getSessionStorage();
      const isAuthenticated = session?.getItem(LOGIN_KEY) === "1";
      setAuthenticated(isAuthenticated);
      getSessionStorage()?.removeItem(LOGIN_KEY);
      localStorage.removeItem(LOGIN_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (pathname === "/login") {
      if (authenticated) router.replace("/");
      return;
    }
    if (!authenticated) router.replace("/login");
  }, [authenticated, pathname, ready, router]);

  const value = useMemo<AuthContextValue>(() => ({
    ready,
    authenticated,
    login: (password: string) => {
      const ok = Boolean(LOGIN_PASSWORD) && password === LOGIN_PASSWORD;
      if (ok) {
        const session = getSessionStorage();
        session?.setItem(LOGIN_KEY, "1");
        setAuthenticated(true);
      }
      return ok;
    },
    logout: () => {
      getSessionStorage()?.removeItem(LOGIN_KEY);
      localStorage.removeItem(LOGIN_KEY);
      setAuthenticated(false);
      router.replace("/login");
    },
  }), [authenticated, ready, router]);

  if (!ready) return null;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

function ThemeBridge({ children }: { children: ReactNode }) {
  const { state } = useAppStore();

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
    document.documentElement.classList.toggle("dark", state.settings.theme === "dark");
    document.documentElement.classList.toggle("light", state.settings.theme === "light");
    localStorage.setItem("pure-lift-theme", state.settings.theme);
    localStorage.setItem("pure-lift-units", state.settings.units);
  }, [state.settings.theme, state.settings.units]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function requestPersistence() {
      if (!navigator.storage?.persist) return;
      try {
        const granted = await navigator.storage.persist();
        if (cancelled) return;
        localStorage.setItem("pure-lift-storage-persist", granted ? "1" : "0");
        document.documentElement.dataset.storagePersist = granted ? "granted" : "denied";
        console.log(granted ? "WorldFit: almacenamiento persistente concedido" : "WorldFit: almacenamiento persistente no concedido");
      } catch (error) {
        if (cancelled) return;
        localStorage.setItem("pure-lift-storage-persist", "0");
        document.documentElement.dataset.storagePersist = "error";
        console.warn("WorldFit: no se pudo solicitar almacenamiento persistente", error);
      }
    }

    requestPersistence();
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppStoreProvider>
      <AuthProvider>
        <ThemeBridge>{children}</ThemeBridge>
      </AuthProvider>
    </AppStoreProvider>
  );
}
