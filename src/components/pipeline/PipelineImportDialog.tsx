import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  ETAPAS_VALIDAS,
  EtapaValida,
  parseImportRows,
  ParseResult,
  TEMPLATE_HEADERS,
  TEMPLATE_EXAMPLE,
} from "@/lib/pipelineImport";
import { formatCurrency } from "@/lib/format";

export function PipelineImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [defaultEtapa, setDefaultEtapa] = useState<EtapaValida>("Montagem de contrato");
  const [operadoras, setOperadoras] = useState<{ id: string; nome: string }[]>([]);
  const [canais, setCanais] = useState<{ id: string; nome: string }[]>([]);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFileName(null);
    setParsed(null);
    (async () => {
      const [{ data: o }, { data: c }] = await Promise.all([
        supabase.from("operadoras").select("id,nome").eq("ativo", true),
        supabase.from("canais_venda").select("id,nome").eq("ativo", true),
      ]);
      setOperadoras((o as any) ?? []);
      setCanais((c as any) ?? []);
    })();
  }, [open]);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([TEMPLATE_EXAMPLE], { header: [...TEMPLATE_HEADERS] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Propostas");
    XLSX.writeFile(wb, "modelo-pipeline.xlsx");
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const result = parseImportRows(rows, { operadoras, canais, defaultEtapa });
    setParsed(result);
  };

  // Re-parse when defaultEtapa changes (without re-reading file)
  useEffect(() => {
    if (!parsed || !fileRef.current?.files?.[0]) return;
    onFile(fileRef.current.files[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEtapa]);

  const stats = useMemo(() => {
    if (!parsed) return null;
    const totalValor = parsed.valid.reduce((s, r) => s + r.valor_mensal, 0);
    const warnings = parsed.valid.filter((r) => r._warnings.length > 0).length;
    return { totalValor, warnings };
  }, [parsed]);

  const doImport = async () => {
    if (!user || !parsed?.valid.length) return;
    setBusy(true);
    try {
      const base = Date.now();
      const payload = parsed.valid.map((r, i) => ({
        user_id: user.id,
        cliente: r.cliente,
        numero_proposta: r.numero_proposta,
        tipo: r.tipo as any,
        operadora_id: r.operadora_id,
        canal_id: r.canal_id,
        etapa: r.etapa as any,
        valor_mensal: r.valor_mensal,
        data_vigencia: r.data_vigencia,
        observacoes: r.observacoes,
        dados_proposta: r.dados_proposta as any,
        posicao: base + i,
      }));
      const { error } = await supabase.from("pipeline_contratos").insert(payload);
      if (error) throw error;
      toast({ title: `${payload.length} propostas importadas` });
      onOpenChange(false);
      onImported();
    } catch (err: any) {
      console.error("[PipelineImport] error:", err);
      toast({ title: "Erro ao importar", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar planilha de propostas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-medium">Comece pelo modelo</div>
                <div className="text-xs text-muted-foreground">
                  Baixe o arquivo de exemplo, preencha e envie de volta.
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Baixar modelo (.xlsx)
              </Button>
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Etapa padrão</Label>
              <Select value={defaultEtapa} onValueChange={(v) => setDefaultEtapa(v as EtapaValida)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ETAPAS_VALIDAS.filter((e) => e !== "Implantado").map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Arquivo (.xlsx, .xls, .csv)</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </div>
          </div>

          {parsed && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" /> {parsed.valid.length} válidas
                </Badge>
                {parsed.errors.length > 0 && (
                  <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                    <AlertTriangle className="h-3 w-3" /> {parsed.errors.length} com erro
                  </Badge>
                )}
                {stats && stats.warnings > 0 && (
                  <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
                    <AlertTriangle className="h-3 w-3" /> {stats.warnings} com aviso
                  </Badge>
                )}
                {stats && (
                  <Badge variant="secondary" className="ml-auto tabular-nums">
                    Total: {formatCurrency(stats.totalValor)}
                  </Badge>
                )}
              </div>

              {parsed.errors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-0.5 max-h-32 overflow-y-auto">
                  {parsed.errors.slice(0, 20).map((er) => (
                    <div key={er.row}>Linha {er.row}: {er.reason}</div>
                  ))}
                  {parsed.errors.length > 20 && <div>… e mais {parsed.errors.length - 20}</div>}
                </div>
              )}

              {parsed.valid.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr className="text-left">
                          <th className="px-2 py-1.5">Cliente</th>
                          <th className="px-2 py-1.5">Tipo</th>
                          <th className="px-2 py-1.5">Etapa</th>
                          <th className="px-2 py-1.5 text-right">Valor</th>
                          <th className="px-2 py-1.5">Avisos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.valid.slice(0, 10).map((r) => (
                          <tr key={r._rowIndex} className="border-t">
                            <td className="px-2 py-1.5 truncate max-w-[180px]">{r.cliente}</td>
                            <td className="px-2 py-1.5">{r.tipo}</td>
                            <td className="px-2 py-1.5 truncate max-w-[160px]">{r.etapa}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(r.valor_mensal)}</td>
                            <td className="px-2 py-1.5 text-warning">
                              {r._warnings.join("; ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.valid.length > 10 && (
                    <div className="text-xs text-muted-foreground px-2 py-1.5 bg-muted/30 border-t">
                      Mostrando 10 de {parsed.valid.length}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={doImport} disabled={busy || !parsed?.valid.length}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {parsed?.valid.length ?? 0} propostas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}