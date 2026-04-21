import { useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2 } from "lucide-react";

type Sheet = { name: string; rows: any[] };

export default function Importar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const list: Sheet[] = wb.SheetNames.map((n) => ({
      name: n,
      rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: null }),
    }));
    setSheets(list);
    setActive(0);
  };

  const lookupOrCreate = async (table: "operadoras" | "canais_venda" | "categorias_plano", nome: string) => {
    if (!nome || !user) return null;
    const { data: ex } = await supabase.from(table).select("id").eq("user_id", user.id).eq("nome", nome).maybeSingle();
    if (ex?.id) return ex.id as string;
    const { data: ins } = await supabase.from(table).insert({ user_id: user.id, nome }).select("id").single();
    return (ins?.id as string) ?? null;
  };

  const importContratos = async (rows: any[]) => {
    if (!user) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const r of rows) {
      try {
        const cliente = String(r["Cliente"] ?? r["cliente"] ?? r["NOMENCLATURA"] ?? r["Nomenclatura"] ?? "").trim();
        if (!cliente) continue;
        const operadoraNome = String(r["Operadora"] ?? r["OPERADORA"] ?? "").trim();
        const canalNome = String(r["Canal"] ?? r["CANAL"] ?? r["Canal de Venda"] ?? "").trim();
        const catNome = String(r["Categoria"] ?? r["CATEGORIA"] ?? "").trim();
        const tipoRaw = String(r["Tipo"] ?? r["TIPO"] ?? "PF").toUpperCase();
        const tipo = tipoRaw.includes("PJ") ? "PJ" : tipoRaw.includes("ADES") ? "Adesao" : "PF";
        const valor = Number(r["Valor Mensal"] ?? r["VALOR"] ?? r["valor_mensal"] ?? 0) || 0;
        const proporcao = Number(r["Proporção"] ?? r["Proporcao"] ?? r["PROPORCAO"] ?? 0) || 0;
        const vig = r["Vigência"] ?? r["Vigencia"] ?? r["VIGENCIA"] ?? null;
        const operadora_id = operadoraNome ? await lookupOrCreate("operadoras", operadoraNome) : null;
        const canal_id = canalNome ? await lookupOrCreate("canais_venda", canalNome) : null;
        const categoria_id = catNome ? await lookupOrCreate("categorias_plano", catNome) : null;
        const { error } = await supabase.from("contratos").insert({
          user_id: user.id,
          cliente, tipo, operadora_id, canal_id, categoria_id,
          valor_mensal: valor, proporcao_comissao: proporcao,
          data_vigencia: vig ? new Date(vig).toISOString().slice(0, 10) : null,
          status: "Ativo",
        });
        if (error) fail++; else ok++;
      } catch { fail++; }
    }
    setBusy(false);
    toast({ title: "Importação concluída", description: `${ok} importados, ${fail} falhas.` });
  };

  const importDespesas = async (rows: any[]) => {
    if (!user) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const r of rows) {
      const descricao = String(r["Descrição"] ?? r["Descricao"] ?? r["DESCRICAO"] ?? "").trim();
      if (!descricao) continue;
      const valor = Number(r["Valor"] ?? r["VALOR"] ?? 0) || 0;
      const data = r["Data"] ?? r["DATA"] ?? new Date().toISOString().slice(0, 10);
      const categoria = String(r["Categoria"] ?? r["CATEGORIA"] ?? "").trim() || null;
      const { error } = await supabase.from("despesas").insert({
        user_id: user.id, descricao, valor, categoria,
        data: new Date(data).toISOString().slice(0, 10), pago: false,
      });
      if (error) fail++; else ok++;
    }
    setBusy(false);
    toast({ title: "Importação concluída", description: `${ok} importadas, ${fail} falhas.` });
  };

  const current = sheets[active];
  const cols = current ? Object.keys(current.rows[0] ?? {}) : [];

  return (
    <div>
      <PageHeader title="Importar planilhas" description="Carregue suas planilhas atuais (.xlsx) e leve os dados para o sistema" />
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <Input type="file" accept=".xlsx,.xls" onChange={onFile} className="max-w-sm" />
          {sheets.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {sheets.map((s, i) => (
                <Button key={s.name} size="sm" variant={i === active ? "default" : "outline"} onClick={() => setActive(i)}>
                  {s.name} <span className="ml-1 text-xs opacity-70">({s.rows.length})</span>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {current && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Pré-visualização — {current.name}</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => importContratos(current.rows)} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}<Upload className="h-4 w-4" /> Importar como Contratos
              </Button>
              <Button variant="outline" onClick={() => importDespesas(current.rows)} disabled={busy}>
                Importar como Despesas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {current.rows.slice(0, 20).map((r, i) => (
                  <TableRow key={i}>
                    {cols.map((c) => <TableCell key={c} className="text-xs">{String(r[c] ?? "")}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {current.rows.length > 20 && (
              <p className="text-xs text-muted-foreground mt-2">Mostrando 20 de {current.rows.length} linhas.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}