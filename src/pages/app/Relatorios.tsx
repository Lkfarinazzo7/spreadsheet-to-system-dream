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

export default function Relatorios() {
  const { toast } = useToast();
  const today = new Date();
  const [from, setFrom] = useState(localIso(new Date(today.getFullYear(), today.getMonth() - 5, 1)));
  const [to, setTo] = useState(localIso(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  const [comissoes, setComissoes] = useState<ReportComissao[]>([]);
  const [despesas, setDespesas] = useState<ReportDespesa[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Relatórios — Corretor SaaS";
  }, []);

  useEffect(() => {
    (async () => {
      if (from > to) {
        setComissoes([]);
        setDespesas([]);
        setLoading(false);
        toast({ title: "Período inválido", description: "A data inicial deve ser anterior à final.", variant: "destructive" });
        return;
      }
      setLoading(true);
      // Busca linhas que pertencem ao período por competência (mes_previsto / data)
      // OU por caixa (data_pagamento), para alimentar as duas visões sem re-consultar.
      try {
        const [c, d] = await Promise.all([
          fetchAllPages<ReportComissao>((start, end) => supabase.from("comissoes")
            .select("pago,data_pagamento,mes_previsto,valor,contrato:contratos(cliente, operadora:operadoras(nome), canal:canais_venda(nome))")
            .or(`and(mes_previsto.gte.${from},mes_previsto.lte.${to}),and(data_pagamento.gte.${from},data_pagamento.lte.${to})`)
            .range(start, end)),
          fetchAllPages<ReportDespesa>((start, end) => supabase.from("despesas")
            .select("pago,data_pagamento,data,valor")
            .or(`and(data.gte.${from},data.lte.${to}),and(data_pagamento.gte.${from},data_pagamento.lte.${to})`)
            .range(start, end)),
        ]);
        setComissoes(c);
        setDespesas(d);
      } catch (error) {
        setComissoes([]);
        setDespesas([]);
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

  const exportXlsx = async () => {
    const resumo = [
      { Indicador: "REALIZADO (caixa) — Comissão recebida", Valor: totals.recebido },
      { Indicador: "REALIZADO (caixa) — Despesas pagas", Valor: totals.despPaga },
      { Indicador: "REALIZADO (caixa) — Lucro", Valor: totals.lucro },
      { Indicador: "COMPETÊNCIA — Comissão total", Valor: totals.previsto },
      { Indicador: "COMPETÊNCIA — Despesas totais", Valor: totals.despPrevista },
      { Indicador: "COMPETÊNCIA — Resultado", Valor: totals.resultadoPrevisto },
    ];
    try {
      await downloadSpreadsheet([
        { name: "Resumo", rows: resumo },
        { name: "Por operadora", rows: porOperadora },
        { name: "Por canal", rows: porCanal },
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
    </div>
  );
}
