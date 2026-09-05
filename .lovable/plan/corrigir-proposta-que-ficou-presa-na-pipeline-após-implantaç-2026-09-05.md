# Corrigir proposta que ficou presa na pipeline após implantação

## O que aconteceu (verificado)

A RJ Intermediações já existe em Contratos (criada hoje, 05/09 às 18:40), mas o cartão continua na pipeline, na etapa "Aguardando vigência".

Motivo: ao implantar, o sistema cria o contrato e depois move os documentos da pasta da proposta para a pasta do contrato. Só remove o cartão da pipeline se **todos** os arquivos forem movidos. Nesse caso 12 arquivos foram movidos e 4 ficaram para trás (2 PDFs e 2 imagens), então o cartão foi mantido de propósito, para não perder anexos. O problema é que não existe nenhuma forma de concluir essa implantação: tentar de novo criaria um contrato duplicado.

## Correção imediata (esta proposta)

- Mover os 4 arquivos que ficaram na pasta da proposta para a pasta do contrato da RJ Intermediações.
- Conferir que os 16 documentos aparecem no contrato.
- Remover o cartão da pipeline.

## Correção para o futuro

1. **Mover arquivos com mais tolerância**: se um arquivo falhar, tentar novamente; se já existir um arquivo com o mesmo nome no destino, considerar movido; se sobrar algum, usar cópia + remoção como alternativa.
2. **Retomar a implantação sem duplicar**: quando a movimentação falhar, o cartão passa a ficar marcado como "já virou contrato" (guardando o contrato criado). Ao arrastar de novo para Implantado, em vez de criar outro contrato, o sistema apenas termina a mudança dos anexos e apaga o cartão.
3. **Aviso na pipeline**: cartões nessa situação ganham uma faixa "Implantado — finalizar transferência de documentos" com botão para concluir com um clique.
4. **Mensagem mais clara** no aviso de erro, dizendo exatamente o que fazer.

## Detalhes técnicos

- Dados: mover objetos do storage `pipeline-anexos` de `<user>/1f345f03-.../` para `<user>/contratos/7e2a7c02-.../` e apagar a linha em `pipeline_contratos`.
- Migração: nova coluna `contrato_id uuid` em `pipeline_contratos` (referência ao contrato já criado) para permitir retomada idempotente.
- Código: `src/pages/app/Pipeline.tsx` (fluxo `handlePromote` / `onContratoSaved`, faixa e ação de retomada), `src/lib/storage.ts` (função de mover com retry e fallback copy+remove), `src/components/pipeline/PipelineCard.tsx` (faixa de aviso).
