import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 100;

export type StorageFile = {
  name: string;
  id?: string | null;
  metadata?: { size?: number } | null;
  updated_at?: string | null;
};

/** Lista todos os arquivos diretos de um prefixo, sem truncar nos primeiros 100. */
export async function listAllStorageFiles(prefix: string): Promise<StorageFile[]> {
  const files: StorageFile[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from("pipeline-anexos")
      .list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "updated_at", order: "desc" },
      });

    if (error) throw error;
    const page = (data ?? []) as StorageFile[];
    files.push(...page.filter((file) => file.id));
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return files;
}

/** Remove todo o conteúdo direto de um prefixo e falha de forma explícita. */
export async function removeStoragePrefix(prefix: string): Promise<void> {
  const files = await listAllStorageFiles(prefix);
  if (!files.length) return;

  // O Storage aceita remoção em lote; grupos menores evitam payloads excessivos.
  for (let i = 0; i < files.length; i += 100) {
    const paths = files.slice(i, i + 100).map((file) => `${prefix}/${file.name}`);
    const { error } = await supabase.storage.from("pipeline-anexos").remove(paths);
    if (error) throw error;
  }
}
