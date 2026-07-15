import { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
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
import { DeclinadasDialog } from "@/components/pipeline/DeclinadasDialog";
import { formatCurrency, localIso } from "@/lib/format";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Ban } from "lucide-react";

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
  const [declinadasOpen, setDeclinadasOpen] = useState(false);
  const [declinadasCount, setDeclinadasCount] = useState(0);

  // Promote modal (open ContratoForm with prefilled data)
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoting, setPromoting] = useState<PipelineItem | null>(null);
  const [promoteInitial, setPromoteInitial] = useState<ContratoFormValues | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  );

  const load = async () => {
    const { data, error } = await supabase
      .from("pipeline_contratos")
      .select("*, operadora:operadoras(nome), canal:canais_venda(nome)")
      .neq("etapa", "Implantado")
      .eq("declinada", false)
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
    // count declinadas
    const { count } = await supabase
      .from("pipeline_contratos")
      .select("id", { count: "exact", head: true })
      .eq("declinada", true);
    setDeclinadasCount(count ?? 0);
  };

  useEffect(() => {
    document.title = "Pipeline — Corretor SaaS";
    load();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, PipelineItem[]> = {};
    for (const e of ETAPAS) map[e] = [];
    const today = localIso();
    const filtered = onlyRevisar
      ? items.filter((i) => i.data_revisao && i.data_revisao <= today)
      : items;
    for (const it of filtered) {
      if (map[it.etapa]) map[it.etapa].push(it);
    }
    // Preserva a ordem retornada pelo banco (posicao). Urgência é destacada
    // visualmente no cartão — não reordenamos aqui para não "pular" após o drop.
    return map;
  }, [items, onlyRevisar]);

  const totalGeral = useMemo(() => items.reduce((s, i) => s + Number(i.valor_mensal || 0), 0), [items]);
  const today = localIso();
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
      dados_proposta: (item as any).dados_proposta ?? null,
    });
    setPromoteOpen(true);
  };

  const onContratoSaved = async (contratoId?: string) => {
    if (!promoting) return;
    // Move os anexos do pipeline para a pasta de contratos. Se QUALQUER movimentação
    // falhar, o cartão é mantido no pipeline para nova tentativa — nunca perdemos anexo.
    let falhasMover = 0;
    if (contratoId && user) {
      const oldPrefix = `${user.id}/${promoting.id}`;
      const newPrefix = `${user.id}/contratos/${contratoId}`;
      const { data: files, error: listError } = await supabase.storage
        .from("pipeline-anexos")
        .list(oldPrefix, { limit: 1000 });
      if (listError) {
        falhasMover = -1; // não foi possível nem listar
      } else {
        for (const f of files ?? []) {
          const { error: moveError } = await supabase.storage
            .from("pipeline-anexos")
            .move(`${oldPrefix}/${f.name}`, `${newPrefix}/${f.name}`);
          if (moveError) falhasMover++;
        }
      }
    }
    if (falhasMover !== 0) {
      toast({
        title: "Contrato criado, mas anexos não foram movidos",
        description:
          falhasMover === -1
            ? "Não foi possível listar os anexos. O cartão foi mantido no pipeline — tente implantar novamente ou mova os arquivos manualmente."
            : `${falhasMover} anexo(s) falharam ao mover. O cartão foi mantido no pipeline — tente novamente. Atenção: o contrato já existe em Contratos.`,
        variant: "destructive",
      });
      setPromoting(null);
      setPromoteInitial(null);
      load();
      return;
    }
    const { error: delError } = await supabase
      .from("pipeline_contratos")
      .delete()
      .eq("id", promoting.id);
    setPromoting(null);
    setPromoteInitial(null);
    if (delError) {
      toast({
        title: "Contrato criado, mas o cartão não foi removido do pipeline",
        description: delError.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Implantado!", description: "Cartão e anexos movidos para Contratos." });
    }
    load();
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

    // Nova posição: final da coluna de destino (max + 1) para o cartão ficar
    // exatamente onde foi solto após o reload ordenado por `posicao`.
    const posDestino =
      Math.max(
        0,
        ...items
          .filter((i) => i.etapa === newEtapa)
          .map((i) => Number((i as any).posicao ?? 0)),
      ) + 1;

    setItems((p) =>
      p.map((i) =>
        i.id === id ? { ...i, etapa: newEtapa, ...( { posicao: posDestino } as any) } : i,
      ),
    );
    const { error } = await supabase
      .from("pipeline_contratos")
      .update({ etapa: newEtapa as any, posicao: posDestino })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao mover", description: error.message, variant: "destructive" });
      load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta proposta do pipeline?")) return;
    // Remove os anexos do storage antes, para não deixar arquivos órfãos.
    if (user) {
      const prefix = `${user.id}/${id}`;
      const { data: files } = await supabase.storage
        .from("pipeline-anexos")
        .list(prefix, { limit: 1000 });
      if (files?.length) {
        await supabase.storage
          .from("pipeline-anexos")
          .remove(files.map((f) => `${prefix}/${f.name}`));
      }
    }
    const { error } = await supabase.from("pipeline_contratos").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
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
            <Button variant="outline" onClick={() => setDeclinadasOpen(true)}>
              <Ban className="h-4 w-4" /> Declinadas
              {declinadasCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-destructive/15 text-destructive text-[10px] font-semibold px-1.5 min-w-5 h-5">
                  {declinadasCount}
                </span>
              )}
            </Button>
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

      <DeclinadasDialog open={declinadasOpen} onOpenChange={setDeclinadasOpen} onChanged={load} />

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