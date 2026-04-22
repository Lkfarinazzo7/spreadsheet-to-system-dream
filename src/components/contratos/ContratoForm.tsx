import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type Lookup = { id: string; nome: string };

export type ComissaoLine = {
  id?: string;
  tipo: "Bancaria" | "Vida" | "Adesao";
  parcela: number;
  valor: number;
  mes_previsto: string;
  data_pagamento?: string | null;
};

export type ContratoFormValues = {
  id?: string;
  numero_proposta?: string | null;
  cliente: string;
  tipo: "PJ" | "PF" | "Adesao";
  operadora_id?: string | null;
  canal_id?: string | null;
  valor_mensal: number;
  proporcao_comissao: number;
  data_vigencia?: string | null;
  data_reajuste?: string | null;
  status: "Ativo" | "Cancelado" | "Pendente";
  observacoes?: string | null;
};

const empty: ContratoFormValues = {
  cliente: "",
  tipo: "PF",
  valor_mensal: 0,
  proporcao_comissao: 0,
  status: "Ativo",
};

function addOneYear(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y + 1, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

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
  const [form, setForm] = useState<ContratoFormValues>(initial ?? empty);
  const [comissoes, setComissoes] = useState<ComissaoLine[]>([]);
  const [removedComissoes, setRemovedComissoes] = useState<string[]>([]);

  // Reset on open
  useEffect(() => {
    setForm(initial ?? empty);
    setRemovedComissoes([]);
    if (!initial?.id) {
      setComissoes([]);
    }
  }, [initial, open]);

  // Load lookups + existing comissões
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [o, c] = await Promise.all([
        supabase.from("operadoras").select("id,nome").eq("ativo", true).order("nome"),
        supabase.from("canais_venda").select("id,nome").eq("ativo", true).order("nome"),
      ]);
      setOperadoras((o.data as any) ?? []);
      setCanais((c.data as any) ?? []);

      if (initial?.id) {
        const { data } = await supabase
          .from("comissoes")
          .select("id, tipo, parcela, valor, mes_previsto, data_pagamento")
          .eq("contrato_id", initial.id)
          .order("parcela");
        setComissoes(((data as any) ?? []) as ComissaoLine[]);
      }
    })();
  }, [open, initial?.id]);

  // Auto-fill data_reajuste when vigencia changes (and reajuste vazio ou era +1 ano da vigência anterior)
  useEffect(() => {
    if (form.data_vigencia && !form.data_reajuste) {
      setForm((p) => ({ ...p, data_reajuste: addOneYear(form.data_vigencia!) }));
    }
  }, [form.data_vigencia]);

  // Proporção calculada
  const proporcao = useMemo(() => {
    const total = comissoes.reduce((s, c) => s + (Number(c.valor) || 0), 0);
    const mensal = Number(form.valor_mensal) || 0;
    return mensal > 0 ? total / mensal : 0;
  }, [comissoes, form.valor_mensal]);

  const set = <K extends keyof ContratoFormValues>(k: K, v: ContratoFormValues[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const addComissao = () => {
    const nextParcela = (comissoes[comissoes.length - 1]?.parcela ?? 0) + 1;
    setComissoes((p) => [
      ...p,
      { tipo: "Bancaria", parcela: nextParcela, valor: 0, mes_previsto: "", data_pagamento: null },
    ]);
  };

  const updateComissao = (idx: number, patch: Partial<ComissaoLine>) => {
    setComissoes((p) => p.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeComissao = (idx: number) => {
    setComissoes((p) => {
      const item = p[idx];
      if (item.id) setRemovedComissoes((r) => [...r, item.id!]);
      return p.filter((_, i) => i !== idx);
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const payload = {
        cliente: form.cliente,
        tipo: form.tipo,
        status: form.status,
        user_id: user.id,
        valor_mensal: Number(form.valor_mensal),
        proporcao_comissao: Number(proporcao.toFixed(4)),
        operadora_id: form.operadora_id || null,
        canal_id: form.canal_id || null,
        data_vigencia: form.data_vigencia || null,
        data_reajuste: form.data_reajuste || null,
        numero_proposta: form.numero_proposta || null,
        observacoes: form.observacoes || null,
      };

      let contratoId = form.id;
      if (contratoId) {
        const { error } = await supabase.from("contratos").update(payload).eq("id", contratoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("contratos").insert(payload).select("id").single();
        if (error) throw error;
        contratoId = data!.id;
      }

      // Sync comissões
      if (removedComissoes.length > 0) {
        await supabase.from("comissoes").delete().in("id", removedComissoes);
      }
      for (const c of comissoes) {
        const cPayload = {
          contrato_id: contratoId!,
          user_id: user.id,
          tipo: c.tipo,
          parcela: Number(c.parcela) || 1,
          valor: Number(c.valor) || 0,
          mes_previsto: c.mes_previsto || new Date().toISOString().slice(0, 10),
          data_pagamento: c.data_pagamento || null,
          pago: !!c.data_pagamento,
        };
        if (c.id) {
          await supabase.from("comissoes").update(cPayload).eq("id", c.id);
        } else {
          await supabase.from("comissoes").insert(cPayload);
        }
      }

      toast({ title: form.id ? "Contrato atualizado" : "Contrato criado" });
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
            <Label>Valor mensal (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_mensal}
              onChange={(e) => set("valor_mensal", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Proporção comissão (auto)</Label>
            <Input readOnly value={`${proporcao.toFixed(2)}x`} className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label>Data de vigência</Label>
            <Input type="date" value={form.data_vigencia ?? ""} onChange={(e) => set("data_vigencia", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mês de reajuste</Label>
            <Input type="date" value={form.data_reajuste ?? ""} onChange={(e) => set("data_reajuste", e.target.value)} />
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

          <div className="col-span-2">
            <Separator className="my-2" />
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-sm">Comissões deste contrato</h3>
                <p className="text-xs text-muted-foreground">Adicione cada parcela. Preencha "Recebido em" para marcar como paga.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addComissao}>
                <Plus className="h-4 w-4" /> Adicionar comissão
              </Button>
            </div>

            {comissoes.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground border border-dashed rounded-md py-6">
                Nenhuma comissão cadastrada.
              </div>
            ) : (
              <div className="space-y-2">
                {comissoes.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={c.tipo} onValueChange={(v) => updateComissao(idx, { tipo: v as any })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bancaria">Bancária</SelectItem>
                          <SelectItem value="Vida">Bonificação por Vida</SelectItem>
                          <SelectItem value="Adesao">Adesão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">Parc.</Label>
                      <Input className="h-9" type="number" min={1} value={c.parcela}
                        onChange={(e) => updateComissao(idx, { parcela: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input className="h-9" type="number" step="0.01" value={c.valor}
                        onChange={(e) => updateComissao(idx, { valor: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Previsto p/</Label>
                      <Input className="h-9" type="date" value={c.mes_previsto}
                        onChange={(e) => updateComissao(idx, { mes_previsto: e.target.value })} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Recebido em</Label>
                      <Input className="h-9" type="date" value={c.data_pagamento ?? ""}
                        onChange={(e) => updateComissao(idx, { data_pagamento: e.target.value || null })} />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeComissao(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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