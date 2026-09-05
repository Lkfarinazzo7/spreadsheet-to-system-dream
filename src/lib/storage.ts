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

/**
 * Move todos os arquivos de um prefixo para outro de forma tolerante a falhas:
 * 1) tenta `move`; 2) se o destino já existir, considera concluído;
 * 3) tenta novamente uma vez; 4) por fim tenta `copy` + `remove`.
 * Pode ser chamada quantas vezes for preciso (idempotente).
 */
export async function movePrefixFiles(
  oldPrefix: string,
  newPrefix: string,
): Promise<{ moved: number; failed: string[] }> {
  const files = await listAllStorageFiles(oldPrefix);
  const bucket = supabase.storage.from("pipeline-anexos");
  const existing = new Set(
    (await listAllStorageFiles(newPrefix).catch(() => [])).map((f) => f.name),
  );

  let moved = 0;
  const failed: string[] = [];

  for (const f of files) {
    const from = `${oldPrefix}/${f.name}`;
    const to = `${newPrefix}/${f.name}`;

    if (existing.has(f.name)) {
      // Já existe no destino: apenas limpa a origem.
      const { error } = await bucket.remove([from]);
      if (error) failed.push(f.name);
      else moved++;
      continue;
    }

    let { error } = await bucket.move(from, to);
    if (error) ({ error } = await bucket.move(from, to)); // segunda tentativa

    if (error) {
      const { error: copyErr } = await bucket.copy(from, to);
      if (copyErr) {
        failed.push(f.name);
        continue;
      }
      const { error: rmErr } = await bucket.remove([from]);
      if (rmErr) {
        failed.push(f.name);
        continue;
      }
    }
    moved++;
  }

  return { moved, failed };
}

