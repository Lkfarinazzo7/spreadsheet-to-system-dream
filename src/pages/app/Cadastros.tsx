import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Item = { id: string; nome: string };

function CrudList({ table, title }: { table: "operadoras" | "canais_venda" | "categorias_plano"; title: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [nome, setNome] = useState("");

  const load = async () => {
    const { data } = await supabase.from(table).select("id,nome").order("nome");
    setItems((data as any) ?? []);
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nome.trim()) return;
    const { error } = await supabase.from(table).insert({ user_id: user.id, nome: nome.trim() });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setNome("");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from(table).delete().eq("id", id);
    load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={add} className="flex gap-2 mb-3">
          <Input placeholder="Adicionar..." value={nome} onChange={(e) => setNome(e.target.value)} />
          <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
        </form>
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
              <span>{i.nome}</span>
              <Button size="icon" variant="ghost" onClick={() => remove(i.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function Cadastros() {
  useEffect(() => { document.title = "Cadastros — Corretor SaaS"; }, []);
  return (
    <div>
      <PageHeader title="Cadastros auxiliares" description="Operadoras, canais de venda e categorias de plano" />
      <div className="grid gap-4 lg:grid-cols-3">
        <CrudList table="operadoras" title="Operadoras" />
        <CrudList table="canais_venda" title="Canais de venda" />
        <CrudList table="categorias_plano" title="Categorias de plano" />
      </div>
    </div>
  );
}