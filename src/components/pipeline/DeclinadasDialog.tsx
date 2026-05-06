import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { RotateCcw, Trash2, Ban } from "lucide-react";

type Item = {
  id: string;
  cliente: string;
  numero_proposta: string | null;
  valor_mensal: number;
  motivo_declinio: string | null;
  declinada_em: string | null;
  etapa: string;
  operadora?: { nome: string } | null;
};

export function DeclinadasDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pipeline_contratos")
      .select("id, cliente, numero_proposta, valor_mensal, motivo_declinio, declinada_em, etapa, operadora:operadoras(nome)")
      .eq("declinada", true)
      .order("declinada_em", { ascending: false });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setItems((data as any) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const reativar = async (id: string) => {
    const { error } = await supabase
      .from("pipeline_contratos")
      .update({ declinada: false, motivo_declinio: null, declinada_em: null } as any)
      .eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Proposta reativada" });
    load();
    onChanged();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir definitivamente esta proposta?")) return;
    const { error } = await supabase.from("pipeline_contratos").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Proposta excluída" });
    load();
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            Propostas declinadas
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhuma proposta declinada.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="rounded-lg border border-border/60 p-3 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{it.cliente}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                      {it.numero_proposta && <span className="font-mono">#{it.numero_proposta}</span>}
                      {it.operadora?.nome && <span>{it.operadora.nome}</span>}
                      <span>Estava em: {it.etapa}</span>
                      <span className="tabular-nums">{formatCurrency(it.valor_mensal)}</span>
                      {it.declinada_em && <span>Declinada {formatDate(it.declinada_em.slice(0, 10))}</span>}
                    </div>
                    {it.motivo_declinio && (
                      <div className="mt-1.5 text-xs bg-muted/40 border border-border/40 rounded px-2 py-1">
                        <span className="font-medium">Motivo:</span> {it.motivo_declinio}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => reativar(it.id)} title="Reativar">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => excluir(it.id)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}