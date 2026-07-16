import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Entrar — Corretor SaaS";
  }, []);

  if (loading) return null;
  if (user) return <Navigate to="/app" replace />;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      nav("/app");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div
            className="h-12 w-12 rounded-xl mx-auto mb-3 flex items-center justify-center text-primary-foreground font-bold text-xl shadow-md"
            style={{ background: "var(--gradient-primary)" }}
          >
            C
          </div>
          <h1 className="text-2xl font-semibold">Corretor SaaS</h1>
          <p className="text-sm text-muted-foreground">Gestão de planos de saúde e odontológicos</p>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Bem-vindo</CardTitle>
            <CardDescription>Acesso restrito à equipe autorizada.</CardDescription>
          </CardHeader>
          <CardContent>
                <form onSubmit={submit} className="space-y-3 mt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-in">E-mail</Label>
                    <Input id="email-in" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-in">Senha</Label>
                    <Input id="pw-in" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  <Button type="submit" disabled={busy} className="w-full">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
