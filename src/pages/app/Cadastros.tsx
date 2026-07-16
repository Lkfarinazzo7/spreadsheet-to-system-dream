import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { Archive, Plus, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Item = { id: string; nome: string; ativo: boolean };

function CrudList({ table, title }: { table: "operadoras" | "canais_venda" | "categorias_plano"; title: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [nome, setNome] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from(table).select("id,nome,ativo").order("nome");
    if (error) {
      toast({ title: "Erro ao carregar cadastros", description: error.message, variant: "destructive" });
      return;
    }
    setItems((data as Item[]) ?? []);
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

  const toggleActive = async (item: Item) => {
    if (item.ativo && !confirm(`Desativar "${item.nome}"? O histórico dos contratos será preservado.`)) return;
    const { error } = await supabase.from(table).update({ ativo: !item.ativo }).eq("id", item.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: item.ativo ? "Cadastro desativado" : "Cadastro reativado" });
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
            <li key={i.id} className={`flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 text-sm ${i.ativo ? "" : "opacity-60"}`}>
              <span className="flex items-center gap-2">
                {i.nome}
                {!i.ativo && <Badge variant="secondary">Inativo</Badge>}
              </span>
              <Button size="icon" variant="ghost" onClick={() => toggleActive(i)} title={i.ativo ? "Desativar" : "Reativar"}>
                {i.ativo
                  ? <Archive className="h-4 w-4 text-muted-foreground" />
                  : <RotateCcw className="h-4 w-4 text-success" />}
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
