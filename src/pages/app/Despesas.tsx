import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, localIso } from "@/lib/format";
import { Plus, Trash2, Check } from "lucide-react";

type Despesa = { id: string; descricao: string; categoria: string | null; valor: number; data: string; pago: boolean; data_pagamento: string | null };

export default function Despesas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Despesa[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Despesa>>({ descricao: "", valor: 0, data: localIso(), pago: false });

  const load = async () => {
    const { data } = await supabase.from("despesas").select("*").order("data", { ascending: false });
    setRows((data as any) ?? []);
  };

  useEffect(() => {
    document.title = "Despesas — Corretor SaaS";
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("despesas").insert({
      user_id: user.id,
      descricao: form.descricao!,
      categoria: form.categoria ?? null,
      valor: Number(form.valor ?? 0),
      data: form.data!,
      pago: !!form.pago,
      // Se já entra como paga, a melhor aproximação da data de pagamento é a própria data da despesa.
      data_pagamento: form.pago ? form.data! : null,
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setOpen(false);
    setForm({ descricao: "", valor: 0, data: localIso(), pago: false });
    load();
  };

  const togglePago = async (r: Despesa) => {
    const novo = !r.pago;
    const { error } = await supabase
      .from("despesas")
      .update({ pago: novo, data_pagamento: novo ? localIso() : null })
      .eq("id", r.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir despesa?")) return;
    const { error } = await supabase.from("despesas").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    load();
  };

  const total = rows.reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div>
      <PageHeader
        title="Despesas"
        description={`Total registrado: ${formatCurrency(total)}`}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Nova despesa</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Nenhuma despesa.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.descricao}</TableCell>
                  <TableCell>{r.categoria ?? "—"}</TableCell>
                  <TableCell>{formatDate(r.data)}</TableCell>
                  <TableCell>{formatDate(r.data_pagamento)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.valor)}</TableCell>
                  <TableCell>
                    {r.pago ? <Badge className="bg-success text-success-foreground hover:bg-success">Pago</Badge> : <Badge variant="secondary">Aberto</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => togglePago(r)}>
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
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input required value={form.descricao ?? ""} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input placeholder="CRM, Marketing..." value={form.categoria ?? ""} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor ?? 0} onChange={(e) => setForm((p) => ({ ...p, valor: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={form.data ?? ""} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
              </div>
              <div className="space-y-1.5 flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!form.pago} onChange={(e) => setForm((p) => ({ ...p, pago: e.target.checked }))} />
                  Já pago
                </label>
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