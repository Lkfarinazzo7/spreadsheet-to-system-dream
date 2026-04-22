
# Ajustes nos Contratos + novo Pipeline (Kanban)

## 1. Ajustes no formulário de contrato
- **Remover** o campo "Categoria do plano" do formulário e da listagem.
- **Proporção de comissão** deixa de ser digitada: vira **calculada automaticamente** = `soma das comissões cadastradas ÷ valor mensal`. Exibida como campo somente-leitura ("3.80x") que se atualiza ao adicionar/editar parcelas.
- **Mês de reajuste**: novo campo de data. Quando preencher "Data de vigência", auto-preenche reajuste com **mesmo dia/mês do ano seguinte**, mas permite edição manual.
- **Comissões embutidas no formulário**: dentro do mesmo modal de contrato, uma seção "Comissões deste contrato" com mini-tabela onde você adiciona linhas: **tipo** (Bancária / Bonificação por Vida / Adesão), **parcela**, **valor**, **data prevista de recebimento** e **data efetiva de recebimento** (quando preenchida, marca como pago automaticamente). Botões "+ Adicionar comissão" e remover por linha. Salvas junto com o contrato.

## 2. Novo módulo: Pipeline de Contratos (Kanban)
Nova aba no menu lateral chamada **"Pipeline"** (entre Contratos e Comissões), com visão Kanban arrastável das propostas ainda não implantadas.

**Etapas (colunas):**
1. Montagem de contrato
2. Enviado para assinatura
3. Preenchimento da declaração de saúde
4. Entrevista médica
5. Em análise
6. Pendências
7. Aguardando vigência
8. Implantado

**Cartão do pipeline** contém: cliente, operadora, tipo (PF/PJ/Adesão), valor mensal estimado, canal, data prevista de vigência, observação curta. Drag-and-drop entre colunas atualiza o status. Botão "+ Nova proposta" abre formulário enxuto.

**Conversão automática para Contrato:**
- Ao mover um cartão para **"Implantado"** (ou alterar o status para Implantado), o sistema:
  1. Cria/atualiza o registro em **Contratos** com status "Ativo".
  2. Calcula automaticamente o mês de reajuste (1 ano após vigência).
  3. Se faltar alguma informação obrigatória (operadora, valor mensal, data de vigência, comissões), abre um modal pedindo para completar antes de finalizar a implantação. O cartão só sai do Kanban depois que o contrato for completado.
- O cartão implantado some do Kanban e passa a viver na lista de Contratos.

## 3. Limpeza visual
- Coluna "Categoria" removida das tabelas e exportações.
- Nova coluna "Reajuste" exibida em Contratos.
- Filtro de tipo continua; filtro de categoria removido.

## Detalhes técnicos
- **Banco**:
  - Nova tabela `pipeline_contratos` (mesmos campos principais de `contratos` + `etapa` enum + `posicao` int para ordenação no Kanban) com RLS por `user_id`.
  - Adicionar coluna `data_reajuste date` em `contratos`.
  - `proporcao_comissao` deixa de ser editável na UI mas permanece na tabela (recalculada client-side via trigger ou no save do contrato).
- **UI**:
  - `ContratoForm.tsx`: remove `categoria`, torna `proporcao_comissao` readonly (derivada), adiciona `data_reajuste` com auto-preenchimento (`useEffect` em `data_vigencia`), embute sub-tabela de comissões com estado local sincronizado no submit (insert/update/delete em `comissoes`).
  - Novo `src/pages/app/Pipeline.tsx` + `src/components/pipeline/PipelineBoard.tsx` + `PipelineCard.tsx` + `PipelineForm.tsx`. Drag-and-drop com `@dnd-kit/core` (lib leve, sem dependências grandes).
  - `src/App.tsx`: nova rota `/app/pipeline`.
  - `AppSidebar.tsx`: novo item "Pipeline" com ícone `KanbanSquare`.
  - Lógica de "implantar": função `promoteToContrato(pipelineId)` que valida campos obrigatórios; se faltar algo, reabre modal completo para preencher antes de migrar.

Pronto para implementar quando aprovar.
