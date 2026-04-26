# Ajustes solicitados

## 1. Dashboard
- **Seletor de período** no topo: setas ◀ ▶ para navegar mês a mês (Abril, Maio, Junho…) + botão "Período personalizado" que abre dois date pickers (início/fim).
- **KPIs**: manter apenas **Receita do mês**, **Comissão a receber** e **Ticket médio de recebimento** (média do valor das comissões pagas no período). Remover *Comissão recebida*, *Contratos ativos*.
- **Remover** completamente o gráfico "Comissão mês a mês" (previsto vs recebido).
- **Receita por operadora**: trocar pizza por **gráfico de barras horizontais**, ordenado do maior para o menor valor recebido.
- **Contratos por canal**: trocar para **valor por canal** (soma de comissão recebida no período), ordenado do maior para o menor.
- Lista de "Próximos vencimentos" mantida.

## 2. Contratos – formulário
- **Remover o seletor "Status"** do form de novo contrato (status fica fixo "Ativo" no insert).
- **Pré-preencher 3 parcelas** ao criar novo contrato: Bancária #1, Bancária #2, Bancária #3.
- **Nova coluna "% sobre mensal"** em cada linha de comissão. Quando preenchida, calcula `valor = valor_mensal * (% / 100)` automaticamente. Editar o valor manualmente desvincula o cálculo dessa linha.
- **Datas** "Previsto p/" e "Recebido em" iniciam pré-preenchidas com a **data de hoje** ao adicionar nova parcela / abrir form de novo contrato.

## 3. Pipeline (Kanban)
- **Mesclar etapas**: "Enviado para assinatura" + "Preenchimento da declaração de saúde" → uma única coluna **"Assinatura / Declaração de saúde"**. Migration renomeia o enum e move dados existentes.
- **Corrigir bug de Nova Proposta**: garantir que o form sempre crie corretamente (reset de estado garantido ao abrir, toast de confirmação, recarregamento da lista).

## 4. Comissões
- **Remover a aba "Previsto × Recebido"** completamente — fica só a aba de parcelas (sem tabs).

## Implementação técnica
- Migration:
  - `ALTER TYPE etapa_pipeline RENAME VALUE 'Enviado para assinatura' TO 'Assinatura / Declaração de saúde';`
  - `UPDATE pipeline_contratos SET etapa = 'Assinatura / Declaração de saúde' WHERE etapa = 'Preenchimento da declaração de saúde';`
  - Remover valor antigo do enum (recriar enum sem ele).
- `Dashboard.tsx`: adiciona estado `periodStart`/`periodEnd`, controles de navegação, recalcula `stats`/`porOperadora`/`porCanal` filtrando por período; troca PieChart por BarChart horizontal ordenado.
- `ContratoForm.tsx`: remove campo Status do JSX; ao abrir em modo "novo" inicializa `comissoes` com 3 linhas Bancárias; adiciona campo `percentual` (state local não persistido) por linha que recalcula `valor` quando alterado; default de `mes_previsto` e `data_pagamento` = hoje.
- `Pipeline.tsx`: array `ETAPAS` com 7 itens; `PipelineForm` default etapa `"Montagem de contrato"`.
- `Comissoes.tsx`: remover `<Tabs>`, deixar conteúdo direto.