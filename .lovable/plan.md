
## Parte 1 — Corrigir erros de build (TypeScript)

Todos os erros são de **tipagem**, não de lógica em runtime. Nenhum comportamento muda.

### 1. `src/components/contratos/ContratoForm.tsx` (linhas 256, 265)
Os RPCs `implantar_pipeline_com_contrato` e `save_contrato_com_comissoes` existem no banco mas não estão no `src/integrations/supabase/types.ts` (arquivo auto-gerado, desatualizado). Fazer cast pontual `(supabase.rpc as any)("nome_rpc", { ... })` nas duas chamadas.

### 2. `src/pages/app/Contratos.tsx:35` e `src/pages/app/Pipeline.tsx:65`
`fetchAllPages<T>` espera `PageResult<T>` mas o retorno do Supabase tipa `dados_proposta` como `Json`, enquanto o tipo local (`ContratoRow` / `PipelineItem`) tipa como `DadosProposta` / `{vidas?: number}`. Solução: castar o query builder passado ao `fetchAllPages` como `any` na chamada, mantendo o generic `<ContratoRow>` / `<PipelineItem>` para o consumidor.

### 3. `src/components/ui/chart.tsx` (linhas 106, 111, 233, 240, 249)
Componente shadcn padrão desatualizado em relação ao recharts atual (props `payload`/`label` do `TooltipProps` mudaram). Corrigir tipando o `TooltipContent` como `React.ComponentProps<typeof RechartsPrimitive.Tooltip> & { ... }` com narrowing local, e o `LegendContent` recebendo `payload` via `any` (arquivo é de infra de UI, não regride comportamento).

### Verificação
Rodar o typecheck automático do harness após as edições; confirmar que os 8 erros somem sem introduzir novos.

---

## Parte 2 — Relatório de auditoria (resumo dos achados)

A auditoria completa foi concluída. Principais destaques (impacto alto/médio):

### 🐞 Bugs
1. **Pipeline drag race condition** — `Pipeline.tsx` calcula `posicao` do card via `Math.max` sobre estado local, dois drags rápidos podem gerar posições duplicadas. Ideal: RPC transacional para pegar `max(posicao)+1` no servidor.
2. **`useAuth` pode travar em "carregando"** — `getSession()` sem `.catch()`; se rede falhar, `loading=true` para sempre.
3. **PipelineForm filtra operadora/canal só ativos** — ao editar proposta cuja operadora foi desativada, o `<Select>` fica vazio. `ContratoForm` já resolve isso (traz todos); replicar no PipelineForm.
4. **Falta `UNIQUE (contrato_id, tipo, parcela)`** em `comissoes` — a validação client-side pode ser burlada em edições concorrentes.

### 🎨 UX
5. **`window.confirm()` e `window.prompt()` nativos** espalhados em Pipeline, Contratos, Despesas, Cadastros, Comissões — quebram identidade visual e acessibilidade. Substituir por `AlertDialog` + `DatePicker` do shadcn.
6. **KPI "Ticket médio" do Dashboard** mistura janelas temporais (receita histórica ÷ contratos do período) — renomear/esclarecer o rótulo.

### ⚡ Performance
7. **Dashboard e Relatórios baixam a tabela inteira de `comissoes`/`contratos`** e filtram por período no client. Aplicar `.gte()/.lte()` no servidor.
8. **Download em lote de anexos é serial** (`PipelineAnexos`) — usar `Promise.all` com concorrência limitada.

### 🔒 Segurança
- RLS bem implementada em todas as tabelas e no bucket `pipeline-anexos` ✅
- RPCs `SECURITY INVOKER` com checagem explícita de `user_id` ✅
- Edge function `pipeline-parse` com auth + quota + schema JSON estrito ✅
- Nenhum problema crítico encontrado.

### 🧹 Code smells
- **Duplicação quase total** entre `elaboracaoEmail.ts` e `antecipacaoEmail.ts` (blocos titulares/dependentes idênticos) — extrair helper compartilhado.
- **`(item as any)` espalhados** em `Pipeline.tsx` — sintoma de `types.ts` desatualizado (mesma raiz dos erros de build acima).
- **`ContratoForm`/`PipelineForm` com ~500-870 linhas** — quebrar em subcomponentes (`TitularesEditor`).

### 💡 Sugestões de incrementos (por domínio)
1. **Alertas de reajuste** próximos para contratos ativos (hoje só existe "revisão" no pipeline).
2. **Geração automática de parcelas de comissão** recorrentes a partir de uma regra no contrato.
3. **Relatório de idade média/faixas etárias da carteira** usando `titulares`/`dependentes` de `dados_proposta`.
4. **Funil de conversão do pipeline** (taxa por etapa, tempo médio em cada etapa).
5. **Metas mensais de vendas/comissão** com acompanhamento visual no Dashboard.
6. **Conciliação de repasse por operadora** (previsto × recebido, linha a linha).
7. **Multiusuário/corretora** (schema hoje é 100% single-user via `user_id`, sem `organization_id`).
8. **Assinatura eletrônica** integrada à etapa "Assinatura / Declaração de saúde".
9. **Campanhas de aniversário de vigência** para renovação/upsell.

---

## Próximos passos

Ao aprovar este plano, eu:
1. Executo somente a **Parte 1** (correção dos 8 erros de build).
2. Depois te devolvo o controle para você escolher **quais itens da Parte 2** priorizar — cada um vira um plano próprio.
