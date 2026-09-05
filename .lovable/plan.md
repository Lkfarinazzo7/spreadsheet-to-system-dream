# Botão de e-mail de antecipação também em Contratos

## O que muda

Hoje o botão **E-mail de antecipação** existe só no formulário da pipeline (`PipelineForm.tsx`). Quando a proposta vira contrato, o botão some.

A alteração adiciona o mesmo botão no formulário de contrato (`ContratoForm.tsx`), reaproveitando exatamente o que já existe:

- Botão "E-mail de antecipação" no rodapé do formulário de contrato (ao lado do "Copiar informações").
- Ao clicar, abre o mesmo diálogo (`ElaboracaoEmailDialog`) com assunto e corpo gerados por `buildAntecipacaoEmail`, usando os dados do contrato (cliente, tipo, número da proposta, operadora e dados da proposta com titulares/dependentes).
- O e-mail do ADM continua sendo lembrado automaticamente (mesmo armazenamento local já usado na pipeline).

Nenhum dado novo é gravado e nenhuma regra de negócio muda — é só expor a função que já existe na outra tela.

## Detalhes técnicos

- `ContratoFormValues` já tem todos os campos que `buildAntecipacaoEmail` usa (`cliente`, `tipo`, `numero_proposta`, `dados_proposta`), então basta passar o formulário com um cast leve para `PipelineFormValues` ou afrouxar a tipagem da função para aceitar um tipo parcial comum.
- O nome da operadora já está disponível no formulário (lista de operadoras carregada para o select); usar o nome correspondente ao `operadora_id` selecionado.
- Verificação: `bunx tsgo --noEmit -p tsconfig.app.json` sem erros.
