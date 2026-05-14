
## 1. Visualização inline de anexos (estilo Google Drive)

Em `PipelineAnexos.tsx`, ao clicar no arquivo, em vez de `window.open(url)`:
- Abrir um `Dialog` em tela cheia (`max-w-5xl h-[85vh]`) com um visualizador embutido.
- PDFs e imagens: renderizar via `<iframe src={signedUrl}>` (PDF) ou `<img>` (imagens).
- Outros formatos (xlsx, docx): usar Google Docs Viewer como fallback (`https://docs.google.com/gview?url=...&embedded=true`) já que o bucket é privado e signed URL não dura — alternativa: mostrar mensagem "Pré-visualização indisponível" + botão "Baixar".
- Header do dialog com nome do arquivo + botão "Baixar" + botão "Abrir em nova aba".

## 2. Botões de download

Em `PipelineAnexos.tsx`:
- Adicionar botão de download individual ao lado da lixeira em cada linha (ícone `Download`). Faz `fetch` da signed URL e dispara `<a download>`.
- Adicionar botão "Baixar todos" no header do componente (ao lado de "Adicionar arquivos"), aparece só quando `files.length > 1`. Empacota tudo num ZIP via `jszip` (já é leve) e baixa como `anexos-{cliente}.zip`.

Ambos reutilizados também em Contratos (já que `ContratoAnexos` envolve `PipelineAnexos`).

## 3. Aba "E-mail de antecipação"

Novo helper `src/lib/antecipacaoEmail.ts` com `buildAntecipacaoEmail(form, operadoraNome)` que monta:

```
Antecipação {OPERADORA} {NOME TITULAR} {CPF}

Boa tarde!

Solicito a antecipação total das parcelas referentes à proposta abaixo.

Seguem em anexo o comprovante de pagamento e a cópia da proposta para conferência.

Plano: {operadora} {categoria} (código na planilha é o {numero_proposta})
E-mail: {titular.email}
Telefone: {titular.telefone}
Acomodação: {acomodacao}
Modalidade: {MEI|PJ|Adesão|Individual}
{Cnpj|Cpf}: {cnpj_cpf}
Razão social: {cliente}    (PJ apenas)
Endereço: {endereço do titular ou empresa}
```

Reutilizar o componente `ElaboracaoEmailDialog`, mas torná-lo genérico:
- Renomear para `EmailDialog` (ou aceitar prop `titulo`).
- O `PipelineForm` passa a ter **dois botões** no rodapé: "E-mail elaboração" e "E-mail antecipação", cada um abre o mesmo dialog com conteúdo diferente.

Para a modalidade "MEI", adicionar inferência: se tipo PJ e CNPJ começa com padrão de MEI ou checkbox no form (mais simples: deixar o usuário ajustar no textarea editável do dialog, padrão = "Compulsório (PJ)").

## 4. Editar contrato com cara de pipeline

Hoje `Contratos.tsx` abre o `ContratoForm`, que já tem campos básicos + comissões + anexos. O que falta vs. pipeline:
- Dados de proposta (titulares, dependentes, endereço, etc.) que ficam em `pipeline_contratos.dados_proposta` (jsonb).

Mudança: ao **promover** uma proposta para contrato (em `Pipeline.tsx → onContratoSaved`), copiar `dados_proposta` do pipeline para um novo campo `contratos.dados_proposta` (jsonb).

**Migração:** `ALTER TABLE contratos ADD COLUMN dados_proposta jsonb;`

No `ContratoForm`, adicionar uma seção colapsável "Dados da proposta" reutilizando os mesmos sub-componentes do `PipelineForm` (titulares + dependentes). Para evitar duplicação, extrair `DadosPropostaEditor` de dentro do `PipelineForm` para `src/components/shared/DadosPropostaEditor.tsx` e usar nos dois forms.

Também tornar a linha da tabela em `Contratos.tsx` clicável (clique abre o form de edição), além do botão de lápis atual.

## 5. Filtro de período em Comissões

Em `Comissoes.tsx`, adicionar ao card de filtros:
- Select "Filtrar por": `Mês previsto` (default) | `Pagamento`.
- Dois `DatePicker`s "De" e "Até".
- Botão "Limpar".

A lógica de `filtered` aplica o intervalo no campo escolhido (`mes_previsto` ou `data_pagamento`). Linhas sem `data_pagamento` somem quando filtra por pagamento.

## Arquivos afetados

- editar: `src/components/pipeline/PipelineAnexos.tsx` (viewer inline + downloads + zip)
- editar: `src/components/pipeline/PipelineForm.tsx` (botão antecipação, extrair DadosPropostaEditor)
- editar: `src/components/contratos/ContratoForm.tsx` (DadosPropostaEditor + dados_proposta)
- editar: `src/pages/app/Pipeline.tsx` (copiar dados_proposta na promoção)
- editar: `src/pages/app/Contratos.tsx` (linha clicável)
- editar: `src/pages/app/Comissoes.tsx` (filtro de período)
- editar: `src/components/pipeline/ElaboracaoEmailDialog.tsx` (genérico, prop título)
- novo: `src/lib/antecipacaoEmail.ts`
- novo: `src/components/shared/DadosPropostaEditor.tsx`
- migração: adicionar `dados_proposta jsonb` em `contratos`
- dependência: `jszip` (para "Baixar todos")
