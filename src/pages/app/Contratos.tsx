import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContratoForm, ContratoFormValues } from "@/components/contratos/ContratoForm";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import * as XLSX from "xlsx";

type Row = ContratoFormValues & {
  id: string;
  operadora?: { nome: string } | null;
  canal?: { nome: string } | null;
};

export default function Contratos() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContratoFormValues | null>(null);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const load = async () => {
    const { data } = await supabase
      .from("contratos")
      .select("*, operadora:operadoras(nome), canal:canais_venda(nome)")
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  };

  useEffect(() => {
    document.title = "Contratos — Corretor SaaS";
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tipo !== "all" && r.tipo !== tipo) return false;
      if (status !== "all" && r.status !== status) return false;
      if (q && !r.cliente.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, tipo, status, q]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este contrato? As comissões vinculadas também serão removidas.")) return;
    await supabase.from("comissoes").delete().eq("contrato_id", id);
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Contrato excluído" });
    load();
  };

  const exportXlsx = () => {
    const data = filtered.map((r) => ({
      Cliente: r.cliente,
      Proposta: r.numero_proposta,
      Tipo: r.tipo,
      Operadora: r.operadora?.nome,
      Canal: r.canal?.nome,
      "Valor Mensal": Number(r.valor_mensal),
      "Proporção": Number(r.proporcao_comissao),
      "Vigência": r.data_vigencia,
      "Reajuste": r.data_reajuste,
      Status: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contratos");
    XLSX.writeFile(wb, "contratos.xlsx");
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
            <Button variant="outline" onClick={exportXlsx}>
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo contrato
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap gap-2">
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
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">Nenhum contrato encontrado.</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
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
                  <TableCell><Badge variant={statusVariant(r.status) as any}>{r.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r as any); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ContratoForm open={open} onOpenChange={setOpen} initial={editing} onSaved={load} />
    </div>
  );
}