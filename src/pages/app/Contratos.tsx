import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContratoForm, ContratoFormValues } from "@/components/contratos/ContratoForm";
import { Plus, Pencil, Archive, Search, Download, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { fetchAllPages } from "@/lib/supabasePaging";
import { downloadSpreadsheet } from "@/lib/spreadsheet";

type Row = ContratoFormValues & {
  id: string;
  operadora?: { nome: string } | null;
  canal?: { nome: string } | null;
};

export default function Contratos() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [comissoesPagas, setComissoesPagas] = useState<Map<string, number>>(new Map());
  const [operadorasList, setOperadorasList] = useState<{ id: string; nome: string }[]>([]);
  const [canaisList, setCanaisList] = useState<{ id: string; nome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContratoFormValues | null>(null);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [operadoraId, setOperadoraId] = useState<string>("all");
  const [canalId, setCanalId] = useState<string>("all");
  const [vigMonth, setVigMonth] = useState<number | null>(null);
  const [vigYear, setVigYear] = useState<number>(new Date().getFullYear());

  const load = async () => {
    try {
      const [data, com, ops, cns] = await Promise.all([
        fetchAllPages<Row>((from, to) =>
        supabase
          .from("contratos")
          .select("*, operadora:operadoras(nome), canal:canais_venda(nome)")
          .order("created_at", { ascending: false })
          .range(from, to) as any,
        ),
        fetchAllPages<{ contrato_id: string; valor: number; pago: boolean }>((from, to) =>
          supabase.from("comissoes").select("contrato_id,valor,pago").range(from, to),
        ),
        fetchAllPages<{ id: string; nome: string }>((from, to) =>
          supabase.from("operadoras").select("id,nome").order("nome").range(from, to),
        ),
        fetchAllPages<{ id: string; nome: string }>((from, to) =>
          supabase.from("canais_venda").select("id,nome").order("nome").range(from, to),
        ),
      ]);
      const map = new Map<string, number>();
      for (const c of com) {
        if (!c.pago || !c.contrato_id) continue;
        map.set(c.contrato_id, (map.get(c.contrato_id) ?? 0) + Number(c.valor || 0));
      }
      setComissoesPagas(map);
      setOperadorasList(ops);
      setCanaisList(cns);
      setRows(data);
    } catch (error) {
      toast({
        title: "Erro ao carregar contratos",
        description: error instanceof Error ? error.message : "Falha na consulta.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    document.title = "Contratos — Corretor SaaS";
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tipo !== "all" && r.tipo !== tipo) return false;
      if (status !== "all" && r.status !== status) return false;
      if (operadoraId !== "all" && (r as any).operadora_id !== operadoraId) return false;
      if (canalId !== "all" && (r as any).canal_id !== canalId) return false;
      if (vigMonth != null) {
        const dv = (r as any).data_vigencia as string | null;
        if (!dv) return false;
        const pad = (n: number) => String(n).padStart(2, "0");
        const prefix = `${vigYear}-${pad(vigMonth)}`;
        if (!dv.startsWith(prefix)) return false;
      }
      if (q && !r.cliente.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, tipo, status, operadoraId, canalId, vigMonth, vigYear, q]);

  const totals = useMemo(() => {
    let mensal = 0, comissao = 0;
    for (const r of filtered) {
      mensal += Number((r as any).valor_mensal || 0);
      comissao += comissoesPagas.get(r.id) ?? 0;
    }
    return { mensal, comissao };
  }, [filtered, comissoesPagas]);

  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const currentVigMonth = vigMonth ?? (new Date().getMonth() + 1);
  const stepVigMonth = (delta: number) => {
    let m = currentVigMonth + delta;
    let y = vigYear;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setVigYear(y);
    setVigMonth(m);
  };

  const archive = async (id: string) => {
    if (!confirm("Arquivar este contrato? As comissões e os anexos serão preservados.")) return;
    const { error } = await supabase.from("contratos").update({ status: "Cancelado" }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Contrato arquivado" });
    load();
  };

  const exportXlsx = async () => {
    const data = filtered.map((r) => ({
      Cliente: r.cliente,
      Proposta: r.numero_proposta,
      Tipo: r.tipo,
      Operadora: r.operadora?.nome,
      Canal: r.canal?.nome,
      "Valor Mensal": Number(r.valor_mensal),
      "Comissão recebida": comissoesPagas.get(r.id) ?? 0,
      "Proporção": Number(r.proporcao_comissao),
      "Vigência": r.data_vigencia,
      "Reajuste": r.data_reajuste,
      Status: r.status,
    }));
    try {
      await downloadSpreadsheet([{ name: "Contratos", rows: data }], "contratos.xlsx");
    } catch (error) {
      toast({ title: "Erro ao exportar", description: error instanceof Error ? error.message : "Falha ao gerar Excel.", variant: "destructive" });
    }
  };

  const statusVariant = (s: string) =>
    s === "Ativo" ? "default" : s === "Cancelado" ? "destructive" : "secondary";

  return (
    <div>
      <PageHeader
        title="Contratos"
        description="Vendas fechadas, planos ativos e histórico"
        actions={
          <>
            <Button variant="outline" onClick={() => void exportXlsx()}>
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo contrato
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar cliente..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="PF">PF</SelectItem>
              <SelectItem value="PJ">PJ</SelectItem>
              <SelectItem value="Adesao">Adesão</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={operadoraId} onValueChange={setOperadoraId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Operadora" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas operadoras</SelectItem>
              {operadorasList.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={canalId} onValueChange={setCanalId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos canais</SelectItem>
              {canaisList.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className="inline-flex items-center border rounded-md">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => stepVigMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-24 text-center select-none">
              {vigMonth == null ? "Vigência" : MESES[currentVigMonth - 1]}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => stepVigMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="inline-flex items-center border rounded-md">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const y = vigYear - 1; setVigYear(y); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums w-14 text-center select-none">{vigYear}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const y = vigYear + 1; setVigYear(y); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {vigMonth != null && (
            <Button variant="ghost" size="sm" onClick={() => setVigMonth(null)}>
              <X className="h-4 w-4" /> Limpar vigência
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Operadora</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Reajuste</TableHead>
                <TableHead className="text-right">Mensal</TableHead>
                <TableHead className="text-right">Comissão recebida</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">Nenhum contrato encontrado.</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => { setEditing(r as any); setOpen(true); }}
                >
                  <TableCell className="font-medium">
                    {r.cliente}
                    {r.numero_proposta && <div className="text-xs text-muted-foreground">#{r.numero_proposta}</div>}
                  </TableCell>
                  <TableCell>{r.tipo}</TableCell>
                  <TableCell>{r.operadora?.nome ?? "—"}</TableCell>
                  <TableCell>{r.canal?.nome ?? "—"}</TableCell>
                  <TableCell>{formatDate(r.data_vigencia)}</TableCell>
                  <TableCell>{formatDate(r.data_reajuste)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.valor_mensal)}</TableCell>
                  <TableCell className="text-right tabular-nums text-success">{formatCurrency(comissoesPagas.get(r.id) ?? 0)}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.status) as any}>{r.status}</Badge></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r as any); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => archive(r.id)} title="Arquivar contrato">
                        <Archive className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {filtered.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="text-right font-medium">Totais</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totals.mensal)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-success">{formatCurrency(totals.comissao)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <ContratoForm open={open} onOpenChange={setOpen} initial={editing} onSaved={load} />
    </div>
  );
}
