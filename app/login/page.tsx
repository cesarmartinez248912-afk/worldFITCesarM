"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock } from "lucide-react";
import { Button, Card, Field } from "@/components/ui";
import { useAuth } from "@/components/providers";

export default function LoginPage() {
  const router = useRouter();
  const { login, authenticated } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const loginConfigured = Boolean(process.env.NEXT_PUBLIC_WORLD_FIT_PASSWORD);

  useEffect(() => {
    if (authenticated) router.replace("/");
  }, [authenticated, router]);

  const submit = () => {
    const ok = login(password.trim());
    if (ok) {
      router.replace("/");
      return;
    }
    setError(loginConfigured ? "Contraseña incorrecta" : "La contraseña local no está configurada en este build.");
  };

  return (
    <div className="flex min-h-[100svh] items-center justify-center px-5 py-8">
      <Card className="w-full max-w-md p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(255,179,181,0.12)] text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Acceso privado</div>
            <h1 className="text-2xl font-bold">WorldFit</h1>
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Entra con tu clave local para ver tus rutinas, entrenamientos y progreso offline.
        </div>

        <div className="mt-5 space-y-3">
          <Field
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Escribe la contraseña local"
          />
          {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-foreground">{error}</div> : null}
          <Button className="h-12 w-full gap-2" onClick={submit}>
            Entrar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
          El acceso se guarda solo mientras la app siga abierta. Si cierras la pestaña, ventana o app, volverá a pedir la contraseña.
          {!loginConfigured ? <div className="mt-2 text-xs text-warning">Falta configurar NEXT_PUBLIC_WORLD_FIT_PASSWORD en el build.</div> : null}
        </div>
      </Card>
    </div>
  );
}
