import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency, localIso } from "@/lib/format";
import { FileSpreadsheet, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { fetchAllPages } from "@/lib/supabasePaging";
import { downloadSpreadsheet } from "@/lib/spreadsheet";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";
import type { DadosProposta } from "@/components/pipeline/PipelineForm";

type ReportComissao = {
  pago: boolean;
  data_pagamento: string | null;
  mes_previsto: string;
  valor: number;
  contrato?: {
    cliente: string;
    operadora?: { nome: string } | null;
    canal?: { nome: string } | null;
  } | null;
};

type ReportDespesa = {
  pago: boolean;
  data_pagamento: string | null;
  data: string;
  valor: number;
};

type ReportContrato = {
  id: string;
  valor_mensal: number;
  data_vigencia: string | null;
  dados_proposta: DadosProposta | null;
};

type Comissao2 = { contrato_id: string; valor: number; pago: boolean; data_pagamento: string | null };

const FAIXAS: { label: string; test: (a: number) => boolean }[] = [
  { label: "0-18", test: (a) => a <= 18 },
  { label: "19-23", test: (a) => a >= 19 && a <= 23 },
  { label: "24-28", test: (a) => a >= 24 && a <= 28 },
  { label: "29-33", test: (a) => a >= 29 && a <= 33 },
  { label: "34-38", test: (a) => a >= 34 && a <= 38 },
  { label: "39-43", test: (a) => a >= 39 && a <= 43 },
  { label: "44-48", test: (a) => a >= 44 && a <= 48 },
  { label: "49-53", test: (a) => a >= 49 && a <= 53 },
  { label: "54-58", test: (a) => a >= 54 && a <= 58 },
  { label: "59+", test: (a) => a >= 59 },
];

function computeAge(iso: string | null | undefined, ref = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  let age = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age -= 1;
  return age;
}

function bucketFaixa(age: number): string {
  return (FAIXAS.find((f) => f.test(age)) ?? FAIXAS[FAIXAS.length - 1]).label;
}

export default function Relatorios() {
  const { toast } = useToast();
  const today = new Date();
  const [from, setFrom] = useState(localIso(new Date(today.getFullYear(), today.getMonth() - 5, 1)));
  const [to, setTo] = useState(localIso(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  const [comissoes, setComissoes] = useState<ReportComissao[]>([]);
  const [despesas, setDespesas] = useState<ReportDespesa[]>([]);
  const [contratos, setContratos] = useState<ReportContrato[]>([]);
  const [comissoesAll, setComissoesAll] = useState<Comissao2[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Relatórios — Corretor SaaS";
  }, []);

  useEffect(() => {
    (async () => {
      if (from > to) {
        setComissoes([]);
        setDespesas([]);
        setContratos([]);
        setComissoesAll([]);
        setLoading(false);
        toast({ title: "Período inválido", description: "A data inicial deve ser anterior à final.", variant: "destructive" });
        return;
      }
      setLoading(true);
      // Busca linhas que pertencem ao período por competência (mes_previsto / data)
      // OU por caixa (data_pagamento), para alimentar as duas visões sem re-consultar.
      try {
        const [c, d, ct, ca] = await Promise.all([
          fetchAllPages<ReportComissao>((start, end) => supabase.from("comissoes")
            .select("pago,data_pagamento,mes_previsto,valor,contrato:contratos(cliente, operadora:operadoras(nome), canal:canais_venda(nome))")
            .or(`and(mes_previsto.gte.${from},mes_previsto.lte.${to}),and(data_pagamento.gte.${from},data_pagamento.lte.${to})`)
            .range(start, end)),
          fetchAllPages<ReportDespesa>((start, end) => supabase.from("despesas")
            .select("pago,data_pagamento,data,valor")
            .or(`and(data.gte.${from},data.lte.${to}),and(data_pagamento.gte.${from},data_pagamento.lte.${to})`)
            .range(start, end)),
          fetchAllPages<ReportContrato>((start, end) => supabase.from("contratos")
            .select("id,valor_mensal,data_vigencia,dados_proposta")
            .gte("data_vigencia", from).lte("data_vigencia", to)
            .range(start, end) as any),
          fetchAllPages<Comissao2>((start, end) => supabase.from("comissoes")
            .select("contrato_id,valor,pago,data_pagamento")
            .range(start, end)),
        ]);
        setComissoes(c);
        setDespesas(d);
        setContratos(ct);
        setComissoesAll(ca);
      } catch (error) {
        setComissoes([]);
        setDespesas([]);
        setContratos([]);
        setComissoesAll([]);
        toast({ title: "Erro ao carregar relatórios", description: error instanceof Error ? error.message : "Falha na consulta.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to, toast]);

  const inRange = (v: string | null | undefined) => !!v && v >= from && v <= to;

  // Duas visões, nunca misturadas:
  //  * REALIZADO (caixa): comissão paga pela data_pagamento; despesa paga pela data_pagamento.
  //  * PREVISTO (competência): comissão pelo mes_previsto; despesa pela data prevista.
  const totals = useMemo(() => {
    const recebido = comissoes
      .filter((c) => c.pago && inRange(c.data_pagamento))
      .reduce((s, c) => s + Number(c.valor), 0);
    const despPaga = despesas
      .filter((d) => d.pago && inRange(d.data_pagamento))
      .reduce((s, d) => s + Number(d.valor), 0);

    const previsto = comissoes
      .filter((c) => inRange(c.mes_previsto))
      .reduce((s, c) => s + Number(c.valor), 0);
    const despPrevista = despesas
      .filter((d) => inRange(d.data))
      .reduce((s, d) => s + Number(d.valor), 0);

    return {
      recebido,
      despPaga,
      lucro: recebido - despPaga, // caixa: só o que entrou menos o que saiu
      previsto,
      despPrevista,
      resultadoPrevisto: previsto - despPrevista,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comissoes, despesas, from, to]);

  const porOperadora = useMemo(() => {
    const m = new Map<string, number>();
    comissoes.forEach((c) => {
      if (!c.pago || !inRange(c.data_pagamento)) return;
      const nome = c.contrato?.operadora?.nome ?? "Sem operadora";
      m.set(nome, (m.get(nome) ?? 0) + Number(c.valor));
    });
    return Array.from(m, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comissoes, from, to]);

  const porCanal = useMemo(() => {
    const m = new Map<string, number>();
    comissoes.forEach((c) => {
      if (!c.pago || !inRange(c.data_pagamento)) return;
      const nome = c.contrato?.canal?.nome ?? "Sem canal";
      m.set(nome, (m.get(nome) ?? 0) + Number(c.valor));
    });
    return Array.from(m, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comissoes, from, to]);

  // Tickets médios
  const tickets = useMemo(() => {
    const ticketContrato = contratos.length
      ? contratos.reduce((s, c) => s + Number(c.valor_mensal || 0), 0) / contratos.length
      : 0;
    // Ticket médio de comissão recebida: soma das comissões pagas no período / nº contratos distintos que receberam no período
    const contratosComRecebimento = new Set<string>();
    let totalRecebido = 0;
    comissoesAll.forEach((c) => {
      if (!c.pago) return;
      if (!inRange(c.data_pagamento)) return;
      totalRecebido += Number(c.valor || 0);
      if (c.contrato_id) contratosComRecebimento.add(c.contrato_id);
    });
    const ticketComissao = contratosComRecebimento.size
      ? totalRecebido / contratosComRecebimento.size
      : 0;
    return { ticketContrato, ticketComissao };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratos, comissoesAll, from, to]);

  // Faixa etária e parentesco a partir de dados_proposta dos contratos do período
  const { faixaTitulares, faixaDependentes, porParentesco } = useMemo(() => {
    const initBuckets = () => Object.fromEntries(FAIXAS.map((f) => [f.label, 0])) as Record<string, number>;
    const bt = initBuckets();
    const bd = initBuckets();
    const parent = new Map<string, number>();
    contratos.forEach((c) => {
      const dp = c.dados_proposta;
      if (!dp?.titulares) return;
      dp.titulares.forEach((t) => {
        const at = computeAge(t.data_nascimento);
        if (at != null && at >= 0) bt[bucketFaixa(at)] += 1;
        (t.dependentes ?? []).forEach((d) => {
          const ad = computeAge(d.data_nascimento);
          if (ad != null && ad >= 0) bd[bucketFaixa(ad)] += 1;
          const p = (d.parentesco || "Não informado").trim() || "Não informado";
          parent.set(p, (parent.get(p) ?? 0) + 1);
        });
      });
    });
    return {
      faixaTitulares: FAIXAS.map((f) => ({ nome: f.label, qtd: bt[f.label] })),
      faixaDependentes: FAIXAS.map((f) => ({ nome: f.label, qtd: bd[f.label] })),
      porParentesco: Array.from(parent, ([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd),
    };
  }, [contratos]);

  const exportXlsx = async () => {
    const resumo = [
      { Indicador: "REALIZADO (caixa) — Comissão recebida", Valor: totals.recebido },
      { Indicador: "REALIZADO (caixa) — Despesas pagas", Valor: totals.despPaga },
      { Indicador: "REALIZADO (caixa) — Lucro", Valor: totals.lucro },
      { Indicador: "COMPETÊNCIA — Comissão total", Valor: totals.previsto },
      { Indicador: "COMPETÊNCIA — Despesas totais", Valor: totals.despPrevista },
      { Indicador: "COMPETÊNCIA — Resultado", Valor: totals.resultadoPrevisto },
      { Indicador: "Ticket médio por contrato", Valor: tickets.ticketContrato },
      { Indicador: "Ticket médio de comissão recebida", Valor: tickets.ticketComissao },
    ];
    try {
      await downloadSpreadsheet([
        { name: "Resumo", rows: resumo },
        { name: "Por operadora", rows: porOperadora },
        { name: "Por canal", rows: porCanal },
        { name: "Faixa etária titulares", rows: faixaTitulares },
        { name: "Faixa etária dependentes", rows: faixaDependentes },
        { name: "Parentesco dependentes", rows: porParentesco },
      ], `relatorio_${from}_${to}.xlsx`);
    } catch (error) {
      toast({ title: "Erro ao exportar", description: error instanceof Error ? error.message : "Falha ao gerar Excel.", variant: "destructive" });
    }
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório financeiro", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${from} a ${to}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [["Indicador", "Valor"]],
      body: [
        ["Realizado (caixa) — Comissão recebida", formatCurrency(totals.recebido)],
        ["Realizado (caixa) — Despesas pagas", formatCurrency(totals.despPaga)],
        ["Realizado (caixa) — Lucro", formatCurrency(totals.lucro)],
        ["Competência — Comissão total", formatCurrency(totals.previsto)],
        ["Competência — Despesas totais", formatCurrency(totals.despPrevista)],
        ["Competência — Resultado", formatCurrency(totals.resultadoPrevisto)],
        ["Ticket médio por contrato", formatCurrency(tickets.ticketContrato)],
        ["Ticket médio de comissão recebida", formatCurrency(tickets.ticketComissao)],
      ],
    });
    autoTable(doc, {
      head: [["Operadora", "Comissão"]],
      body: porOperadora.map((r) => [r.nome, formatCurrency(r.valor)]),
    });
    autoTable(doc, {
      head: [["Canal", "Comissão"]],
      body: porCanal.map((r) => [r.nome, formatCurrency(r.valor)]),
    });
    autoTable(doc, {
      head: [["Faixa etária — Titulares", "Qtd"]],
      body: faixaTitulares.map((r) => [r.nome, String(r.qtd)]),
    });
    autoTable(doc, {
      head: [["Faixa etária — Dependentes", "Qtd"]],
      body: faixaDependentes.map((r) => [r.nome, String(r.qtd)]),
    });
    autoTable(doc, {
      head: [["Parentesco", "Qtd"]],
      body: porParentesco.map((r) => [r.nome, String(r.qtd)]),
    });
    doc.save(`relatorio_${from}_${to}.pdf`);
  };

  return (
    <div>
      <PageHeader title="Relatórios" description="Resumo financeiro e exportação" />
      {loading && <div className="mb-3 text-sm text-muted-foreground">Carregando relatório…</div>}
      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5">
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => void exportXlsx()}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
            <Button onClick={exportPdf}><FileText className="h-4 w-4" />PDF</Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Realizado (caixa)</div>
      <div className="grid gap-4 grid-cols-3 mb-4">
        {[
          { label: "Comissão recebida", value: totals.recebido, accent: "text-success" },
          { label: "Despesas pagas", value: totals.despPaga, accent: "text-destructive" },
          { label: "Lucro", value: totals.lucro, accent: totals.lucro >= 0 ? "text-success" : "text-destructive" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={`text-xl font-semibold mt-1 ${k.accent}`}>{formatCurrency(k.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Competência</div>
      <div className="grid gap-4 grid-cols-3 mb-4">
        {[
          { label: "Comissão total", value: totals.previsto, accent: "text-primary" },
          { label: "Despesas totais", value: totals.despPrevista, accent: "text-destructive" },
          { label: "Resultado por competência", value: totals.resultadoPrevisto, accent: totals.resultadoPrevisto >= 0 ? "text-success" : "text-destructive" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={`text-xl font-semibold mt-1 ${k.accent}`}>{formatCurrency(k.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticket médio</div>
      <div className="grid gap-4 grid-cols-2 mb-4">
        {[
          { label: "Ticket médio por contrato", value: tickets.ticketContrato, accent: "text-primary" },
          { label: "Ticket médio de comissão recebida", value: tickets.ticketComissao, accent: "text-success" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={`text-xl font-semibold mt-1 ${k.accent}`}>{formatCurrency(k.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Comissão recebida por operadora</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {porOperadora.map((r) => (
                <li key={r.nome} className="py-2 flex justify-between text-sm">
                  <span>{r.nome}</span><span className="tabular-nums font-medium">{formatCurrency(r.valor)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Comissão recebida por canal</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {porCanal.map((r) => (
                <li key={r.nome} className="py-2 flex justify-between text-sm">
                  <span>{r.nome}</span><span className="tabular-nums font-medium">{formatCurrency(r.valor)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Faixa etária — Titulares</CardTitle></CardHeader>
          <CardContent>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={faixaTitulares} margin={{ left: 8, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="qtd" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="qtd" position="top" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Faixa etária — Dependentes</CardTitle></CardHeader>
          <CardContent>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={faixaDependentes} margin={{ left: 8, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="qtd" fill="hsl(var(--success))" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="qtd" position="top" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Grau de parentesco dos dependentes</CardTitle></CardHeader>
          <CardContent>
            <div style={{ height: Math.max(220, porParentesco.length * 44) }}>
              {porParentesco.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dependentes no período.</p>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={porParentesco} layout="vertical" margin={{ left: 8, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis type="category" dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="qtd" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="qtd" position="right" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
