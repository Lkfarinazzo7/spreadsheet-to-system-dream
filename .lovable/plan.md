## 1. Aba Contratos (`src/pages/app/Contratos.tsx`)

**Nova coluna "Comissão recebida"**
- Ao carregar contratos, buscar em paralelo todas as comissões (`id, contrato_id, valor, pago`) e agrupar por `contrato_id` somando apenas as `pago = true`.
- Exibir esse valor em uma nova coluna alinhada à direita, tabular-nums.
- Adicionar linha de rodapé (`TableFooter`) com a somatória total das comissões recebidas dos contratos atualmente filtrados, além do total de "Valor mensal".

**Novos filtros** (acima da tabela, junto do filtro de tipo/status existente)
- **Operadora**: Select com todas as operadoras do usuário (`all` + lista).
- **Canal**: Select com todos os canais de venda.
- **Mês de vigência**: dois seletores compactos (Mês / Ano) no mesmo padrão já usado em Comissões, com opção "Todos". Filtra contratos cujo `data_vigencia` cai naquele mês/ano.
- Incluir os novos filtros no `useMemo` que gera `filtered` e também no export XLSX (usa `filtered`).

## 2. Dashboard (`src/pages/app/Dashboard.tsx`)

Ampliar o seletor de período de `"month" | "custom"` para `"month" | "year" | "custom"`.

- **Mensal** (já existe): mantém os controles ‹ Mês/Ano › atuais.
- **Anual** (novo botão): mostra controle ‹ Ano › (ChevronLeft/ChevronRight + label + botão "Hoje"). O `period` computa `start = YYYY-01-01`, `end = YYYY-12-31`.
- **Período personalizado**: mantém o comportamento atual (Popover com dois `date` inputs).

Selecionar um modo diferente troca `mode` sem apagar o estado dos outros modos, para o usuário poder alternar sem perder a seleção.

Nenhuma outra métrica muda — todos os `useMemo` já dependem de `period.start/end`.

## 3. Aba Relatórios (`src/pages/app/Relatorios.tsx`)

### 3.1. Novos KPIs
- **Ticket médio por contrato**: soma de `valor_mensal` dos contratos com `data_vigencia` dentro do período ÷ quantidade desses contratos.
- **Ticket médio de comissão recebida**: soma das comissões pagas no período (já calculada como `totals.recebido`) ÷ nº de contratos distintos que tiveram comissão paga no período.

Exibidos em uma nova faixa "Ticket médio" com dois cards, entre as seções "Realizado (caixa)" e "Competência". Também adicionados ao XLSX (aba "Resumo") e ao PDF.

### 3.2. Novos gráficos — faixa etária e parentesco

Ler os JSON `dados_proposta` dos contratos do período (já persistidos em `contratos.dados_proposta`, editáveis pelo `DadosPropostaEditor`). Para cada contrato do período:
- Titulares → calcular idade a partir de `data_nascimento` na data de referência (hoje).
- Dependentes → idem, mais o campo `parentesco`.

Faixas etárias (padrão ANS solicitado):
```text
0-18, 19-23, 24-28, 29-33, 34-38, 39-43, 44-48, 49-53, 54-58, 59+
```

Novos gráficos (BarChart do recharts, mesmo padrão visual dos existentes):
- **Faixa etária dos titulares** — contagem por faixa.
- **Faixa etária dos dependentes** — contagem por faixa.
- **Grau de parentesco dos dependentes** — contagem por `parentesco` (Cônjuge, Filho(a), etc.), ordenado desc.

Adicionar as três tabelas correspondentes ao export XLSX e ao PDF (após "Por canal").

### Notas técnicas
- Adicionar ao `select` de Relatórios os campos `contratos.data_vigencia`, `contratos.valor_mensal`, `contratos.id` e `contratos.dados_proposta` (nova query paralela). O escopo atual só busca comissões/despesas.
- Utilitário local `computeAge(iso, ref)` e `bucketFaixa(age)` dentro do próprio arquivo (não vale criar módulo compartilhado só para isso).
- Ignorar entradas sem `data_nascimento` válida.
- Nenhuma alteração de schema ou migração — as colunas necessárias já existem.

## Arquivos afetados
- `src/pages/app/Contratos.tsx` — coluna comissão, rodapé total, filtros operadora/canal/mês de vigência.
- `src/pages/app/Dashboard.tsx` — modo "year" no seletor de período.
- `src/pages/app/Relatorios.tsx` — novos KPIs, gráficos de faixa etária e parentesco, ampliação dos exports XLSX/PDF.
