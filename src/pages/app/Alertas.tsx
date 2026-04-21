import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";

export default function Alertas() {
  const [vencendo7, setVencendo7] = useState<any[]>([]);
  const [vencendo30, setVencendo30] = useState<any[]>([]);
  const [atrasadas, setAtrasadas] = useState<any[]>([]);
  const [renovacoes, setRenovacoes] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Alertas — Corretor SaaS";
    (async () => {
      const today = new Date();
      const t = today.toISOString().slice(0, 10);
      const d7 = new Date(today); d7.setDate(d7.getDate() + 7);
      const d30 = new Date(today); d30.setDate(d30.getDate() + 30);

      const { data: com } = await supabase
        .from("comissoes")
        .select("*, contrato:contratos(cliente)")
        .eq("pago", false)
        .order("mes_previsto");
      const list = com ?? [];
      setAtrasadas(list.filter((c: any) => c.mes_previsto < t));
      setVencendo7(list.filter((c: any) => c.mes_previsto >= t && c.mes_previsto <= d7.toISOString().slice(0, 10)));
      setVencendo30(list.filter((c: any) => c.mes_previsto > d7.toISOString().slice(0, 10) && c.mes_previsto <= d30.toISOString().slice(0, 10)));

      const { data: contratos } = await supabase.from("contratos").select("id,cliente,data_vigencia,status").eq("status", "Ativo");
      const renov = (contratos ?? []).filter((c: any) => {
        if (!c.data_vigencia) return false;
        const v = new Date(c.data_vigencia);
        const next = new Date(v); next.setFullYear(next.getFullYear() + 1);
        const diff = (next.getTime() - today.getTime()) / 86400000;
        return diff >= 0 && diff <= 60;
      });
      setRenovacoes(renov);
    })();
  }, []);

  const Section = ({ title, icon: Icon, items, accent }: any) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accent}`} />
          {title} <Badge variant="secondary" className="ml-1">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada por aqui.</p>
        ) : (
          <ul className="divide-y">
            {items.map((c: any) => (
              <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{c.contrato?.cliente ?? c.cliente}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(c.mes_previsto ?? c.data_vigencia)}</div>
                </div>
                {c.valor !== undefined && <div className="tabular-nums">{formatCurrency(c.valor)}</div>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Alertas e Vencimentos" description="Tudo que precisa da sua atenção" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Comissões em atraso" icon={AlertTriangle} items={atrasadas} accent="text-destructive" />
        <Section title="Vencendo em 7 dias" icon={Clock} items={vencendo7} accent="text-warning" />
        <Section title="Vencendo em 30 dias" icon={Clock} items={vencendo30} accent="text-primary" />
        <Section title="Renovações próximas" icon={RefreshCw} items={renovacoes} accent="text-primary" />
      </div>
    </div>
  );
}