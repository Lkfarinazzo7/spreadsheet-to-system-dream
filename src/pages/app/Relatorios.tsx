import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency } from "@/lib/format";
import { FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Relatorios() {
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10));
  const [comissoes, setComissoes] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Relatórios — Corretor SaaS";
  }, []);

  useEffect(() => {
    (async () => {
      const [c, d] = await Promise.all([
        supabase.from("comissoes").select("*, contrato:contratos(cliente, operadora:operadoras(nome), canal:canais_venda(nome))")
          .gte("mes_previsto", from).lte("mes_previsto", to),
        supabase.from("despesas").select("*").gte("data", from).lte("data", to),
      ]);
      setComissoes((c.data as any) ?? []);
      setDespesas((d.data as any) ?? []);
    })();
  }, [from, to]);

  const totals = useMemo(() => {
    const recebido = comissoes.filter((c) => c.pago).reduce((s, c) => s + Number(c.valor), 0);
    const previsto = comissoes.reduce((s, c) => s + Number(c.valor), 0);
    const desp = despesas.reduce((s, c) => s + Number(c.valor), 0);
    return { recebido, previsto, desp, lucro: recebido - desp };
  }, [comissoes, despesas]);

  const porOperadora = useMemo(() => {
    const m = new Map<string, number>();
    comissoes.forEach((c) => {
      const nome = c.contrato?.operadora?.nome ?? "Sem operadora";
      m.set(nome, (m.get(nome) ?? 0) + Number(c.valor));
    });
    return Array.from(m, ([nome, valor]) => ({ nome, valor }));
  }, [comissoes]);

  const porCanal = useMemo(() => {
    const m = new Map<string, number>();
    comissoes.forEach((c) => {
      const nome = c.contrato?.canal?.nome ?? "Sem canal";
      m.set(nome, (m.get(nome) ?? 0) + Number(c.valor));
    });
    return Array.from(m, ([nome, valor]) => ({ nome, valor }));
  }, [comissoes]);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Indicador: "Comissão prevista", Valor: totals.previsto },
      { Indicador: "Comissão recebida", Valor: totals.recebido },
      { Indicador: "Despesas", Valor: totals.desp },
      { Indicador: "Lucro líquido", Valor: totals.lucro },
    ]), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porOperadora), "Por operadora");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porCanal), "Por canal");
    XLSX.writeFile(wb, `relatorio_${from}_${to}.xlsx`);
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
        ["Comissão prevista", formatCurrency(totals.previsto)],
        ["Comissão recebida", formatCurrency(totals.recebido)],
        ["Despesas", formatCurrency(totals.desp)],
        ["Lucro líquido", formatCurrency(totals.lucro)],
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
            <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
            <Button onClick={exportPdf}><FileText className="h-4 w-4" />PDF</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-4">
        {[
          { label: "Previsto", value: totals.previsto, accent: "text-primary" },
          { label: "Recebido", value: totals.recebido, accent: "text-success" },
          { label: "Despesas", value: totals.desp, accent: "text-destructive" },
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Comissão por operadora</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">Comissão por canal</CardTitle></CardHeader>
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