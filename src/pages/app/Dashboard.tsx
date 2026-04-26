import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency } from "@/lib/format";
import { Wallet, CircleDollarSign, TrendingUp, ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
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

type Comissao = {
  id: string;
  contrato_id: string;
  mes_previsto: string;
  valor: number;
  pago: boolean;
  data_pagamento: string | null;
  contrato?: {
    operadora_id: string | null;
    canal_id: string | null;
  } | null;
};

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fmtIso = (d: Date) => d.toISOString().slice(0, 10);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

export default function Dashboard() {
  const today = new Date();

  // Period state
  const [mode, setMode] = useState<"month" | "custom">("month");
  const [monthDate, setMonthDate] = useState<Date>(startOfMonth(today));
  const [customStart, setCustomStart] = useState<string>(fmtIso(startOfMonth(today)));
  const [customEnd, setCustomEnd] = useState<string>(fmtIso(endOfMonth(today)));

  const period = useMemo(() => {
    if (mode === "custom") {
      return { start: customStart, end: customEnd };
    }
    return { start: fmtIso(startOfMonth(monthDate)), end: fmtIso(endOfMonth(monthDate)) };
  }, [mode, monthDate, customStart, customEnd]);

  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [operadoras, setOperadoras] = useState<{ id: string; nome: string }[]>([]);
  const [canais, setCanais] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    document.title = "Dashboard — Corretor SaaS";
    (async () => {
      const [k, o, cn] = await Promise.all([
        supabase
          .from("comissoes")
          .select("id,contrato_id,mes_previsto,valor,pago,data_pagamento,contrato:contratos(operadora_id,canal_id)"),
        supabase.from("operadoras").select("id,nome"),
        supabase.from("canais_venda").select("id,nome"),
      ]);
      setComissoes((k.data as any) ?? []);
      setOperadoras((o.data as any) ?? []);
      setCanais((cn.data as any) ?? []);
    })();
  }, []);

  // Filter comissões inside the active period
  const inPeriod = useMemo(() => {
    return comissoes.filter((c) => {
      const ref = c.pago && c.data_pagamento ? c.data_pagamento : c.mes_previsto;
      return ref >= period.start && ref <= period.end;
    });
  }, [comissoes, period]);

  const stats = useMemo(() => {
    const recebidas = inPeriod.filter((c) => c.pago);
    const aReceber = inPeriod.filter((c) => !c.pago).reduce((s, c) => s + Number(c.valor), 0);
    const receitaMes = recebidas.reduce((s, c) => s + Number(c.valor), 0);
    const ticketMedio = recebidas.length ? receitaMes / recebidas.length : 0;
    return { receitaMes, aReceber, ticketMedio };
  }, [inPeriod]);

  // Por operadora — soma do valor recebido no período, ordem decrescente
  const porOperadora = useMemo(() => {
    const map = new Map<string, number>();
    inPeriod.forEach((c) => {
      if (!c.pago) return;
      const id = c.contrato?.operadora_id;
      const nome = operadoras.find((o) => o.id === id)?.nome ?? "Sem operadora";
      map.set(nome, (map.get(nome) ?? 0) + Number(c.valor));
    });
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [inPeriod, operadoras]);

  const porCanal = useMemo(() => {
    const map = new Map<string, number>();
    inPeriod.forEach((c) => {
      if (!c.pago) return;
      const id = c.contrato?.canal_id;
      const nome = canais.find((o) => o.id === id)?.nome ?? "Sem canal";
      map.set(nome, (map.get(nome) ?? 0) + Number(c.valor));
    });
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [inPeriod, canais]);

  const proximosVenc = useMemo(() => {
    const now = fmtIso(today);
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    return comissoes
      .filter((c) => !c.pago && c.mes_previsto >= now && c.mes_previsto <= fmtIso(limit))
      .sort((a, b) => a.mes_previsto.localeCompare(b.mes_previsto))
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comissoes]);

  const kpis = [
    { label: "Receita do período", value: formatCurrency(stats.receitaMes), icon: CircleDollarSign, accent: "text-success" },
    { label: "Comissão a receber", value: formatCurrency(stats.aReceber), icon: Wallet, accent: "text-primary" },
    { label: "Ticket médio de recebimento", value: formatCurrency(stats.ticketMedio), icon: TrendingUp, accent: "text-foreground" },
  ];

  const monthLabel = `${MONTHS_PT[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  const customLabel = `${new Date(customStart + "T00:00:00").toLocaleDateString("pt-BR")} → ${new Date(customEnd + "T00:00:00").toLocaleDateString("pt-BR")}`;

  const goPrevMonth = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNextMonth = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goCurrentMonth = () => { setMonthDate(startOfMonth(today)); setMode("month"); };

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral da sua operação" />

      {/* Period selector */}
      <Card className="mb-6">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant={mode === "month" ? "default" : "outline"} size="sm" onClick={() => setMode("month")}>
              Mensal
            </Button>
            {mode === "month" && (
              <>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goPrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-3 py-1.5 text-sm font-medium min-w-[140px] text-center">{monthLabel}</div>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={goCurrentMonth}>Hoje</Button>
              </>
            )}
          </div>

          <div className="ml-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={mode === "custom" ? "default" : "outline"} size="sm">
                  <CalendarRange className="h-4 w-4" />
                  {mode === "custom" ? customLabel : "Período personalizado"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Início</Label>
                    <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fim</Label>
                    <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                  </div>
                  <Button className="w-full" size="sm" onClick={() => setMode("custom")}>
                    Aplicar período
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-6">
        {kpis.map((k) => (
          <Card key={k.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <k.icon className={`h-4 w-4 ${k.accent}`} />
              </div>
              <div className="text-2xl font-semibold mt-2">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita por operadora</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: Math.max(220, porOperadora.length * 44) }}>
              {porOperadora.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados no período.</p>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={porOperadora} layout="vertical" margin={{ left: 8, right: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="value" position="right" formatter={(v: number) => formatCurrency(v)} fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita por canal</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: Math.max(220, porCanal.length * 44) }}>
              {porCanal.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados no período.</p>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={porCanal} layout="vertical" margin={{ left: 8, right: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                    <Bar dataKey="value" fill="hsl(var(--success))" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="value" position="right" formatter={(v: number) => formatCurrency(v)} fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos vencimentos (30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {proximosVenc.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma parcela pendente nos próximos 30 dias.</p>
          ) : (
            <ul className="divide-y">
              {proximosVenc.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between">
                  <span className="text-sm">{new Date(c.mes_previsto + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                  <span className="text-sm font-medium">{formatCurrency(c.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}