import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, AlertTriangle, Trash2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/ui/money-input";
import { maskPhone, getAge } from "@/lib/format";

type Lookup = { id: string; nome: string };

export type Dependente = {
  parentesco: string;
  nome: string;
  cpf: string;
  idade?: string;
  data_nascimento?: string | null;
  plano_anterior: string;
};

export type Titular = {
  nome: string;
  cpf: string;
  idade?: string;
  data_nascimento?: string | null;
  telefone: string;
  email: string;
  endereco: string;
  plano_anterior: string;
  dependentes: Dependente[];
};

export type DadosProposta = {
  cnpj_cpf?: string;
  categoria?: string;
  acomodacao?: "Enfermaria" | "Apartamento" | "";
  coparticipacao?: "Total" | "Parcial" | "Não possui" | "";
  vidas?: number;
  qtd_titulares?: number;
  qtd_dependentes?: number;
  data_reajuste?: string | null;
  endereco_empresa?: string;
  titulares?: Titular[];
};

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
  dados_proposta?: DadosProposta | null;
};

const emptyTitular = (): Titular => ({
  nome: "",
  cpf: "",
  data_nascimento: null,
  telefone: "",
  email: "",
  endereco: "",
  plano_anterior: "",
  dependentes: [],
});

const emptyDependente = (): Dependente => ({
  parentesco: "",
  nome: "",
  cpf: "",
  data_nascimento: null,
  plano_anterior: "",
});

const PARENTESCOS = [
  "Cônjuge",
  "Filho(a)",
  "Irmão(ã)",
  "Sobrinho(a)",
  "Neto(a)",
  "Mãe",
  "Pai",
  "Sogro(a)",
  "Genro",
  "Nora",
] as const;

const NENHUM_PLANO = "__nenhum__";

const empty: PipelineFormValues = {
  cliente: "",
  tipo: "PF",
  valor_mensal: 0,
  etapa: "Montagem de contrato",
  dados_proposta: {
    acomodacao: "",
    coparticipacao: "",
    titulares: [],
  },
};

function addOneYear(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y + 1, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

function maskCnpjCpf(value: string, tipo: string) {
  const v = value.replace(/\D/g, "");
  if (tipo === "PJ") {
    return v
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return v
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1-$2");
}

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
  const [form, setForm] = useState<PipelineFormValues>(initial ?? empty);
  const [quickText, setQuickText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [quickOpen, setQuickOpen] = useState(true);

  useEffect(() => {
    setForm(
      initial
        ? {
            ...initial,
            dados_proposta: {
              acomodacao: "",
              coparticipacao: "",
              titulares: [],
              ...(initial.dados_proposta ?? {}),
            },
          }
        : empty,
    );
    setQuickText("");
    setQuickOpen(!initial?.id);
  }, [initial, open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("operadoras")
        .select("id,nome")
        .eq("ativo", true)
        .order("nome");
      setOperadoras((data as any) ?? []);
    })();
  }, [open]);

  // Auto-fill data_reajuste when vigencia is set and reajuste empty
  useEffect(() => {
    if (form.data_vigencia && !form.dados_proposta?.data_reajuste) {
      setDP({ data_reajuste: addOneYear(form.data_vigencia) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.data_vigencia]);

  const set = <K extends keyof PipelineFormValues>(k: K, v: PipelineFormValues[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const setDP = (patch: Partial<DadosProposta>) =>
    setForm((p) => ({ ...p, dados_proposta: { ...(p.dados_proposta ?? {}), ...patch } }));

  const runQuickFill = async () => {
    const texto = quickText.trim();
    if (!texto) {
      toast({ title: "Cole alguma informação primeiro", variant: "destructive" });
      return;
    }
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("pipeline-parse", {
        body: {
          texto,
          operadoras: operadoras.map((o) => ({ id: o.id, nome: o.nome })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const ext = (data as any)?.extracted ?? {};
      const matchedOperadoraId = (data as any)?.operadora_id ?? null;

      let filled = 0;
      setForm((prev) => {
        const next: PipelineFormValues = { ...prev };
        const setIfEmpty = <K extends keyof PipelineFormValues>(k: K, v: any) => {
          if (v == null || v === "") return;
          const cur = next[k];
          if (cur == null || cur === "" || (typeof cur === "number" && cur === 0)) {
            (next as any)[k] = v;
            filled++;
          }
        };
        setIfEmpty("cliente", ext.cliente);
        setIfEmpty("numero_proposta", ext.numero_proposta);
        if (ext.tipo && ["PF", "PJ", "Adesao"].includes(ext.tipo)) {
          if (!prev.id) {
            next.tipo = ext.tipo;
            filled++;
          }
        }
        if (matchedOperadoraId && !next.operadora_id) {
          next.operadora_id = matchedOperadoraId;
          filled++;
        }
        setIfEmpty("valor_mensal", typeof ext.valor_mensal === "number" ? ext.valor_mensal : undefined);
        setIfEmpty("data_vigencia", ext.data_vigencia);
        setIfEmpty("observacoes", ext.observacoes);

        const curDP = next.dados_proposta ?? {};
        const nextDP: DadosProposta = { ...curDP };
        const setDpIfEmpty = (k: keyof DadosProposta, v: any) => {
          if (v == null || v === "") return;
          const cur = (nextDP as any)[k];
          if (cur == null || cur === "" || (typeof cur === "number" && cur === 0)) {
            (nextDP as any)[k] = v;
            filled++;
          }
        };
        setDpIfEmpty("cnpj_cpf", ext.cnpj_cpf);
        setDpIfEmpty("categoria", ext.categoria);
        setDpIfEmpty("acomodacao", ext.acomodacao);
        setDpIfEmpty("coparticipacao", ext.coparticipacao);
        setDpIfEmpty("vidas", ext.vidas);
        setDpIfEmpty("qtd_titulares", ext.qtd_titulares);
        setDpIfEmpty("qtd_dependentes", ext.qtd_dependentes);
        setDpIfEmpty("data_reajuste", ext.data_reajuste);
        setDpIfEmpty("endereco_empresa", ext.endereco_empresa);

        // Titulares: só preenche se ainda vazio
        if (Array.isArray(ext.titulares) && ext.titulares.length > 0 && (!nextDP.titulares || nextDP.titulares.length === 0)) {
          nextDP.titulares = ext.titulares.map((t: any) => ({
            nome: t.nome ?? "",
            cpf: t.cpf ?? "",
            data_nascimento: t.data_nascimento ?? null,
            telefone: t.telefone ?? "",
            email: t.email ?? "",
            endereco: t.endereco ?? "",
            plano_anterior: t.plano_anterior ?? "",
            dependentes: Array.isArray(t.dependentes)
              ? t.dependentes.map((d: any) => ({
                  parentesco: d.parentesco ?? "",
                  nome: d.nome ?? "",
                  cpf: d.cpf ?? "",
                  data_nascimento: d.data_nascimento ?? null,
                  plano_anterior: d.plano_anterior ?? "",
                }))
              : [],
          }));
          if (!nextDP.qtd_titulares) nextDP.qtd_titulares = nextDP.titulares.length;
          filled++;
        }

        next.dados_proposta = nextDP;
        return next;
      });

      toast({
        title: "Preenchimento concluído",
        description: filled > 0 ? `${filled} campo(s) preenchido(s).` : "Nada novo identificado.",
      });
      setQuickOpen(false);
    } catch (e: any) {
      console.error("[pipeline-parse] erro:", e);
      toast({
        title: "Erro ao preencher",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const dp = form.dados_proposta ?? {};
  const titulares = dp.titulares ?? [];

  // Sync titulares array length with qtd_titulares
  useEffect(() => {
    const target = Number(dp.qtd_titulares) || 0;
    if (target === titulares.length) return;
    if (target > titulares.length) {
      const add = Array.from({ length: target - titulares.length }, emptyTitular);
      setDP({ titulares: [...titulares, ...add] });
    } else {
      setDP({ titulares: titulares.slice(0, target) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dp.qtd_titulares]);

  const updateTitular = (idx: number, patch: Partial<Titular>) => {
    const next = titulares.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    setDP({ titulares: next });
  };

  const setDependentesCount = (titIdx: number, count: number) => {
    const t = titulares[titIdx];
    const cur = t.dependentes ?? [];
    let next: Dependente[];
    if (count > cur.length) {
      next = [...cur, ...Array.from({ length: count - cur.length }, emptyDependente)];
    } else {
      next = cur.slice(0, count);
    }
    updateTitular(titIdx, { dependentes: next });
  };

  const updateDependente = (titIdx: number, depIdx: number, patch: Partial<Dependente>) => {
    const t = titulares[titIdx];
    const next = t.dependentes.map((d, i) => (i === depIdx ? { ...d, ...patch } : d));
    updateTitular(titIdx, { dependentes: next });
  };

  // Validation: titulares + dependentes vs vidas
  const totalDeps = useMemo(
    () => titulares.reduce((s, t) => s + (t.dependentes?.length ?? 0), 0),
    [titulares],
  );
  const vidasMismatch =
    Number(dp.vidas) > 0 &&
    Number(dp.qtd_titulares) + Number(dp.qtd_dependentes ?? 0) !== Number(dp.vidas);
  const depsMismatch =
    Number(dp.qtd_dependentes ?? 0) > 0 && totalDeps !== Number(dp.qtd_dependentes);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.cliente?.trim()) {
      toast({ title: "Informe o cliente", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        cliente: form.cliente.trim(),
        tipo: form.tipo,
        etapa: (form.etapa || "Montagem de contrato") as any,
        user_id: user.id,
        valor_mensal: Number(form.valor_mensal) || 0,
        operadora_id: form.operadora_id || null,
        canal_id: form.canal_id || null,
        data_vigencia: form.data_vigencia || null,
        numero_proposta: form.numero_proposta?.trim() || null,
        observacoes: form.observacoes?.trim() || null,
        posicao: Date.now(),
        dados_proposta: form.dados_proposta as any,
      };

      const { error } = form.id
        ? await supabase.from("pipeline_contratos").update(payload).eq("id", form.id)
        : await supabase.from("pipeline_contratos").insert(payload);

      if (error) throw error;

      toast({ title: form.id ? "Proposta atualizada" : "Proposta criada" });
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error("[PipelineForm] save error:", err);
      toast({
        title: "Erro ao salvar",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar proposta" : "Nova proposta"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* PREENCHIMENTO RÁPIDO COM IA */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setQuickOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Preenchimento rápido com IA
              </span>
              {quickOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {quickOpen && (
              <div className="px-3 pb-3 space-y-2">
                <Textarea
                  rows={4}
                  placeholder="Cole aqui qualquer texto solto sobre a proposta (mensagem do cliente, e-mail, anotações). A IA vai identificar cliente, CPF/CNPJ, operadora, valor, vidas, datas, titulares, dependentes etc."
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  className="bg-background"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={runQuickFill}
                    disabled={parsing || !quickText.trim()}
                    size="sm"
                  >
                    {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {parsing ? "Analisando..." : "Preencher automaticamente"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Campos já preenchidos não são sobrescritos.
                </p>
              </div>
            )}
          </div>

          {/* SEÇÃO A — DADOS DO CONTRATO */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Dados do contrato</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <Label>Cliente *</Label>
                <Input required value={form.cliente} onChange={(e) => set("cliente", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Proposta</Label>
                <Input value={form.numero_proposta ?? ""} onChange={(e) => set("numero_proposta", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo contrato</Label>
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
                <Label>{form.tipo === "PJ" ? "CNPJ" : "CPF"}</Label>
                <Input
                  value={dp.cnpj_cpf ?? ""}
                  onChange={(e) => setDP({ cnpj_cpf: maskCnpjCpf(e.target.value, form.tipo) })}
                  placeholder={form.tipo === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                />
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
                <Label>Categoria</Label>
                <Input value={dp.categoria ?? ""} onChange={(e) => setDP({ categoria: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Acomodação *</Label>
                <Select value={dp.acomodacao ?? ""} onValueChange={(v) => setDP({ acomodacao: v as any })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Enfermaria">Enfermaria</SelectItem>
                    <SelectItem value="Apartamento">Apartamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Coparticipação *</Label>
                <Select value={dp.coparticipacao ?? ""} onValueChange={(v) => setDP({ coparticipacao: v as any })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Total">Coparticipação Total</SelectItem>
                    <SelectItem value="Parcial">Coparticipação Parcial</SelectItem>
                    <SelectItem value="Não possui">Não possui</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Vidas</Label>
                <Input
                  type="number"
                  min={0}
                  value={dp.vidas ?? ""}
                  onChange={(e) => setDP({ vidas: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Titulares</Label>
                <Input
                  type="number"
                  min={0}
                  value={dp.qtd_titulares ?? ""}
                  onChange={(e) => setDP({ qtd_titulares: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Dependentes</Label>
                <Input
                  type="number"
                  min={0}
                  value={dp.qtd_dependentes ?? ""}
                  onChange={(e) => setDP({ qtd_dependentes: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Valor total</Label>
                <MoneyInput value={form.valor_mensal} onChange={(n) => set("valor_mensal", n)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de vigência</Label>
                <DatePicker value={form.data_vigencia ?? null} onChange={(iso) => set("data_vigencia", iso)} />
              </div>
              <div className="space-y-1.5">
                <Label>Mês implantação/reajuste</Label>
                <DatePicker value={dp.data_reajuste ?? null} onChange={(iso) => setDP({ data_reajuste: iso })} />
              </div>

              <div className="space-y-1.5 col-span-2 md:col-span-3">
                <Label>Endereço da empresa</Label>
                <Textarea
                  rows={2}
                  value={dp.endereco_empresa ?? ""}
                  onChange={(e) => setDP({ endereco_empresa: e.target.value })}
                />
              </div>
            </div>

            {(vidasMismatch || depsMismatch) && (
              <div className="mt-2 flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded p-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  {vidasMismatch && (
                    <div>Titulares + Dependentes ({Number(dp.qtd_titulares ?? 0) + Number(dp.qtd_dependentes ?? 0)}) ≠ Vidas ({dp.vidas}).</div>
                  )}
                  {depsMismatch && (
                    <div>Soma dos dependentes preenchidos ({totalDeps}) ≠ Dependentes informado ({dp.qtd_dependentes}).</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO B — TITULARES */}
          {titulares.length > 0 && (
            <div>
              <Separator className="my-2" />
              <h3 className="font-semibold text-sm mb-2">Titulares</h3>
              <div className="space-y-3">
                {titulares.map((t, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Titular {idx + 1}</Badge>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Dependentes deste titular:</Label>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-20"
                            value={t.dependentes.length}
                            onChange={(e) => setDependentesCount(idx, Math.max(0, Number(e.target.value)))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div className="space-y-1 col-span-2 md:col-span-1">
                          <Label className="text-xs">Nome</Label>
                          <Input value={t.nome} onChange={(e) => updateTitular(idx, { nome: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">CPF</Label>
                          <Input value={t.cpf} onChange={(e) => updateTitular(idx, { cpf: maskCnpjCpf(e.target.value, "PF") })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Data de nascimento
                            {t.data_nascimento && getAge(t.data_nascimento) != null && (
                              <span className="ml-1 text-muted-foreground">· {getAge(t.data_nascimento)} anos</span>
                            )}
                          </Label>
                          <DatePicker
                            value={t.data_nascimento ?? null}
                            onChange={(iso) => updateTitular(idx, { data_nascimento: iso })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Telefone</Label>
                          <Input
                            inputMode="tel"
                            placeholder="(11) 91234-5678"
                            value={t.telefone}
                            onChange={(e) => updateTitular(idx, { telefone: maskPhone(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">E-mail</Label>
                          <Input type="email" value={t.email} onChange={(e) => updateTitular(idx, { email: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Plano anterior</Label>
                          <Select
                            value={t.plano_anterior || NENHUM_PLANO}
                            onValueChange={(v) =>
                              updateTitular(idx, { plano_anterior: v === NENHUM_PLANO ? "" : v })
                            }
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NENHUM_PLANO}>Nenhum / Não possui</SelectItem>
                              {operadoras.map((o) => (
                                <SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 col-span-2 md:col-span-3">
                          <Label className="text-xs">Endereço</Label>
                          <Textarea rows={1} value={t.endereco} onChange={(e) => updateTitular(idx, { endereco: e.target.value })} />
                        </div>
                      </div>

                      {/* Dependentes deste titular */}
                      {t.dependentes.length > 0 && (
                        <div className="border-l-2 border-primary/40 pl-3 space-y-2">
                          {t.dependentes.map((d, dIdx) => (
                            <div key={dIdx} className="border rounded-md p-2">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="secondary" className="text-xs">Dependente {dIdx + 1}</Badge>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => setDependentesCount(idx, t.dependentes.length - 1)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Parentesco</Label>
                                  <Select
                                    value={d.parentesco || ""}
                                    onValueChange={(v) => updateDependente(idx, dIdx, { parentesco: v })}
                                  >
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                      {PARENTESCOS.map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Nome</Label>
                                  <Input value={d.nome} onChange={(e) => updateDependente(idx, dIdx, { nome: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">CPF</Label>
                                  <Input value={d.cpf} onChange={(e) => updateDependente(idx, dIdx, { cpf: maskCnpjCpf(e.target.value, "PF") })} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    Nascimento
                                    {d.data_nascimento && getAge(d.data_nascimento) != null && (
                                      <span className="ml-1 text-muted-foreground">· {getAge(d.data_nascimento)}a</span>
                                    )}
                                  </Label>
                                  <DatePicker
                                    value={d.data_nascimento ?? null}
                                    onChange={(iso) => updateDependente(idx, dIdx, { data_nascimento: iso })}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Plano anterior</Label>
                                  <Select
                                    value={d.plano_anterior || NENHUM_PLANO}
                                    onValueChange={(v) =>
                                      updateDependente(idx, dIdx, { plano_anterior: v === NENHUM_PLANO ? "" : v })
                                    }
                                  >
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={NENHUM_PLANO}>Nenhum</SelectItem>
                                      {operadoras.map((o) => (
                                        <SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
          </div>

          <DialogFooter>
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