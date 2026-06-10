## Refinar atalho de meses em Comissões

Substituir a fileira com os 12 botões de mês por um seletor compacto no mesmo padrão do ano:

```
[‹]  Junho  [›]     [‹] 2026 [›]
```

### Comportamento
- Dois "steppers" lado a lado: **Mês** (Jan…Dez) e **Ano**.
- Setas ‹ › navegam o mês; ao passar de Dez → Jan, incrementa o ano automaticamente (e vice-versa para Jan → Dez).
- Ao mudar mês ou ano, o filtro de período (`dateFrom`/`dateTo`) é atualizado para o intervalo completo daquele mês — mesma lógica de `selectMonth` já existente.
- Um botão "Limpar" ao lado desmarca o período (não há mês "ativo" inicialmente — só vira ativo quando o usuário interage; mantém comportamento atual de `activeMonth`).
- Visual: container `inline-flex` com borda sutil (`border rounded-md`), nome do mês centralizado (`w-20 text-center font-medium`), tabular-nums no ano. Tudo na mesma linha dos totais à direita.

### Arquivo
- `src/pages/app/Comissoes.tsx` — remover o map dos 12 botões, adicionar o stepper de mês e ajustar handlers.
