import { useDroppable } from "@dnd-kit/core";
import { PipelineCard, PipelineItem } from "./PipelineCard";

export function PipelineColumn({
  etapa,
  items,
  onEdit,
  onDelete,
}: {
  etapa: string;
  items: PipelineItem[];
  onEdit: (item: PipelineItem) => void;
  onDelete: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: etapa });

  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="px-2 py-2 mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{etapa}</h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-md p-2 transition-colors ${
          isOver ? "bg-accent/50 ring-2 ring-primary/30" : "bg-muted/30"
        }`}
      >
        {items.map((item) => (
          <PipelineCard
            key={item.id}
            item={item}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item.id)}
          />
        ))}
        {items.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-6">Vazio</div>
        )}
      </div>
    </div>
  );
}