
# Correções e melhorias — Pipeline, Contratos e Dashboard

## 1. 🐛 Bug crítico: erro "out of range for type integer" ao salvar proposta
A coluna `posicao` em `pipeline_contratos` é `integer` (limite ~2.1 bi), mas estamos gravando `Date.now()` (~1.78 trilhões). Por isso o erro do print.

**Correções:**
- **Migration**: alterar `pipeline_contratos.posicao` de `integer` para `bigint` (suporta `Date.now()` sem problemas).
- Mantém o uso de `Date.now()` como ordenação (sempre crescente, evita conflito).

## 2. 📋 Pipeline / Nova proposta — melhorias no formulário

### Valor total
- Trocar `<input type="number">` por **input com máscara monetária BRL** (R$ 1.234,56). Digitação livre, parsing para número antes de salvar. Aplicar também no campo "Valor total" e nos titulares onde houver valor.

### Telefone
- Aplicar máscara **(11) 91234-5678** / **(11) 1234-5678**. Aceita apenas dígitos, formata em tempo real.

### Idade → Data de nascimento
- Substituir o campo "Idade" (titular e dependente) por **"Data de nascimento"** (date picker).
- Idade exibida automaticamente ao lado (calculada a partir da data).
- Armazenar `data_nascimento` no JSON; manter `idade` derivada.

### Plano anterior
- Trocar `Input` livre por `Select` populado com as **operadoras cadastradas** (mesma lista de `operadoras` ativas) + opção "Nenhum / Não possui".
- Vale para titulares e dependentes.

### Parentesco (dependente)
- Trocar `Input` por `Select` com opções fixas: **Cônjuge, Filho(a), Irmão(ã), Sobrinho(a), Neto(a), Mãe, Pai, Sogro(a), Genro, Nora**.

## 3. 💰 Contratos — formulário de comissões

### Bug do campo "Parcela"
- Atualmente `value={c.parcela}` com `type="number"` reseta indevidamente. Trocar para string controlada (`value` como string, parse só no save) — ou usar `defaultValue` + onBlur. Garantir que seja editável livremente (1, 2, 3, 10…).

### Date picker de "Recebido em"
- O `<input type="date">` puro às vezes não abre o calendário. Substituir por componente combinado: **input de texto + popover com `Calendar`** (já existe `@/components/ui/calendar`). Permitir digitação manual E seleção visual no calendário.
- Aplicar o mesmo padrão em "Previsto p/" e nos campos de data do form de contrato (vigência, reajuste).

## 4. 📊 Dashboard — novas métricas

### KPIs (5 cards em vez de 3)
1. Receita do período (já existe — soma das comissões pagas)
2. Comissão a receber (já existe)
3. **Contratos do período** (novo) — qtd de contratos com `data_vigencia` dentro do período
4. **Ticket médio de contrato** (novo) — `soma(valor_mensal dos contratos do período) / qtd contratos`
5. **Ticket médio de receita** (renomear o atual "Ticket médio de recebimento")

### Gráficos (4 em vez de 2, em grid 2x2)
1. **Receita por operadora** (já existe)
2. **Receita por canal** (já existe)
3. **Contratos por operadora** (novo) — soma de `valor_mensal` dos contratos por operadora, ordem decrescente
4. **Contratos por canal** (novo) — idem por canal

> Diferença chave: "Receita" = comissões pagas no período. "Contrato" = `valor_mensal` dos contratos cuja `data_vigencia` cai no período.

### Buscar contratos no Dashboard
- Adicionar query `supabase.from("contratos").select("id, valor_mensal, operadora_id, canal_id, data_vigencia")` no `useEffect` inicial.
- Filtrar por `data_vigencia` dentro do período.

## 5. Detalhes técnicos

- **Máscara monetária**: helper `formatBRL(n)` + `parseBRL(str)` em `src/lib/format.ts`. Componente `<MoneyInput>` controlado.
- **Máscara telefone**: helper `maskPhone(str)` em `format.ts`.
- **Cálculo idade**: `getAge(birthDate)` retorna anos completos.
- **DatePicker**: criar `src/components/ui/date-picker.tsx` reutilizável (Input + Popover + Calendar do shadcn).
- **JSON `dados_proposta`**: adicionar campo `data_nascimento` em `Titular` e `Dependente` (mantém retrocompat — `idade` continua opcional).
- **Migration**: `ALTER TABLE pipeline_contratos ALTER COLUMN posicao TYPE bigint;`

## Arquivos afetados
- `supabase/migrations/...` (nova migration: posicao → bigint)
- `src/lib/format.ts` (helpers BRL, telefone, idade)
- `src/components/ui/date-picker.tsx` (novo)
- `src/components/pipeline/PipelineForm.tsx` (máscaras, selects, datas, parentesco)
- `src/components/contratos/ContratoForm.tsx` (parcela editável, date pickers)
- `src/pages/app/Dashboard.tsx` (5 KPIs, 4 gráficos, query de contratos)
