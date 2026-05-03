import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Download, Trash2, FileText, FileSpreadsheet, FileImage, File as FileIcon, Paperclip, ExternalLink } from "lucide-react";

type AnexoFile = {
  name: string;
  fullPath: string;
  size: number;
  updated_at?: string;
};

function iconFor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return FileText;
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return FileImage;
  return FileIcon;
}

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PipelineAnexos({
  pipelineId,
  basePrefix,
}: {
  pipelineId?: string;
  basePrefix?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<AnexoFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const prefix = basePrefix ?? (user && pipelineId ? `${user.id}/${pipelineId}` : "");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.storage
      .from("pipeline-anexos")
      .list(prefix, { limit: 100, sortBy: { column: "updated_at", order: "desc" } });
    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    setFiles(
      (data ?? []).map((f) => ({
        name: f.name,
        fullPath: `${prefix}/${f.name}`,
        size: (f as any).metadata?.size ?? 0,
        updated_at: (f as any).updated_at,
      })),
    );
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix, user?.id]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || !list.length || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${prefix}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage.from("pipeline-anexos").upload(path, file);
        if (error) throw error;
      }
      toast({ title: "Arquivos enviados" });
      await load();
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openFile = async (f: AnexoFile) => {
    const { data, error } = await supabase.storage
      .from("pipeline-anexos")
      .createSignedUrl(f.fullPath, 60);
    if (error || !data) {
      toast({ title: "Erro ao gerar link", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (f: AnexoFile) => {
    if (!confirm(`Excluir "${f.name}"?`)) return;
    const { error } = await supabase.storage.from("pipeline-anexos").remove([f.fullPath]);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
      return;
    }
    setFiles((p) => p.filter((x) => x.fullPath !== f.fullPath));
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4" />
          Anexos {files.length > 0 && <span className="text-muted-foreground">({files.length})</span>}
        </div>
        <label>
          <input type="file" multiple className="hidden" onChange={onUpload} disabled={uploading} />
          <Button asChild size="sm" variant="outline" disabled={uploading}>
            <span className="cursor-pointer">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Enviando..." : "Adicionar arquivos"}
            </span>
          </Button>
        </label>
      </div>
      <div className="p-2">
        {loading && (
          <div className="text-xs text-muted-foreground py-4 text-center">Carregando…</div>
        )}
        {!loading && files.length === 0 && (
          <div className="text-xs text-muted-foreground py-6 text-center">
            Nenhum arquivo. Envie contratos, PDFs, planilhas ou imagens.
          </div>
        )}
        <ul className="divide-y">
          {files.map((f) => {
            const Icon = iconFor(f.name);
            return (
              <li key={f.fullPath} className="flex items-center gap-2 py-2 px-1 hover:bg-muted/40 rounded transition-colors">
                <button
                  type="button"
                  onClick={() => openFile(f)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  title="Abrir arquivo"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate group-hover:text-primary flex items-center gap-1">
                      {f.name.replace(/^\d+-/, "")}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </div>
                    <div className="text-[11px] text-muted-foreground">{formatSize(f.size)}</div>
                  </div>
                </button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(f)} title="Excluir">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}