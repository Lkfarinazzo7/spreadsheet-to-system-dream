export type QueryError = { message: string };

type PageResult<T> = {
  data: T[] | null;
  error: QueryError | null;
};

const PAGE_SIZE = 1000;

/**
 * Executa consultas PostgREST em páginas para não perder linhas quando o projeto
 * atingir o limite padrão de retorno do Supabase.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
