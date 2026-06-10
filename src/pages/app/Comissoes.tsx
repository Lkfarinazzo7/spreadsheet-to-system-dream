import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Check, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";

type Comissao = {
  id: string;
  contrato_id: string;
  parcela: number;
  tipo: "Bancaria" | "Vida" | "Adesao";
  mes_previsto: string;
  data_pagamento: string | null;
  valor: number;
  pago: boolean;
  contrato?: { cliente: string; valor_mensal: number; proporcao_comissao: number } | null;
};
export default function Comissoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Comissao[]>([]);
  const [contratos, setContratos] = useState<{ id: string; cliente: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateField, setDateField] = useState<"mes_previsto" | "data_pagamento">("mes_previsto");
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Comissao>>({ parcela: 1, tipo: "Bancaria", valor: 0, pago: false });

  const load = async () => {
    const [c, k] = await Promise.all([
      supabase
        .from("comissoes")
        .select("*, contrato:contratos(cliente,valor_mensal,proporcao_comissao)")
        .order("mes_previsto", { ascending: false }),
      supabase.from("contratos").select("id,cliente").order("cliente"),
    ]);
    setRows((c.data as any) ?? []);
    setContratos((k.data as any) ?? []);
  };

  useEffect(() => {
    document.title = "Comissões — Corretor SaaS";
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "pago") return r.pago;
      if (statusFilter === "aberto") return !r.pago;
      return true;
    }).filter((r) => {
      if (!dateFrom && !dateTo) return true;
      const v = dateField === "mes_previsto" ? r.mes_previsto : r.data_pagamento;
      if (!v) return false;
      if (dateFrom && v < dateFrom) return false;
      if (dateTo && v > dateTo) return false;
      return true;
    });
  }, [rows, statusFilter, dateField, dateFrom, dateTo]);

  const totals = useMemo(() => {
    let total = 0, pago = 0, aberto = 0;
    for (const r of filtered) {
      const v = Number(r.valor) || 0;
      total += v;
      if (r.pago) pago += v; else aberto += v;
    }
    return { total, pago, aberto };
  }, [filtered]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const selectMonth = (y: number, m: number) => {
    const last = new Date(y, m, 0).getDate();
    setDateFrom(`${y}-${pad(m)}-01`);
    setDateTo(`${y}-${pad(m)}-${pad(last)}`);
    setActiveMonth(m);
  };
  const clearPeriodo = () => {
    setDateFrom(null);
    setDateTo(null);
    setActiveMonth(null);
  };
  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const currentMonth = activeMonth ?? (new Date().getMonth() + 1);
  const stepMonth = (delta: number) => {
    let m = currentMonth + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setYear(y);
    selectMonth(y, m);
  };

  const togglePago = async (r: Comissao) => {
    const novo = !r.pago;
    const { error } = await supabase
      .from("comissoes")
      .update({ pago: novo, data_pagamento: novo ? new Date().toISOString().slice(0, 10) : null })
      .eq("id", r.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir parcela?")) return;
    await supabase.from("comissoes").delete().eq("id", id);
    load();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.contrato_id || !form.mes_previsto) return;
    const { error } = await supabase.from("comissoes").insert({
      user_id: user.id,
      contrato_id: form.contrato_id,
      parcela: form.parcela ?? 1,
      tipo: (form.tipo as any) ?? "Bancaria",
      mes_previsto: form.mes_previsto,
      valor: Number(form.valor ?? 0),
      pago: false,
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Parcela criada" });
    setOpen(false);
    setForm({ parcela: 1, tipo: "Bancaria", valor: 0, pago: false });
    load();
  };

  return (
    <div>
      <PageHeader
        title="Comissões"
        description="Parcelas previstas e recebidas"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nova parcela
          </Button>
        }
      />

      <Card className="mb-4">
            <CardContent className="p-3 flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="aberto">Em aberto</SelectItem>
                    <SelectItem value="pago">Pagas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Filtrar por</Label>
                <Select value={dateField} onValueChange={(v) => setDateField(v as any)}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes_previsto">Mês previsto</SelectItem>
                    <SelectItem value="data_pagamento">Data de pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <DatePicker value={dateFrom} onChange={setDateFrom} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <DatePicker value={dateTo} onChange={setDateTo} />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={clearPeriodo}>
                  <X className="h-4 w-4" /> Limpar período
                </Button>
              )}
            </CardContent>
            <CardContent className="p-3 pt-0 flex flex-wrap items-center gap-2 border-t">
              <div className="inline-flex items-center border rounded-md">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => stepMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium w-24 text-center select-none">
                  {MESES[currentMonth - 1]}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => stepMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="inline-flex items-center border rounded-md">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const y = year - 1; setYear(y); if (activeMonth) selectMonth(y, activeMonth); }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium tabular-nums w-14 text-center select-none">{year}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const y = year + 1; setYear(y); if (activeMonth) selectMonth(y, activeMonth); }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {activeMonth && (
                <Button variant="ghost" size="sm" onClick={clearPeriodo}>
                  <X className="h-4 w-4" /> Limpar
                </Button>
              )}
              <div className="ml-auto flex flex-wrap gap-3 text-sm">
                <span className="text-muted-foreground">Em aberto: <strong className="text-foreground tabular-nums">{formatCurrency(totals.aberto)}</strong></span>
                <span className="text-muted-foreground">Pago: <strong className="text-success tabular-nums">{formatCurrency(totals.pago)}</strong></span>
                <span className="text-muted-foreground">Total: <strong className="text-foreground tabular-nums">{formatCurrency(totals.total)}</strong></span>
              </div>
            </CardContent>
          </Card>

      <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mês previsto</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhuma parcela.</TableCell></TableRow>
                  )}
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.contrato?.cliente ?? "—"}</TableCell>
                      <TableCell>{r.parcela}</TableCell>
                      <TableCell>{r.tipo}</TableCell>
                      <TableCell>{formatDate(r.mes_previsto)}</TableCell>
                      <TableCell>{formatDate(r.data_pagamento)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.valor)}</TableCell>
                      <TableCell>
                        {r.pago ? (
                          <Badge className="bg-success text-success-foreground hover:bg-success">Pago</Badge>
                        ) : (
                          <Badge variant="secondary">Aberto</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => togglePago(r)} title={r.pago ? "Marcar como aberto" : "Marcar como pago"}>
                            <Check className={`h-4 w-4 ${r.pago ? "text-muted-foreground" : "text-success"}`} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-medium">Total filtrado</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totals.total)}</TableCell>
                    <TableCell colSpan={2} className="text-xs text-muted-foreground">
                      Pago: <span className="text-success font-medium">{formatCurrency(totals.pago)}</span> · Aberto: <span className="text-foreground font-medium">{formatCurrency(totals.aberto)}</span>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova parcela de comissão</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Contrato</Label>
              <Select value={form.contrato_id ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, contrato_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione um contrato" /></SelectTrigger>
                <SelectContent>
                  {contratos.map((c) => (<SelectItem key={c.id} value={c.id}>{c.cliente}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Parcela</Label>
                <Input type="number" min={1} value={form.parcela ?? 1} onChange={(e) => setForm((p) => ({ ...p, parcela: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo as string} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bancaria">Bancária</SelectItem>
                    <SelectItem value="Vida">Vida</SelectItem>
                    <SelectItem value="Adesao">Adesão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mês previsto</Label>
                <Input type="date" value={form.mes_previsto ?? ""} onChange={(e) => setForm((p) => ({ ...p, mes_previsto: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor ?? 0} onChange={(e) => setForm((p) => ({ ...p, valor: Number(e.target.value) }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}