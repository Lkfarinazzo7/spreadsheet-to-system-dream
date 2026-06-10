## Ajustes em Comissões

### 1) Atalhos rápidos por mês
Adicionar, logo abaixo dos filtros atuais (Status / Filtrar por / De / Até), uma linha de botões com os 12 meses (Jan a Dez) + seletor de ano (padrão: ano atual, com setas ‹ ›).

Comportamento:
- Clicar em um mês preenche automaticamente `dateFrom` = 1º dia do mês e `dateTo` = último dia do mês, usando o campo já escolhido em "Filtrar por" (Mês previsto ou Data de pagamento).
- O mês selecionado fica destacado (variant `default`); os demais ficam como `outline`.
- Botão "Limpar período" já existente desmarca o mês ativo.
- Permitir clicar em vários meses? Não — manter simples: 1 mês por vez (multi-mês fica coberto pelos campos De/Até manuais).

### 2) Somatório total
Abaixo da tabela (e também um resumo compacto ao lado dos filtros), exibir:
- **Total filtrado**: soma de `valor` de todas as linhas em `filtered`.
- **Total pago**: soma onde `pago = true`.
- **Total em aberto**: soma onde `pago = false`.

Renderizados como cards/linha de destaque usando `formatCurrency`, alinhados à direita no rodapé da tabela (TableFooter com colSpan).

### Arquivos
- `src/pages/app/Comissoes.tsx` — única alteração necessária.

### Técnico
- Novo estado `monthShortcut: { year: number; month: number } | null`.
- Helper `selectMonth(year, month)` que faz `setDateFrom(YYYY-MM-01)` e `setDateTo(YYYY-MM-último_dia)`.
- `useMemo` para `totals = { total, pago, aberto }` derivado de `filtered`.
- Ao alterar `dateField`, manter o mês selecionado (apenas troca a coluna filtrada).
