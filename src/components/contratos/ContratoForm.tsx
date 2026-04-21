import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

type Lookup = { id: string; nome: string };

export type ContratoFormValues = {
  id?: string;
  numero_proposta?: string | null;
  cliente: string;
  tipo: "PJ" | "PF" | "Adesao";
  operadora_id?: string | null;
  canal_id?: string | null;
  categoria_id?: string | null;
  valor_mensal: number;
  proporcao_comissao: number;
  data_vigencia?: string | null;
  status: "Ativo" | "Cancelado" | "Pendente";
  observacoes?: string | null;
};

export function ContratoForm({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ContratoFormValues | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [operadoras, setOperadoras] = useState<Lookup[]>([]);
  const [canais, setCanais] = useState<Lookup[]>([]);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  const [form, setForm] = useState<ContratoFormValues>(
    initial ?? {
      cliente: "",
      tipo: "PF",
      valor_mensal: 0,
      proporcao_comissao: 3.8,
      status: "Ativo",
    },
  );

  useEffect(() => {
    setForm(
      initial ?? {
        cliente: "",
        tipo: "PF",
        valor_mensal: 0,
        proporcao_comissao: 3.8,
        status: "Ativo",
      },
    );
  }, [initial, open]);

  useEffect(() => {
    (async () => {
      const [o, c, k] = await Promise.all([
        supabase.from("operadoras").select("id,nome").eq("ativo", true).order("nome"),
        supabase.from("canais_venda").select("id,nome").eq("ativo", true).order("nome"),
        supabase.from("categorias_plano").select("id,nome").eq("ativo", true).order("nome"),
      ]);
      setOperadoras((o.data as any) ?? []);
      setCanais((c.data as any) ?? []);
      setCategorias((k.data as any) ?? []);
    })();
  }, [open]);

  const set = <K extends keyof ContratoFormValues>(k: K, v: ContratoFormValues[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const payload = {
      ...form,
      user_id: user.id,
      valor_mensal: Number(form.valor_mensal),
      proporcao_comissao: Number(form.proporcao_comissao),
      operadora_id: form.operadora_id || null,
      canal_id: form.canal_id || null,
      categoria_id: form.categoria_id || null,
      data_vigencia: form.data_vigencia || null,
      numero_proposta: form.numero_proposta || null,
      observacoes: form.observacoes || null,
    };
    const { error } = form.id
      ? await supabase.from("contratos").update(payload).eq("id", form.id)
      : await supabase.from("contratos").insert(payload);
    setBusy(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: form.id ? "Contrato atualizado" : "Contrato criado" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar contrato" : "Novo contrato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Cliente / Nomenclatura</Label>
            <Input required value={form.cliente} onChange={(e) => set("cliente", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nº proposta</Label>
            <Input value={form.numero_proposta ?? ""} onChange={(e) => set("numero_proposta", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PF">PF</SelectItem>
                <SelectItem value="PJ">PJ</SelectItem>
                <SelectItem value="Adesao">Adesão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Operadora</Label>
            <Select value={form.operadora_id ?? ""} onValueChange={(v) => set("operadora_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {operadoras.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Canal de venda</Label>
            <Select value={form.canal_id ?? ""} onValueChange={(v) => set("canal_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {canais.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria do plano</Label>
            <Select value={form.categoria_id ?? ""} onValueChange={(v) => set("categoria_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categorias.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor mensal (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_mensal}
              onChange={(e) => set("valor_mensal", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Proporção comissão (x)</Label>
            <Input type="number" step="0.01" value={form.proporcao_comissao}
              onChange={(e) => set("proporcao_comissao", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de vigência</Label>
            <Input type="date" value={form.data_vigencia ?? ""} onChange={(e) => set("data_vigencia", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}