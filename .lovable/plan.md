# Fix: proposta criada não aparece no Kanban

## Causa raiz (confirmada nos logs)
- O **POST** para `pipeline_contratos` retorna **201** (proposta gravada com sucesso no banco).
- Logo em seguida, o `load()` do `Pipeline.tsx` faz:
  ```
  GET pipeline_contratos?select=*,operadora:operadoras(nome),canal:canais_venda(nome)
  ```
  e recebe **400** com a mensagem:
  > "Could not find a relationship between 'pipeline_contratos' and 'operadoras' in the schema cache"
- Verifiquei direto no banco: `pipeline_contratos` **não tem nenhuma foreign key**, enquanto `contratos` tem as 4 FKs corretas (`operadora_id`, `canal_id`, `categoria_id`, `user_id`).
- Sem as FKs, o PostgREST não consegue fazer o embed `operadora:operadoras(nome)` e quebra a query inteira → o estado do React fica vazio → o card "some" mesmo tendo sido salvo.

## Correção

### 1. Migration: adicionar foreign keys em `pipeline_contratos`
```sql
ALTER TABLE public.pipeline_contratos
  ADD CONSTRAINT pipeline_contratos_operadora_id_fkey
  FOREIGN KEY (operadora_id) REFERENCES public.operadoras(id) ON DELETE SET NULL;

ALTER TABLE public.pipeline_contratos
  ADD CONSTRAINT pipeline_contratos_canal_id_fkey
  FOREIGN KEY (canal_id) REFERENCES public.canais_venda(id) ON DELETE SET NULL;

ALTER TABLE public.pipeline_contratos
  ADD CONSTRAINT pipeline_contratos_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

Com isso o PostgREST passa a reconhecer os relacionamentos e a query do `load()` volta a devolver 200, trazendo `operadora.nome` e `canal.nome` aninhados como o card espera.

### 2. Pequena melhoria de robustez (opcional, mesmo arquivo)
Em `src/pages/app/Pipeline.tsx`, adicionar tratamento de erro no `load()` para que, se algo falhar no futuro, o usuário veja um toast em vez de a tela ficar silenciosamente vazia:
```ts
const { data, error } = await supabase.from("pipeline_contratos")...
if (error) toast({ title: "Erro ao carregar pipeline", description: error.message, variant: "destructive" });
```

## Arquivos afetados
- **Nova migration** em `supabase/migrations/` (3 ALTER TABLE acima).
- `src/pages/app/Pipeline.tsx` — adicionar `error` no destruct e toast.

## Validação após aplicar
1. Abrir `/app/pipeline`.
2. Criar uma nova proposta.
3. Card deve aparecer imediatamente na coluna "Montagem de contrato" (sem precisar recarregar a página).
4. Network tab: `GET pipeline_contratos?select=...` deve retornar **200** com `operadora` e `canal` populados.
