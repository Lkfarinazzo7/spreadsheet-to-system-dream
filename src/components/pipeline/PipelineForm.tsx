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

export type PipelineFormValues = {
  id?: string;
  cliente: string;
  numero_proposta?: string | null;
  tipo: "PJ" | "PF" | "Adesao";
  operadora_id?: string | null;
  canal_id?: string | null;
  valor_mensal: number;
  data_vigencia?: string | null;
  etapa: string;
  observacoes?: string | null;
};

const empty: PipelineFormValues = {
  cliente: "",
  tipo: "PF",
  valor_mensal: 0,
  etapa: "Montagem de contrato",
};

export function PipelineForm({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: PipelineFormValues | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [operadoras, setOperadoras] = useState<Lookup[]>([]);
  const [canais, setCanais] = useState<Lookup[]>([]);
  const [form, setForm] = useState<PipelineFormValues>(initial ?? empty);

  useEffect(() => { setForm(initial ?? empty); }, [initial, open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [o, c] = await Promise.all([
        supabase.from("operadoras").select("id,nome").eq("ativo", true).order("nome"),
        supabase.from("canais_venda").select("id,nome").eq("ativo", true).order("nome"),
      ]);
      setOperadoras((o.data as any) ?? []);
      setCanais((c.data as any) ?? []);
    })();
  }, [open]);

  const set = <K extends keyof PipelineFormValues>(k: K, v: PipelineFormValues[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const payload = {
      cliente: form.cliente,
      tipo: form.tipo,
      etapa: form.etapa as any,
      user_id: user.id,
      valor_mensal: Number(form.valor_mensal),
      operadora_id: form.operadora_id || null,
      canal_id: form.canal_id || null,
      data_vigencia: form.data_vigencia || null,
      numero_proposta: form.numero_proposta || null,
      observacoes: form.observacoes || null,
    };
    const { error } = form.id
      ? await supabase.from("pipeline_contratos").update(payload).eq("id", form.id)
      : await supabase.from("pipeline_contratos").insert(payload);
    setBusy(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: form.id ? "Proposta atualizada" : "Proposta criada" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar proposta" : "Nova proposta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Cliente</Label>
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
            <Label>Canal</Label>
            <Select value={form.canal_id ?? ""} onValueChange={(v) => set("canal_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {canais.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor mensal estimado (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_mensal}
              onChange={(e) => set("valor_mensal", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Data prevista de vigência</Label>
            <Input type="date" value={form.data_vigencia ?? ""} onChange={(e) => set("data_vigencia", e.target.value)} />
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