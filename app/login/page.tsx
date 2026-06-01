"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3 rounded-md bg-[#071033] p-3 text-white">
            <Image src="/brand/mi-chofer-logo.jpeg" alt="Mi Chofer" width={54} height={54} className="size-14 rounded-md object-cover" />
            <div>
              <p className="text-sm text-white/70">Viaja con confianza</p>
              <p className="text-xl font-bold">Mi Chofer</p>
            </div>
          </div>
          <CardTitle>Ingresar a Mi Chofer ERP</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={login}>
            <Input type="email" placeholder="email@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input type="password" placeholder="Contraseña" value={password} onChange={(event) => setPassword(event.target.value)} />
            {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <Button type="submit" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
