# Ajustes: dados no contrato, destaque de revisão e relatório de plano anterior

## 1. CNPJ e demais dados da proposta aparecerem em Contratos

Ao implantar, os dados da proposta já são copiados para o contrato (`dados_proposta` é gravado). O problema é de exibição: o editor compartilhado usado na aba Contratos mostra apenas categoria, acomodação, coparticipação, vidas, titulares e dependentes — ele não tem os campos CNPJ/CPF e Endereço da empresa que existem no card da Pipeline.

Correção: incluir no editor compartilhado (`src/components/shared/DadosPropostaEditor.tsx`) os campos que hoje só existem no formulário da Pipeline:
- CNPJ/CPF (com máscara conforme o tipo PJ/PF)
- Endereço da empresa (quando PJ)
- Qtd. de dependentes / data de reajuste da proposta, se ainda faltarem

Assim, tudo que está preenchido na caixinha da Pipeline fica visível e editável em Contratos, sem perda de dados.

## 2. "Próxima revisão" no topo do card da Pipeline

Em `src/components/pipeline/PipelineCard.tsx`, mover o badge de próxima revisão para o topo do card, acima do nome do cliente, como uma faixa de destaque em largura total (cores atuais mantidas: vermelho para atrasado, amarelo para hoje, azul para próximos 7 dias).

## 3. Relatório de "plano anterior" (operadoras de origem)

Em `src/pages/app/Relatorios.tsx`, novo bloco "Origem — plano anterior":
- Percorre `dados_proposta.titulares[].plano_anterior` e `dependentes[].plano_anterior` dos contratos do período.
- Conta quantas vidas vieram de cada operadora anterior (quem não tinha plano entra como "Sem plano").
- Gráfico de barras horizontais ordenado do maior para o menor, com quantidade de vidas e percentual.
- Entra também na exportação de Excel/PDF junto com os demais relatórios.

## Detalhes técnicos
- Arquivos: `src/components/shared/DadosPropostaEditor.tsx`, `src/components/pipeline/PipelineCard.tsx`, `src/pages/app/Relatorios.tsx`.
- Sem mudanças de banco de dados; todos os campos já existem em `dados_proposta`.
