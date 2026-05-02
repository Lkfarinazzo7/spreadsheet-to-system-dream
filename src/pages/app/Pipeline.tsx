import { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Wallet, Layers, CalendarClock } from "lucide-react";
import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { PipelineItem } from "@/components/pipeline/PipelineCard";
import { PipelineForm, PipelineFormValues } from "@/components/pipeline/PipelineForm";
import { ContratoForm, ContratoFormValues } from "@/components/contratos/ContratoForm";
import { PipelineImportDialog } from "@/components/pipeline/PipelineImportDialog";
import { formatCurrency } from "@/lib/format";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const ETAPAS = [
  "Montagem de contrato",
  "Assinatura / Declaração de saúde",
  "Entrevista médica",
  "Em análise",
  "Pendências",
  "Aguardando vigência",
  "Implantado",
] as const;

const ETAPA_ACCENT: Record<string, string> = {
  "Montagem de contrato": "bg-muted-foreground/40",
  "Assinatura / Declaração de saúde": "bg-primary/70",
  "Entrevista médica": "bg-primary",
  "Em análise": "bg-warning/80",
  "Pendências": "bg-destructive/70",
  "Aguardando vigência": "bg-success/60",
  "Implantado": "bg-success",
};

function addOneYear(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y + 1, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

export default function Pipeline() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PipelineFormValues | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [onlyRevisar, setOnlyRevisar] = useState(false);

  // Promote modal (open ContratoForm with prefilled data)
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoting, setPromoting] = useState<PipelineItem | null>(null);
  const [promoteInitial, setPromoteInitial] = useState<ContratoFormValues | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = async () => {
    const { data, error } = await supabase
      .from("pipeline_contratos")
      .select("*, operadora:operadoras(nome), canal:canais_venda(nome)")
      .neq("etapa", "Implantado")
      .order("posicao");
    if (error) {
      console.error("[Pipeline] load error:", error);
      toast({
        title: "Erro ao carregar pipeline",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setItems((data as any) ?? []);
  };

  useEffect(() => {
    document.title = "Pipeline — Corretor SaaS";
    load();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, PipelineItem[]> = {};
    for (const e of ETAPAS) map[e] = [];
    const today = new Date().toISOString().slice(0, 10);
    const filtered = onlyRevisar
      ? items.filter((i) => i.data_revisao && i.data_revisao <= today)
      : items;
    for (const it of filtered) {
      if (map[it.etapa]) map[it.etapa].push(it);
    }
    return map;
  }, [items, onlyRevisar]);

  const totalGeral = useMemo(() => items.reduce((s, i) => s + Number(i.valor_mensal || 0), 0), [items]);
  const today = new Date().toISOString().slice(0, 10);
  const revisarHoje = useMemo(
    () => items.filter((i) => i.data_revisao && i.data_revisao <= today).length,
    [items, today],
  );

  const handlePromote = (item: PipelineItem) => {
    setPromoting(item);
    setPromoteInitial({
      cliente: item.cliente,
      tipo: item.tipo as any,
      operadora_id: (item as any).operadora_id ?? null,
      canal_id: (item as any).canal_id ?? null,
      valor_mensal: Number(item.valor_mensal) || 0,
      proporcao_comissao: 0,
      data_vigencia: item.data_vigencia ?? null,
      data_reajuste: item.data_vigencia ? addOneYear(item.data_vigencia) : null,
      numero_proposta: item.numero_proposta ?? null,
      observacoes: item.observacoes ?? null,
      status: "Ativo",
    });
    setPromoteOpen(true);
  };

  const onContratoSaved = async () => {
    // After contrato is saved successfully, remove from pipeline
    if (promoting) {
      await supabase.from("pipeline_contratos").delete().eq("id", promoting.id);
      setPromoting(null);
      setPromoteInitial(null);
      toast({ title: "Implantado!", description: "Cartão movido para Contratos." });
      load();
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const id = e.active.id as string;
    const newEtapa = e.over?.id as string | undefined;
    if (!newEtapa) return;

    const item = items.find((i) => i.id === id);
    if (!item || item.etapa === newEtapa) return;

    if (newEtapa === "Implantado") {
      handlePromote(item);
      return;
    }

    setItems((p) => p.map((i) => (i.id === id ? { ...i, etapa: newEtapa } : i)));
    const { error } = await supabase
      .from("pipeline_contratos")
      .update({ etapa: newEtapa as any })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao mover", description: error.message, variant: "destructive" });
      load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta proposta do pipeline?")) return;
    await supabase.from("pipeline_contratos").delete().eq("id", id);
    toast({ title: "Proposta excluída" });
    load();
  };

  const handleEdit = (item: PipelineItem) => {
    setEditing({
      id: item.id,
      cliente: item.cliente,
      numero_proposta: item.numero_proposta ?? null,
      tipo: item.tipo as any,
      operadora_id: (item as any).operadora_id ?? null,
      canal_id: (item as any).canal_id ?? null,
      valor_mensal: Number(item.valor_mensal) || 0,
      data_vigencia: item.data_vigencia ?? null,
      data_revisao: item.data_revisao ?? null,
      etapa: item.etapa,
      observacoes: item.observacoes ?? null,
      dados_proposta: (item as any).dados_proposta ?? null,
    });
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Propostas em andamento até a implantação"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Importar planilha
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> Nova proposta
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Total em pipeline</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(totalGeral)}</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Propostas ativas</div>
            <div className="text-lg font-semibold tabular-nums">{items.length}</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-warning/15 text-warning flex items-center justify-center">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Para revisar hoje</div>
              <div className="text-lg font-semibold tabular-nums">{revisarHoje}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="only-revisar" checked={onlyRevisar} onCheckedChange={setOnlyRevisar} />
            <Label htmlFor="only-revisar" className="text-xs cursor-pointer">Filtrar</Label>
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ETAPAS.map((etapa) => (
            <PipelineColumn
              key={etapa}
              etapa={etapa}
              items={grouped[etapa]}
              accentClass={ETAPA_ACCENT[etapa]}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </DndContext>

      <PipelineForm open={formOpen} onOpenChange={setFormOpen} initial={editing} onSaved={load} />

      <PipelineImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={load} />

      <ContratoForm
        open={promoteOpen}
        onOpenChange={(v) => {
          setPromoteOpen(v);
          if (!v) {
            // Cancelled — keep card in pipeline
            setPromoting(null);
            setPromoteInitial(null);
          }
        }}
        initial={promoteInitial}
        onSaved={onContratoSaved}
      />
    </div>
  );
}