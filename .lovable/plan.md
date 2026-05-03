# Melhorias na Pipeline

## 1. Abrir anexos com 1 clique

Em `src/components/pipeline/PipelineAnexos.tsx`:
- Tornar o nome/linha do arquivo clicável: `onClick` gera signed URL (60s) e abre em nova aba (`window.open(url, "_blank")`).
- O botão de download fica como ação secundária (ícone) ao lado do excluir.
- PDFs e imagens abrem inline no navegador; outros formatos baixam normalmente — comportamento padrão do browser.

## 2. Arquivos continuam disponíveis após implantação (promover para Contratos)

Hoje, ao mover um card para "Implantado", o registro do pipeline é apagado e os anexos ficam órfãos no bucket. Vamos preservar e expor no contrato:

**Storage layout:**
- Pipeline: `pipeline-anexos/{user_id}/{pipeline_id}/...` (já existe)
- Contratos: `pipeline-anexos/{user_id}/contratos/{contrato_id}/...` (mesmo bucket, nova "pasta")

**Fluxo de promoção** (em `src/pages/app/Pipeline.tsx`, função `onContratoSaved`):
1. Após o `ContratoForm` salvar e retornar o `contrato.id`, listar arquivos em `{user_id}/{pipeline_id}/`.
2. Para cada arquivo, chamar `supabase.storage.from('pipeline-anexos').move(oldPath, newPath)` para `{user_id}/contratos/{contrato_id}/{nome}`.
3. Só então deletar o registro do pipeline.
4. Para isso, o `ContratoForm.onSaved` precisa retornar o `id` do contrato salvo. Ajuste: mudar a assinatura para `onSaved: (contratoId?: string) => void` e passar o id após insert/update.

**Componente `ContratoAnexos`:** novo arquivo `src/components/contratos/ContratoAnexos.tsx`, basicamente uma cópia de `PipelineAnexos` com o prefixo `{user_id}/contratos/{contrato_id}`. Renderizado dentro do `ContratoForm` quando existir `form.id`.

## 3. Campo Canal faltando dentro do card

Em `PipelineForm.tsx`, hoje só existe o select de Operadora. Vamos:
- Carregar `canais_venda` (mesmo padrão do ContratoForm).
- Adicionar `<Select>` "Canal de venda" no grid de "Dados do contrato", logo após Operadora, escrevendo em `form.canal_id`.

Assim o card também passa a exibir a tag de canal (a UI já está pronta para isso em `PipelineCard.tsx`).

## 4. Gerador de "E-mail de elaboração" para o ADM

Botão **"Gerar e-mail de elaboração"** dentro do `PipelineForm` (no rodapé, ao lado de Salvar) que monta o texto a partir dos dados já preenchidos, no formato:

```text
Elaboração {Operadora} {NomeTitular} {CPF}

Elaboração {Operadora} Pessoa {Física|Jurídica}

Plano: {Operadora} {Categoria}
➡️Acomodação: {Apartamento|Enfermaria}
➡️Modalidade: {Compulsório (PJ) | Adesão | Individual (PF)}
➡️Cnpj/Cpf: {cnpj_cpf}
➡️Razão social: {cliente}    (apenas PJ)
➡️Endereço de correspondência: {endereco do titular ou endereco_empresa}

Dados do Representante
➡️Nome: {titular.nome}
➡️Email: {titular.email}
➡️Telefone: {titular.telefone}
➡️Plano anterior: {titular.plano_anterior || "Sem plano"}

👥Dependentes
➡️Nome: {dep.nome}
➡️Grau de parentesco: {dep.parentesco}
➡️Plano anterior: {dep.plano_anterior || "Sem plano"}

Obs: {form.observacoes ou texto padrão de declaração}
```

**UX:** ao clicar, abre um `Dialog` com:
- `Textarea` editável já preenchido com o texto montado.
- Campo "Assunto" pré-preenchido: `Elaboração {Operadora} {Titular} {CPF}`.
- Campo "E-mail do ADM" (lembrado em `localStorage` por usuário) — opcional.
- Botões: **Copiar** (clipboard) e **Abrir no e-mail** (`mailto:` com subject + body codificados). Mantemos simples, sem configurar provedor de e-mail agora.

Helper novo: `src/lib/elaboracaoEmail.ts` exportando `buildElaboracaoEmail(form, operadoraNome)` para gerar `{ assunto, corpo }`.

Componente novo: `src/components/pipeline/ElaboracaoEmailDialog.tsx`.

## Arquivos afetados

- editar: `src/components/pipeline/PipelineAnexos.tsx` (clique abre arquivo)
- editar: `src/components/pipeline/PipelineForm.tsx` (campo Canal + botão de e-mail)
- editar: `src/components/contratos/ContratoForm.tsx` (`onSaved` devolve id, render de `ContratoAnexos`)
- editar: `src/pages/app/Pipeline.tsx` (mover anexos antes de deletar pipeline)
- novo: `src/components/contratos/ContratoAnexos.tsx`
- novo: `src/components/pipeline/ElaboracaoEmailDialog.tsx`
- novo: `src/lib/elaboracaoEmail.ts`

Sem migrações — o bucket `pipeline-anexos` e suas policies (escopadas por `auth.uid()` no primeiro segmento do path) já cobrem o novo prefixo `{user_id}/contratos/...`.