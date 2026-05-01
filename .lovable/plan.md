
## Visão geral

Três frentes:

1. **Pipeline — Importar planilha** de propostas em andamento (CSV/XLSX).
2. **Pipeline — Redesign visual** moderno (sem emojis), com **total de contratos** e **soma de valor** no topo de cada etapa.
3. **Dashboard — Ticket médio de receita** passa a usar **valor do contrato (`valor_mensal`)**, não parcelas de comissão.

---

## 1. Importar planilha no Pipeline

### UX
- Novo botão **"Importar planilha"** no `PageHeader` da página Pipeline, ao lado de "Nova proposta".
- Abre um Dialog com:
  - Botão **"Baixar modelo (.xlsx)"** — gera localmente um arquivo modelo com cabeçalhos esperados e 1 linha de exemplo.
  - Input de upload aceitando `.xlsx`, `.xls`, `.csv`.
  - **Pré-visualização** das primeiras 10 linhas mapeadas, contagem de válidas/inválidas e lista de erros por linha (linha N: motivo).
  - Seletor de **etapa padrão** (default: "Montagem de contrato") aplicada a linhas sem etapa válida.
  - Botão **"Importar N propostas"** (desabilitado se não houver linhas válidas).

### Colunas do modelo
Obrigatórias: `cliente`, `valor_mensal`.
Opcionais: `numero_proposta`, `tipo` (PF/PJ/Adesao — default PF), `operadora` (nome — match case-insensitive na tabela `operadoras` do usuário), `canal` (nome — `canais_venda`), `etapa` (nome exato de uma das 7 etapas), `data_vigencia` (dd/mm/aaaa ou ISO), `cnpj_cpf`, `vidas`, `categoria`, `acomodacao`, `coparticipacao`, `endereco`, `observacoes`.

### Regras de parsing
- Valor: aceita `1.234,56`, `R$ 1.234,56`, `1234.56` → usa `parseBRL`.
- Datas: aceita `dd/mm/aaaa`, `aaaa-mm-dd`, e número serial do Excel.
- Operadora/canal: lookup pelo nome; se não existir, fica `null` (e mostra aviso, não bloqueia).
- Tipo inválido → default `PF`. Etapa inválida → fallback para etapa padrão escolhida.
- Linha inválida apenas se `cliente` vazio ou `valor_mensal` não numérico.

### Inserção
- Bulk `insert` em `pipeline_contratos` com `user_id`, `posicao = Date.now() + index`, `dados_proposta = { cnpj_cpf, vidas, categoria, acomodacao, coparticipacao, endereco_empresa: endereco }`.
- Ao final: toast "N propostas importadas", fecha dialog e recarrega Kanban.

### Implementação técnica
- Adicionar dep `xlsx` (SheetJS) via `bun add xlsx` para ler/gerar planilhas.
- Novo arquivo: `src/components/pipeline/PipelineImportDialog.tsx`.
- Lógica de parsing/normalização em `src/lib/pipelineImport.ts` (testável, isolada).

---

## 2. Redesign visual da Pipeline (Kanban moderno)

### Direção de design
- **Sem emojis**. Substituir por ícones do `lucide-react` em tom muted (`Building2`, `Megaphone`, `CalendarDays`, `Users`, `Hash`).
- **Colunas**: largura `w-80`, fundo `bg-muted/40` com borda sutil `border border-border/50`, cabeçalho sticky no topo com:
  - Nome da etapa em `text-sm font-semibold`.
  - **Pill com contagem** (`{n} contratos`) e **soma do valor** (`formatCurrency`) abaixo, em `text-xs text-muted-foreground tabular-nums`.
  - Faixa colorida fina (2px) no topo da coluna, cor por etapa (paleta semântica do tailwind config — primary, warning, success, etc.) para criar hierarquia visual.
- **Cards**:
  - `rounded-xl`, sombra leve `shadow-sm` → `shadow-md` no hover, transição suave.
  - Linha 1: nome do cliente em `font-semibold text-sm` + badge `tipo` discreto à direita.
  - Linha 2: `#proposta` em mono `text-xs text-muted-foreground`.
  - Bloco metadados em grid 2 colunas com ícones lucide alinhados (16px), substituindo os emojis atuais (`🏥`, `📍`, `📅`, `👥`).
  - Rodapé: valor em destaque (`text-base font-semibold tabular-nums`) à esquerda; ações (editar/excluir) só aparecem no hover do card (`opacity-0 group-hover:opacity-100`).
  - Estado dragging: `ring-2 ring-primary/40 shadow-lg rotate-1`.
- **Coluna vazia**: ilustração simples com ícone `Inbox` + texto "Arraste propostas aqui".
- Container do Kanban com `gap-4` e padding lateral mais respirado.

### Cabeçalho com totais
Cada `PipelineColumn` calcula `count` e `sum = items.reduce((s,i)=>s+Number(i.valor_mensal||0),0)` e exibe ambos no header. Já recebe `items` — sem mudança de props.

### Arquivos afetados
- `src/components/pipeline/PipelineColumn.tsx` — novo header, faixa colorida, totais, estilos.
- `src/components/pipeline/PipelineCard.tsx` — ícones lucide no lugar de emojis, novos estilos, ações com hover.
- `src/pages/app/Pipeline.tsx` — passar cor por etapa via mapa local; ajustar gap/padding do container.

---

## 3. Dashboard — Ticket médio de receita por contrato

### Mudança
Atualmente: `ticketReceita = receitaMes / quantidade_de_parcelas_pagas`.
**Novo**: ticket médio = **soma de `valor_mensal` dos contratos cuja `data_vigencia` está no período** ÷ **número de contratos no período** (mesma fórmula que hoje calcula "ticket médio de contrato"). Ou seja, consolidar:

- Renomear KPI **"Ticket médio de receita"** → mantém label, mas calcula sobre `valor_mensal` dos contratos do período.
- Manter **"Ticket médio de contrato"** como está (também `valor_mensal`)?

> ⚠️ Como a fórmula nova ficaria igual ao "Ticket médio de contrato", proponho:
> **remover o KPI "Ticket médio de contrato"** e deixar apenas **"Ticket médio de receita"** = valor_mensal médio dos contratos do período. Resultado: 4 KPIs (mais limpo).
>
> Se preferir manter os dois separados, me avise — posso definir "ticket de receita" como receita anualizada (`valor_mensal × 12`) por contrato, por exemplo.

### Implementação
- Em `src/pages/app/Dashboard.tsx`, em `stats`:
  - `ticketReceita = contratosPeriodo.length ? totalContratos / contratosPeriodo.length : 0`.
  - Remover `ticketContrato` e o KPI correspondente do array `kpis`.
- Grid de KPIs passa de `lg:grid-cols-5` para `lg:grid-cols-4`.

---

## Arquivos

**Criados**
- `src/components/pipeline/PipelineImportDialog.tsx`
- `src/lib/pipelineImport.ts`

**Editados**
- `src/pages/app/Pipeline.tsx` (botão importar, ajustes visuais container)
- `src/components/pipeline/PipelineColumn.tsx` (redesign + totais)
- `src/components/pipeline/PipelineCard.tsx` (redesign, ícones)
- `src/pages/app/Dashboard.tsx` (ticket médio)
- `package.json` (dep `xlsx`)

**Sem alterações de banco** — schema já comporta tudo.
