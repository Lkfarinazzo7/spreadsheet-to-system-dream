## Causa do erro "Cannot read properties of undefined (reading 'rest')"

Confirmado no código e no banco:

- `ContratoForm.tsx` chama duas RPCs — `implantar_pipeline_com_contrato` e `save_contrato_com_comissoes` — usando um cast que **desliga o `this` do cliente**:
  ```ts
  const rpc = supabase.rpc as unknown as (fn, args) => Promise<...>;
  await rpc("implantar_pipeline_com_contrato", {...});
  ```
  Como `supabase.rpc` é um método que internamente usa `this.rest`, chamá-lo desatrelado gera exatamente o erro do print (`reading 'rest'`).
- Além disso, essas duas funções **não existem no banco** (`pg_proc` só tem `handle_new_user` e `set_updated_at`). Mesmo corrigindo o `this`, a chamada falharia.
- A coluna `contrato_id` referenciada em `Pipeline.tsx` (`handlePromote` e `PipelineItem`) também **não existe** em `pipeline_contratos`, então esse ramo é código morto que também precisa ser removido para não confundir.

## O que fazer

### 1. Corrigir o salvamento do contrato (elimina o erro do print)

Trocar as chamadas RPC inexistentes por operações diretas na tabela, feitas em sequência dentro do `submit` do `ContratoForm`:

- `contratos`: `insert` (novo) ou `update` (existente) com `select().single()` para obter o `id`.
- `comissoes`: para cada linha, `upsert` (usa `id` quando existe); para `removedComissoes`, `delete().in("id", ...)`.
- Se `pipelineId` estiver presente e o `insert` de contrato + comissoes foi bem-sucedido, deletar a linha do pipeline (`pipeline_contratos.delete().eq("id", pipelineId)`).

Isso replica o comportamento das RPCs que existiam antes desta regressão, sem depender de funções que não estão no banco e sem o cast que quebra o `this`.

### 2. Garantir que Operadora e Canal cheguem preenchidos ao promover

- `Pipeline.tsx > handlePromote`: remover o bloco que busca `item.contrato_id` (coluna inexistente). Manter apenas o mapeamento `operadora_id` / `canal_id` a partir do `PipelineItem`, que já vêm corretos do banco.
- `ContratoForm.tsx > Selects de Operadora/Canal`: hoje já esperam `lookupsLoaded`. Adicionar fallback: se o `initial.operadora_id` / `canal_id` não estiver na lista carregada (operadora inativa), fazer um `select` pontual e injetar na lista, para o valor sempre aparecer selecionado.
- Remover `contrato_id` do tipo `PipelineItem` (código morto).

### 3. Pré-preencher comissões por operadora

Criar um mapa nome-da-operadora → parcelas percentuais em `src/lib/comissoesPresets.ts`:

```ts
export const COMISSAO_PRESETS: Record<string, number[]> = {
  "amil": [100, 100, 80],
  "assim saude": [100, 100, 80],
  "sulamerica": [100, 100, 80],
  "porto seguro": [100, 100, 80],
  "klini saude": [100, 100, 80],
  "bradesco": [100, 100, 100, 50],
  "leve saude": [100, 80],
  "medsenior": [100, 70],
  "prevent senior": [100, 40, 40],
};
```
- Chave normalizada (lowercase, sem acentos) para casar independente de grafia.
- Função `presetComissoes(operadoraNome, valorMensal)` retorna `ComissaoLine[]` com `tipo: "Bancaria"`, `parcela` sequencial, `percentual`, `valor = round(valorMensal * pct / 100, 2)`, `mes_previsto = hoje`.

Aplicar em duas situações no `ContratoForm`:

- **Ao promover / abrir novo contrato**: se `!form.id` e `form.operadora_id` já vem preenchido do pipeline, ao terminar de carregar os lookups substituir as `comissoes` padrão (as 3 linhas em branco geradas por `defaultComissoes()`) pelas do preset. Só substituir se o usuário ainda não editou (todas as linhas sem `id`, `valor === 0`, `percentual == null`) — assim não sobrescreve edições.
- **Ao trocar a operadora no Select** (novo contrato): mesmo critério — se a lista atual está "intocada" (default), regenera pelo preset. Se o usuário já mexeu, não mexe (evita perder trabalho).

Se a operadora não estiver no mapa, mantém o comportamento atual (3 linhas em branco).

## Arquivos afetados

- `src/components/contratos/ContratoForm.tsx` — troca das RPCs por operações diretas, fallback de lookup, aplicação do preset.
- `src/pages/app/Pipeline.tsx` — remover ramo `item.contrato_id`.
- `src/components/pipeline/PipelineCard.tsx` — remover campo `contrato_id` do tipo.
- `src/lib/comissoesPresets.ts` — novo arquivo com o mapa e helper.

Sem migração de banco — o problema não é de schema; é de código chamando RPCs inexistentes.
