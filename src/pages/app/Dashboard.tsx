import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency, monthKey } from "@/lib/format";
import { Wallet, TrendingUp, FileCheck2, AlertCircle, CircleDollarSign } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["hsl(222 76% 52%)", "hsl(152 62% 40%)", "hsl(38 92% 50%)", "hsl(280 65% 55%)", "hsl(190 70% 45%)", "hsl(0 78% 58%)"];

type Contrato = {
  id: string;
  cliente: string;
  valor_mensal: number;
  proporcao_comissao: number;
  status: string;
  data_vigencia: string | null;
  operadora_id: string | null;
  canal_id: string | null;
};
type Comissao = { id: string; mes_previsto: string; valor: number; pago: boolean; data_pagamento: string | null };

export default function Dashboard() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [operadoras, setOperadoras] = useState<{ id: string; nome: string }[]>([]);
  const [canais, setCanais] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    document.title = "Dashboard — Corretor SaaS";
    (async () => {
      const [c, k, o, cn] = await Promise.all([
        supabase.from("contratos").select("id,cliente,valor_mensal,proporcao_comissao,status,data_vigencia,operadora_id,canal_id"),
        supabase.from("comissoes").select("id,mes_previsto,valor,pago,data_pagamento"),
        supabase.from("operadoras").select("id,nome"),
        supabase.from("canais_venda").select("id,nome"),
      ]);
      setContratos((c.data as any) ?? []);
      setComissoes((k.data as any) ?? []);
      setOperadoras((o.data as any) ?? []);
      setCanais((cn.data as any) ?? []);
    })();
  }, []);

  const now = new Date();
  const thisMonth = monthKey(now);

  const stats = useMemo(() => {
    const ativos = contratos.filter((c) => c.status === "Ativo");
    const receitaMes = comissoes
      .filter((c) => c.pago && c.data_pagamento && monthKey(c.data_pagamento) === thisMonth)
      .reduce((s, c) => s + Number(c.valor), 0);
    const aReceber = comissoes.filter((c) => !c.pago).reduce((s, c) => s + Number(c.valor), 0);
    const recebida = comissoes.filter((c) => c.pago).reduce((s, c) => s + Number(c.valor), 0);
    const ticket = ativos.length ? ativos.reduce((s, c) => s + Number(c.valor_mensal), 0) / ativos.length : 0;
    return { ativos: ativos.length, receitaMes, aReceber, recebida, ticket };
  }, [contratos, comissoes, thisMonth]);

  const monthly = useMemo(() => {
    const map = new Map<string, { mes: string; previsto: number; recebido: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      map.set(key, {
        mes: d.toLocaleDateString("pt-BR", { month: "short" }),
        previsto: 0,
        recebido: 0,
      });
    }
    comissoes.forEach((c) => {
      const k = monthKey(c.mes_previsto);
      const row = map.get(k);
      if (row) row.previsto += Number(c.valor);
      if (c.pago && c.data_pagamento) {
        const rk = monthKey(c.data_pagamento);
        const r = map.get(rk);
        if (r) r.recebido += Number(c.valor);
      }
    });
    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comissoes]);

  const porOperadora = useMemo(() => {
    const m = new Map<string, number>();
    contratos.forEach((c) => {
      const nome = operadoras.find((o) => o.id === c.operadora_id)?.nome ?? "Sem operadora";
      m.set(nome, (m.get(nome) ?? 0) + Number(c.valor_mensal));
    });
    return Array.from(m, ([name, value]) => ({ name, value }));
  }, [contratos, operadoras]);

  const porCanal = useMemo(() => {
    const m = new Map<string, number>();
    contratos.forEach((c) => {
      const nome = canais.find((o) => o.id === c.canal_id)?.nome ?? "Sem canal";
      m.set(nome, (m.get(nome) ?? 0) + 1);
    });
    return Array.from(m, ([name, qtd]) => ({ name, qtd }));
  }, [contratos, canais]);

  const proximosVenc = useMemo(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    return comissoes
      .filter((c) => !c.pago && new Date(c.mes_previsto) <= limit)
      .sort((a, b) => a.mes_previsto.localeCompare(b.mes_previsto))
      .slice(0, 6);
  }, [comissoes]);

  const kpis = [
    { label: "Receita do mês", value: formatCurrency(stats.receitaMes), icon: CircleDollarSign, accent: "text-success" },
    { label: "Comissão a receber", value: formatCurrency(stats.aReceber), icon: Wallet, accent: "text-primary" },
    { label: "Comissão recebida", value: formatCurrency(stats.recebida), icon: TrendingUp, accent: "text-success" },
    { label: "Contratos ativos", value: String(stats.ativos), icon: FileCheck2, accent: "text-foreground" },
    { label: "Ticket médio", value: formatCurrency(stats.ticket), icon: AlertCircle, accent: "text-foreground" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral da sua operação" />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-6">
        {kpis.map((k) => (
          <Card key={k.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <k.icon className={`h-4 w-4 ${k.accent}`} />
              </div>
              <div className="text-xl font-semibold mt-2">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Comissão mês a mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Legend />
                  <Bar dataKey="previsto" name="Previsto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recebido" name="Recebido" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita por operadora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={porOperadora} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {porOperadora.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contratos por canal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={porCanal} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            {proximosVenc.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma parcela pendente nos próximos 30 dias.</p>
            ) : (
              <ul className="divide-y">
                {proximosVenc.map((c) => (
                  <li key={c.id} className="py-2 flex items-center justify-between">
                    <span className="text-sm">{new Date(c.mes_previsto).toLocaleDateString("pt-BR")}</span>
                    <span className="text-sm font-medium">{formatCurrency(c.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}