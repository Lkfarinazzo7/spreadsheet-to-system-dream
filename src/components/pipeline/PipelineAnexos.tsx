import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Loader2, Upload, Download, Trash2, FileText, FileSpreadsheet,
  FileImage, File as FileIcon, Paperclip, ExternalLink, Archive, ChevronLeft, ChevronRight,
} from "lucide-react";
import JSZip from "jszip";

import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

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

function mimeTypeFromName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "application/octet-stream";
}

function normalizeSignedUrl(url?: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/`).toString();
}

function openUrlInNewTab(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
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
  const [viewer, setViewer] = useState<{
    file: AnexoFile;
    url: string;
    downloadUrl: string;
    kind: "pdf" | "image" | "other";
    blob?: Blob;
  } | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);

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
    setViewerError(null);
    setViewerLoading(true);
    setPdfPage(1);
    setPdfPages(0);
    // Abre o dialog imediatamente com placeholder para feedback visual.
    setViewer({ file: f, url: "", downloadUrl: "", kind: kindOf(f.name) });
    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from("pipeline-anexos")
        .createSignedUrl(f.fullPath, 600);
      const signedUrl = normalizeSignedUrl(signed?.signedUrl ?? (signed as { signedURL?: string } | null)?.signedURL);
      if (signErr || !signedUrl) {
        throw new Error(signErr?.message || "Não foi possível gerar o link assinado do arquivo.");
      }
      const kind = kindOf(f.name);
      if (kind === "pdf" || kind === "image") {
        const { data: blob, error: dlErr } = await supabase.storage
          .from("pipeline-anexos")
          .download(f.fullPath);
        if (dlErr || !blob) {
          throw new Error(dlErr?.message || "Falha ao baixar o arquivo do storage.");
        }
        if (blob.size === 0) {
          throw new Error("Arquivo vazio ou corrompido (0 bytes).");
        }
        const typed = new Blob([blob], { type: mimeTypeFromName(f.name) });
        const blobUrl = URL.createObjectURL(typed);
        setViewer({ file: f, url: blobUrl, downloadUrl: signedUrl, kind, blob: typed });
      } else {
        setViewer({ file: f, url: signedUrl, downloadUrl: signedUrl, kind });
      }
    } catch (err: any) {
      console.error("[PipelineAnexos] openViewer error:", err);
      setViewerError(err?.message || "Erro desconhecido ao abrir o arquivo.");
    } finally {
      setViewerLoading(false);
    }
  };

  // Libera o blob URL quando o visualizador é fechado.
  useEffect(() => {
    return () => {
      if (viewer?.url.startsWith("blob:")) URL.revokeObjectURL(viewer.url);
    };
  }, [viewer?.url]);

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
  const pdfFile = useMemo(() => (viewerKind === "pdf" && viewer?.blob ? viewer.blob : undefined), [viewer?.blob, viewerKind]);

  const openViewerInNewTab = () => {
    if (!viewer) return;

    if (viewer.blob) {
      const objectUrl = URL.createObjectURL(viewer.blob);
      openUrlInNewTab(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return;
    }

    if (!viewer.downloadUrl) {
      setViewerError("Não foi possível gerar um link válido para abrir o arquivo em outra aba.");
      return;
    }

    openUrlInNewTab(viewer.downloadUrl);
  };

  const closeViewer = () => {
    setViewer(null);
    setViewerError(null);
    setViewerLoading(false);
    setPdfPages(0);
    setPdfPage(1);
  };

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

      <Dialog open={!!viewer} onOpenChange={(v) => !v && closeViewer()}>
        <DialogContent className="max-w-5xl w-[95vw] h-[88vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-4 py-2 border-b flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm truncate pr-2">
              {viewer ? cleanName(viewer.file.name) : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Visualização do anexo com opções para baixar ou abrir em outra aba.
            </DialogDescription>
            {viewer && (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => downloadOne(viewer.file)} disabled={viewerLoading}>
                  <Download className="h-4 w-4" /> Baixar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openViewerInNewTab}
                  disabled={viewerLoading || (!viewer.downloadUrl && !viewer.blob)}
                >
                  <ExternalLink className="h-4 w-4" /> Nova aba
                </Button>
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 bg-muted overflow-hidden">
            {viewer && viewerLoading && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <div className="text-sm">Carregando arquivo…</div>
              </div>
            )}
            {viewer && !viewerLoading && viewerError && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                <FileIcon className="h-12 w-12 text-destructive" />
                <div className="text-sm font-medium text-destructive">Não foi possível abrir o arquivo</div>
                <div className="text-xs text-muted-foreground max-w-md break-words">{viewerError}</div>
                <Button size="sm" variant="outline" onClick={() => openViewer(viewer.file)}>
                  Tentar novamente
                </Button>
              </div>
            )}
            {viewer && !viewerLoading && !viewerError && viewerKind === "pdf" && pdfFile && (
              <div className="w-full h-full flex flex-col">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-2 bg-background/80">
                  <div className="text-xs text-muted-foreground">
                    {pdfPages > 0 ? `Página ${pdfPage} de ${pdfPages}` : "Preparando PDF..."}
                  </div>
                  {pdfPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => setPdfPage((current) => Math.max(1, current - 1))}
                        disabled={pdfPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => setPdfPage((current) => Math.min(pdfPages, current + 1))}
                        disabled={pdfPage >= pdfPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <div className="mx-auto flex min-h-full w-fit items-start justify-center">
                    <Document
                      file={pdfFile}
                      loading={
                        <div className="flex min-h-[320px] items-center justify-center gap-3 text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-sm">Renderizando PDF…</span>
                        </div>
                      }
                      error={
                        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                          <FileText className="h-12 w-12 text-destructive" />
                          <div className="text-sm font-medium text-destructive">Não foi possível renderizar este PDF</div>
                          <div className="text-xs text-muted-foreground max-w-md">
                            O arquivo foi baixado, mas houve falha ao processar o preview dentro da plataforma.
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={openViewerInNewTab}>Abrir em nova aba</Button>
                            <Button size="sm" variant="outline" onClick={() => downloadOne(viewer.file)}>Baixar arquivo</Button>
                          </div>
                        </div>
                      }
                      onLoadSuccess={({ numPages }) => {
                        setPdfPages(numPages);
                        setPdfPage((current) => Math.min(current, numPages) || 1);
                      }}
                      onLoadError={(error) => {
                        console.error("[PipelineAnexos] pdf render error:", error);
                        setViewerError(`Falha ao processar o PDF para visualização: ${error.message}`);
                      }}
                    >
                      <Page
                        pageNumber={pdfPage}
                        width={900}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                        className="shadow-sm"
                      />
                    </Document>
                  </div>
                </div>
              </div>
            )}
            {viewer && !viewerLoading && !viewerError && viewerKind === "image" && viewer.url && (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                <img
                  src={viewer.url}
                  alt={viewer.file.name}
                  className="max-w-full max-h-full object-contain"
                  onError={() => setViewerError("Falha ao carregar a imagem.")}
                />
              </div>
            )}
            {viewer && !viewerLoading && !viewerError && viewerKind === "other" && (
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
