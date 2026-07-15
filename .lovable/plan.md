# Correções no fluxo Pipeline → Contrato e no drag do pipeline

## Problemas observados

1. **Ao arrastar um cartão para "Implantado"**, o formulário de Contrato às vezes abre com **Operadora e Canal em branco**, mesmo quando o cartão do pipeline tinha esses dados.
2. Depois de salvar, o contrato às vezes fica sem operadora/canal salvos.
3. **Arrastar cartões entre etapas está "bugado"** — cartão volta pra origem, cai na coluna errada, ou fica em posição estranha depois do drop.

## Causa raiz

### 1. Operadora/Canal sumindo no "Implantar"
- Em `Pipeline.tsx > handlePromote`, os IDs são copiados corretamente para `promoteInitial`.
- Mas em `ContratoForm`, o `<Select>` renderiza **vazio** quando o `value` (uuid) não bate com nenhum `<SelectItem>` na lista — e as listas `operadoras`/`canais` são carregadas **depois** que o dialog abre (efeito separado, assíncrono).
- Além disso, `operadoras`/`canais` são carregados com filtro `.eq("ativo", true)`. Se a operadora do cartão estiver inativa, ela nunca aparece no Select — visualmente parece "não puxou".
- Também há uma condição de corrida: se o usuário abre o Select antes das listas carregarem, pode acabar salvando sem valor.

### 2. Drag "bugadinho"
- `handleDragEnd` só atualiza `etapa` no banco — nunca atualiza `posicao`. Ao recarregar (`.order("posicao")`), o cartão volta a uma posição antiga da coluna, dando sensação de "pulou de volta".
- O `useMemo grouped` reordena cartões urgentes primeiro dentro do estado local. Combinado com o reload assíncrono, cria "saltos" visuais.
- `activationConstraint: { distance: 5 }` é muito próximo do clique — em cliques com leve movimento o dnd inicia drag e o item some brevemente.

## Plano de correção

### A. `src/components/contratos/ContratoForm.tsx`
- Carregar `operadoras`/`canais` **sem** o filtro `ativo=true` quando existe um id inicial que não está na lista ativa (fallback: buscar as listas completas se o id do initial não existir). Alternativa mais simples: sempre buscar todas e desabilitar visualmente as inativas.
- Enquanto as listas estiverem carregando, mostrar o `SelectTrigger` em estado "carregando" (skeleton/disabled) em vez de placeholder "Selecione", para o usuário não achar que está vazio nem tentar alterar antes do carregamento.
- Se o `initial.operadora_id`/`canal_id` não vier em nenhuma das linhas retornadas, injetar uma linha "fantasma" com o nome recuperado via query dedicada (`operadoras.select("id,nome").eq("id", ...)`) para o Select conseguir exibir o valor selecionado.
- Ajustar o efeito de reset (`[initial, open]`) para só zerar quando `open` passar de `false → true`, evitando reset acidental durante re-renders.

### B. `src/pages/app/Pipeline.tsx > handlePromote`
- Antes de abrir o `ContratoForm`, pré-buscar (ou pegar do estado já carregado) o **nome** da operadora e do canal do cartão e passar junto no `promoteInitial` (novos campos opcionais consumidos pelo fallback do ContratoForm).
- Manter `numero_proposta`, `dados_proposta`, `observacoes` como já estão.

### C. Drag & drop no pipeline (`Pipeline.tsx`)
- Ajustar `PointerSensor` para `{ distance: 8 }` (menos falsos-positivos entre clique e drag) e adicionar um `TouchSensor` com `{ delay: 120, tolerance: 6 }` para mobile.
- Após mudar de etapa, calcular uma nova `posicao` (por exemplo `max(posicao) + 1` na coluna de destino) e persistir junto com `etapa`. Assim o cartão fica na posição correta após o reload e não "pula".
- Depois da atualização, atualizar `posicao` no estado local também, evitando re-sort visual.
- Remover a re-ordenação por urgência dentro de `grouped` (ou movê-la para um filtro separado), para preservar a ordem manual do usuário; se quiser destaque de urgência, manter apenas o realce visual (já existe via `ring-warning`).

### D. Verificação
- Após implementar: abrir um cartão com operadora inativa e arrastar para "Implantado" — Select deve mostrar o nome.
- Arrastar cartão entre 3 etapas seguidas — deve permanecer no lugar onde foi solto após o reload.
- Clique simples no cartão continua abrindo o editor (sem virar drag).

## Fora de escopo
- Reordenação por drag **dentro** da mesma coluna (não solicitada; hoje não existe e não faz parte do bug).
- Alterações no schema do banco.