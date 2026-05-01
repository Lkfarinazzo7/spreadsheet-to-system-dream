import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Pencil, Trash2, Building2, Megaphone, CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PipelineItem = {
  id: string;
  cliente: string;
  numero_proposta?: string | null;
  tipo: string;
  valor_mensal: number;
  data_vigencia?: string | null;
  observacoes?: string | null;
  etapa: string;
  operadora?: { nome: string } | null;
  canal?: { nome: string } | null;
  dados_proposta?: { vidas?: number } | null;
};

export function PipelineCard({
  item,
  onEdit,
  onDelete,
}: {
  item: PipelineItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { etapa: item.etapa },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`group p-3 mb-2 rounded-xl cursor-grab active:cursor-grabbing select-none border-border/60 shadow-sm hover:shadow-md hover:border-border transition-all ${
        isDragging ? "ring-2 ring-primary/40 shadow-lg rotate-1" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate leading-tight">{item.cliente}</div>
          {item.numero_proposta && (
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">#{item.numero_proposta}</div>
          )}
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px] font-medium">{item.tipo}</Badge>
      </div>

      <div className="mt-2.5 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
        {item.operadora?.nome && (
          <div className="flex items-center gap-1.5 truncate">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.operadora.nome}</span>
          </div>
        )}
        {item.canal?.nome && (
          <div className="flex items-center gap-1.5 truncate">
            <Megaphone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.canal.nome}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          {item.data_vigencia && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{formatDate(item.data_vigencia)}</span>
            </div>
          )}
          {item.dados_proposta?.vidas != null && item.dados_proposta.vidas > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>{item.dados_proposta.vidas}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
        <span className="text-base font-semibold tabular-nums">
          {formatCurrency(item.valor_mensal)}
        </span>
        <div
          className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}