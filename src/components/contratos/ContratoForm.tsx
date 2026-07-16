import { useEffect, useMemo, useRef, useState } from "react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/ui/money-input";
import { ContratoAnexos } from "./ContratoAnexos";
import { DadosPropostaEditor } from "@/components/shared/DadosPropostaEditor";
import type { DadosProposta } from "@/components/pipeline/PipelineForm";
import { addYearsIso, localIso } from "@/lib/format";
import type { Json } from "@/integrations/supabase/types";

type Lookup = { id: string; nome: string };

export type ComissaoLine = {
  id?: string;
  tipo: "Bancaria" | "Vida" | "Adesao";
  parcela: number;
  valor: number;
  mes_previsto: string;
  data_pagamento?: string | null;
  // UI-only field: percent of valor_mensal that defines `valor`. Optional.
  percentual?: number | null;
};

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
  data_reajuste?: string | null;
  status: "Ativo" | "Cancelado" | "Pendente";
  observacoes?: string | null;
  dados_proposta?: DadosProposta | null;
};

const empty: ContratoFormValues = {
  cliente: "",
  tipo: "PF",
  valor_mensal: 0,
  proporcao_comissao: 0,
  status: "Ativo",
};

const today = () => localIso();

const defaultComissoes = (): ComissaoLine[] => {
  const t = today();
  return [1, 2, 3].map((p) => ({
    tipo: "Bancaria",
    parcela: p,
    valor: 0,
    percentual: null,
    mes_previsto: t,
    data_pagamento: null,
  }));
};

export function ContratoForm({
  open,
  onOpenChange,
  initial,
  onSaved,
  pipelineId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ContratoFormValues | null;
  onSaved: (contratoId?: string) => void;
  pipelineId?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [operadoras, setOperadoras] = useState<Lookup[]>([]);
  const [canais, setCanais] = useState<Lookup[]>([]);
  const [form, setForm] = useState<ContratoFormValues>(initial ?? empty);
  const [comissoes, setComissoes] = useState<ComissaoLine[]>([]);
  const [removedComissoes, setRemovedComissoes] = useState<string[]>([]);
  const [comissoesLoading, setComissoesLoading] = useState(false);
  const [comissoesLoadError, setComissoesLoadError] = useState(false);
  const loadRequestRef = useRef(0);

  // Reset only when the dialog transitions from closed to open, to avoid
  // clobbering user edits on unrelated re-renders.
  useEffect(() => {
    if (!open) return;
    setForm(initial ?? empty);
    setRemovedComissoes([]);
    setComissoes(initial?.id ? [] : defaultComissoes());
    setComissoesLoading(!!initial?.id);
    setComissoesLoadError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  // Load lookups + existing comissões. O requestId impede que uma resposta
  // atrasada de outro contrato sobrescreva o formulário atual.
  useEffect(() => {
    if (!open) {
      loadRequestRef.current++;
      return;
    }
    const requestId = ++loadRequestRef.current;
    setLookupsLoaded(false);
    setComissoesLoading(!!initial?.id);
    (async () => {
      try {
        const [o, c, k] = await Promise.all([
          supabase.from("operadoras").select("id,nome,ativo").order("nome"),
          supabase.from("canais_venda").select("id,nome,ativo").order("nome"),
          initial?.id
            ? supabase
                .from("comissoes")
                .select("id, tipo, parcela, valor, mes_previsto, data_pagamento")
                .eq("contrato_id", initial.id)
                .order("parcela")
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (requestId !== loadRequestRef.current) return;
        if (o.error) throw o.error;
        if (c.error) throw c.error;
        if (k.error) throw k.error;

        setOperadoras((o.data ?? []) as Lookup[]);
        setCanais((c.data ?? []) as Lookup[]);
        setLookupsLoaded(true);
        if (initial?.id) setComissoes((k.data ?? []) as ComissaoLine[]);
        setComissoesLoadError(false);
      } catch (error) {
        if (requestId !== loadRequestRef.current) return;
        const message = error instanceof Error ? error.message : "Falha ao carregar o contrato";
        setComissoesLoadError(true);
        toast({ title: "Erro ao carregar contrato", description: message, variant: "destructive" });
      } finally {
        if (requestId === loadRequestRef.current) setComissoesLoading(false);
      }
    })();
  }, [open, initial?.id, toast]);

  // Auto-fill data_reajuste when vigencia changes (and reajuste vazio ou era +1 ano da vigência anterior)
  useEffect(() => {
    if (!form.data_vigencia) return;
    const vigencia = form.data_vigencia;
    setForm((current) => current.data_reajuste
      ? current
      : { ...current, data_reajuste: addYearsIso(vigencia, 1) });
  }, [form.data_vigencia]);

  // Recalculate `valor` for lines that have a percentual whenever valor_mensal changes
  useEffect(() => {
    const mensal = Number(form.valor_mensal) || 0;
    setComissoes((prev) =>
      prev.map((c) =>
        c.percentual != null && !Number.isNaN(c.percentual)
          ? { ...c, valor: Number(((mensal * c.percentual) / 100).toFixed(2)) }
          : c,
      ),
    );
  }, [form.valor_mensal]);

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
      { tipo: "Bancaria", parcela: nextParcela, valor: 0, percentual: null, mes_previsto: today(), data_pagamento: null },
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
    if (comissoesLoading || comissoesLoadError) {
      toast({
        title: "Comissões ainda não estão disponíveis",
        description: "Feche e abra o contrato novamente antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    if (Number(form.valor_mensal) < 0 || comissoes.some((c) => Number(c.valor) < 0 || Number(c.parcela) < 1)) {
      toast({ title: "Valores inválidos", description: "Valores não podem ser negativos e a parcela começa em 1.", variant: "destructive" });
      return;
    }
    const keys = comissoes.map((c) => `${c.tipo}:${Number(c.parcela) || 1}`);
    if (new Set(keys).size !== keys.length) {
      toast({ title: "Parcelas duplicadas", description: "Use apenas uma parcela de cada número para o mesmo tipo.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        cliente: form.cliente,
        tipo: form.tipo,
        status: form.status,
        valor_mensal: Number(form.valor_mensal),
        proporcao_comissao: Number(proporcao.toFixed(4)),
        operadora_id: form.operadora_id || null,
        canal_id: form.canal_id || null,
        categoria_id: form.categoria_id || null,
        data_vigencia: form.data_vigencia || null,
        data_reajuste: form.data_reajuste || null,
        numero_proposta: form.numero_proposta || null,
        observacoes: form.observacoes || null,
        dados_proposta: form.dados_proposta ?? null,
      };
      const commissionPayload = comissoes.map((c) => ({
        ...(c.id ? { id: c.id } : {}),
        tipo: c.tipo,
        parcela: Number(c.parcela) || 1,
        valor: Number(c.valor) || 0,
        mes_previsto: c.mes_previsto || localIso(),
        data_pagamento: c.data_pagamento || null,
      }));

      let contratoId: string | null = null;
      const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
      if (pipelineId) {
        const { data, error } = await rpc("implantar_pipeline_com_contrato", {
          p_pipeline_id: pipelineId,
          p_contrato: payload as Json,
          p_comissoes: commissionPayload as Json,
          p_remover_comissoes: removedComissoes,
        });
        if (error) throw error;
        contratoId = data;
      } else {
        const { data, error } = await rpc("save_contrato_com_comissoes", {
          p_contrato: payload as Json,
          p_comissoes: commissionPayload as Json,
          p_remover_comissoes: removedComissoes,
        });
        if (error) throw error;
        contratoId = data;
      }
      if (!contratoId) throw new Error("O banco não retornou o contrato salvo.");

      toast({ title: form.id ? "Contrato atualizado" : "Contrato criado" });
      onOpenChange(false);
      onSaved(contratoId);
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
            <Select
              value={form.operadora_id ?? ""}
              onValueChange={(v) => set("operadora_id", v)}
              disabled={!lookupsLoaded}
            >
              <SelectTrigger>
                <SelectValue placeholder={lookupsLoaded ? "Selecione" : "Carregando..."} />
              </SelectTrigger>
              <SelectContent>
                {operadoras.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Canal de venda</Label>
            <Select
              value={form.canal_id ?? ""}
              onValueChange={(v) => set("canal_id", v)}
              disabled={!lookupsLoaded}
            >
              <SelectTrigger>
                <SelectValue placeholder={lookupsLoaded ? "Selecione" : "Carregando..."} />
              </SelectTrigger>
              <SelectContent>
                {canais.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor mensal</Label>
            <MoneyInput value={form.valor_mensal} onChange={(n) => set("valor_mensal", n)} />
          </div>
          <div className="space-y-1.5">
            <Label>Proporção comissão (auto)</Label>
            <Input readOnly value={`${proporcao.toFixed(2)}x`} className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label>Data de vigência</Label>
            <DatePicker value={form.data_vigencia ?? null} onChange={(iso) => set("data_vigencia", iso)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mês de reajuste</Label>
            <DatePicker value={form.data_reajuste ?? null} onChange={(iso) => set("data_reajuste", iso)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
          </div>

          {form.id && (
            <div className="col-span-2 space-y-2">
              <Separator />
              <div>
                <h3 className="font-semibold text-sm mb-2">Dados da proposta</h3>
                <DadosPropostaEditor
                  value={form.dados_proposta ?? { acomodacao: "", coparticipacao: "", titulares: [] }}
                  onChange={(v) => set("dados_proposta", v)}
                  operadoras={operadoras}
                  tipo={form.tipo}
                />
              </div>
              <Separator />
              <ContratoAnexos contratoId={form.id} />
            </div>
          )}

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

            {comissoesLoading ? (
              <div className="text-center text-sm text-muted-foreground border border-dashed rounded-md py-6">
                Carregando comissões…
              </div>
            ) : comissoes.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground border border-dashed rounded-md py-6">
                Nenhuma comissão cadastrada.
              </div>
            ) : (
              <div className="space-y-2">
                {comissoes.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-14 gap-2 items-end border rounded-md p-2" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
                    <div className="col-span-3 space-y-1" style={{ gridColumn: "span 3 / span 3" }}>
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
                    <div className="space-y-1" style={{ gridColumn: "span 1 / span 1" }}>
                      <Label className="text-xs">Parc.</Label>
                      <Input
                        className="h-9"
                        inputMode="numeric"
                        value={String(c.parcela ?? "")}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, "");
                          updateComissao(idx, { parcela: raw === "" ? 0 : Number(raw) });
                        }}
                      />
                    </div>
                    <div className="space-y-1" style={{ gridColumn: "span 2 / span 2" }}>
                      <Label className="text-xs">% s/ mensal</Label>
                      <Input
                        className="h-9"
                        type="number"
                        step="0.01"
                        placeholder="ex: 100"
                        value={c.percentual ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const pct = raw === "" ? null : Number(raw);
                          const mensal = Number(form.valor_mensal) || 0;
                          updateComissao(idx, {
                            percentual: pct,
                            valor: pct !== null && !Number.isNaN(pct) ? Number(((mensal * pct) / 100).toFixed(2)) : c.valor,
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-1" style={{ gridColumn: "span 2 / span 2" }}>
                      <Label className="text-xs">Valor</Label>
                      <MoneyInput
                        value={c.valor}
                        onChange={(n) => updateComissao(idx, { valor: n, percentual: null })}
                      />
                    </div>
                    <div className="space-y-1" style={{ gridColumn: "span 3 / span 3" }}>
                      <Label className="text-xs">Previsto p/</Label>
                      <DatePicker
                        value={c.mes_previsto || null}
                        onChange={(iso) => updateComissao(idx, { mes_previsto: iso ?? "" })}
                      />
                    </div>
                    <div className="space-y-1" style={{ gridColumn: "span 2 / span 2" }}>
                      <Label className="text-xs">Recebido em</Label>
                      <DatePicker
                        value={c.data_pagamento ?? null}
                        onChange={(iso) => updateComissao(idx, { data_pagamento: iso })}
                      />
                    </div>
                    <div className="flex justify-end" style={{ gridColumn: "span 1 / span 1" }}>
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
            <Button type="submit" disabled={busy || comissoesLoading || comissoesLoadError || !lookupsLoaded}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
