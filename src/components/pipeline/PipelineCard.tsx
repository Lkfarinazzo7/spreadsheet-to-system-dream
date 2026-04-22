import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Pencil, Trash2 } from "lucide-react";
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
      className={`p-3 mb-2 cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-50 shadow-lg" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{item.cliente}</div>
          {item.numero_proposta && (
            <div className="text-xs text-muted-foreground">#{item.numero_proposta}</div>
          )}
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">{item.tipo}</Badge>
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {item.operadora?.nome && <div>🏥 {item.operadora.nome}</div>}
        {item.canal?.nome && <div>📍 {item.canal.nome}</div>}
        {item.data_vigencia && <div>📅 {formatDate(item.data_vigencia)}</div>}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold tabular-nums">
          {formatCurrency(item.valor_mensal)}
        </span>
        <div className="flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
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