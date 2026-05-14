import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Upload, Download, Trash2, FileText, FileSpreadsheet,
  FileImage, File as FileIcon, Paperclip, ExternalLink, Archive,
} from "lucide-react";
import JSZip from "jszip";

type AnexoFile = {
  name: string;
  fullPath: string;
  size: number;
  updated_at?: string;
};

function iconFor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return FileText;
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return FileImage;
  return FileIcon;
}

function kindOf(name: string): "pdf" | "image" | "other" {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "image";
  return "other";
}

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanName(n: string) {
  return n.replace(/^\d+-/, "");
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  const [zipping, setZipping] = useState(false);
  const [viewer, setViewer] = useState<{ file: AnexoFile; url: string } | null>(null);

  const prefix = basePrefix ?? (user && pipelineId ? `${user.id}/${pipelineId}` : "");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.storage
      .from("pipeline-anexos")
      .list(prefix, { limit: 100, sortBy: { column: "updated_at", order: "desc" } });
    setLoading(false);
    if (error) { console.error(error); return; }
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

  const openViewer = async (f: AnexoFile) => {
    const { data, error } = await supabase.storage
      .from("pipeline-anexos")
      .createSignedUrl(f.fullPath, 600);
    if (error || !data) {
      toast({ title: "Erro ao gerar link", variant: "destructive" });
      return;
    }
    setViewer({ file: f, url: data.signedUrl });
  };

  const downloadOne = async (f: AnexoFile) => {
    const { data, error } = await supabase.storage.from("pipeline-anexos").download(f.fullPath);
    if (error || !data) {
      toast({ title: "Erro ao baixar", variant: "destructive" });
      return;
    }
    await downloadBlob(data, cleanName(f.name));
  };

  const downloadAll = async () => {
    setZipping(true);
    try {
      const zip = new JSZip();
      for (const f of files) {
        const { data, error } = await supabase.storage.from("pipeline-anexos").download(f.fullPath);
        if (error || !data) continue;
        zip.file(cleanName(f.name), data);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      await downloadBlob(blob, "anexos.zip");
    } finally {
      setZipping(false);
    }
  };

  const remove = async (f: AnexoFile) => {
    if (!confirm(`Excluir "${cleanName(f.name)}"?`)) return;
    const { error } = await supabase.storage.from("pipeline-anexos").remove([f.fullPath]);
    if (error) { toast({ title: "Erro ao excluir", variant: "destructive" }); return; }
    setFiles((p) => p.filter((x) => x.fullPath !== f.fullPath));
  };

  const viewerKind = viewer ? kindOf(viewer.file.name) : "other";

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4" />
          Anexos {files.length > 0 && <span className="text-muted-foreground">({files.length})</span>}
        </div>
        <div className="flex items-center gap-2">
          {files.length > 1 && (
            <Button size="sm" variant="outline" onClick={downloadAll} disabled={zipping}>
              {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Baixar todos
            </Button>
          )}
          <label>
            <input type="file" multiple className="hidden" onChange={onUpload} disabled={uploading} />
            <Button asChild size="sm" variant="outline" disabled={uploading}>
              <span className="cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Enviando..." : "Adicionar"}
              </span>
            </Button>
          </label>
        </div>
      </div>
      <div className="p-2">
        {loading && <div className="text-xs text-muted-foreground py-4 text-center">Carregando…</div>}
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
                  onClick={() => openViewer(f)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  title="Visualizar"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate flex items-center gap-1">
                      {cleanName(f.name)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{formatSize(f.size)}</div>
                  </div>
                </button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadOne(f)} title="Baixar">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(f)} title="Excluir">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog open={!!viewer} onOpenChange={(v) => !v && setViewer(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[88vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-4 py-2 border-b flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm truncate pr-2">
              {viewer ? cleanName(viewer.file.name) : ""}
            </DialogTitle>
            {viewer && (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => downloadOne(viewer.file)}>
                  <Download className="h-4 w-4" /> Baixar
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(viewer.url, "_blank")}>
                  <ExternalLink className="h-4 w-4" /> Nova aba
                </Button>
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 bg-muted overflow-hidden">
            {viewer && viewerKind === "pdf" && (
              <iframe src={viewer.url} className="w-full h-full" title={viewer.file.name} />
            )}
            {viewer && viewerKind === "image" && (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                <img src={viewer.url} alt={viewer.file.name} className="max-w-full max-h-full object-contain" />
              </div>
            )}
            {viewer && viewerKind === "other" && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                <FileIcon className="h-12 w-12 text-muted-foreground" />
                <div className="text-sm text-muted-foreground max-w-md">
                  Pré-visualização não disponível para este formato. Use os botões acima para baixar ou abrir em nova aba.
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
