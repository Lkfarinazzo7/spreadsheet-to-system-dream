## Objetivo

Quatro melhorias na Pipeline:
1. **Total geral** no topo somando todas as etapas.
2. **Anexos** (tipo "Drive") por proposta com upload de documentos.
3. **Checklist de pendências** no rodapé do card mostrando o que falta preencher.
4. **Data de próxima revisão** por proposta + filtro/destaque visual.

---

## 1. Total geral no topo da Pipeline

Em `src/pages/app/Pipeline.tsx`, dentro do `PageHeader` (ou logo abaixo):
- Calcular `totalGeral = items.reduce((s,i) => s + Number(i.valor_mensal||0), 0)` e `totalCount = items.length`.
- Mostrar uma faixa com cards pequenos: **"Total em pipeline"** (valor) e **"Propostas ativas"** (contagem).

## 2. Anexos por proposta ("Drive")

**Backend (migration):**
- Criar bucket privado `pipeline-anexos` em `storage.buckets`.
- RLS em `storage.objects` para o bucket: usuário só lê/escreve/deleta arquivos cujo `path` começa com `auth.uid()/`.
- Convenção de path: `{user_id}/{pipeline_id}/{timestamp}-{nome_arquivo}`.

**Componente novo `PipelineAnexos.tsx`:**
- Lista arquivos do prefixo `{user_id}/{pipeline_id}/` via `supabase.storage.from('pipeline-anexos').list()`.
- Botão **"Adicionar arquivos"** (multi-upload, drag-and-drop opcional).
- Cada item: ícone por extensão (PDF/DOC/XLS/IMG), nome, tamanho, data, botões **baixar** (createSignedUrl 60s) e **excluir**.
- Estado vazio amigável.

**Integração:**
- No `PipelineForm.tsx`, adicionar uma seção **"Anexos"** (visível só ao editar — precisa do `id`).
- No `PipelineCard.tsx`, mostrar um pequeno indicador `📎 N` quando houver anexos. Para evitar N requests, opcionalmente armazenar `anexos_count` denormalizado em `dados_proposta` (atualizado ao subir/remover) — primeira versão pode pular esse contador para simplicidade.

## 3. Checklist de pendências no card

Criar `src/lib/pipelinePendencias.ts` com função `getPendencias(item)` que retorna lista de strings dos campos importantes ainda vazios. Regras:
- Sempre verifica: `numero_proposta`, `operadora_id`, `canal_id`, `valor_mensal>0`, `data_vigencia`, `dados_proposta.cnpj_cpf`, `dados_proposta.vidas`, `dados_proposta.acomodacao`, `dados_proposta.coparticipacao`.
- Se PJ: também `endereco_empresa`.
- Se houver `qtd_titulares > 0`: verificar que cada titular tem `nome` e `cpf` preenchidos; senão adiciona "Titular N incompleto".

No `PipelineCard.tsx`, no rodapé (após o valor):
- Se `pendencias.length === 0`: badge verde discreto **"Completo"** com `CheckCircle2`.
- Caso contrário: bloquinho colapsado mostrando até 3 itens com `AlertCircle` âmbar + "+N mais" se exceder. Texto pequeno (text-[10.5px]), não interfere no drag.

## 4. Data de próxima revisão

**Schema (migration):**
- Adicionar coluna `data_revisao DATE NULL` em `pipeline_contratos`.

**Form:**
- No `PipelineForm.tsx`, adicionar campo **"Próxima revisão"** com `DatePicker` (na seção "Dados do contrato").

**Card:**
- Mostrar badge no topo do card quando `data_revisao` existir:
  - **vencida (passou)**: badge vermelho "Revisar há Xd".
  - **hoje**: badge âmbar "Revisar hoje".
  - **futura próxima (≤7d)**: badge azul "Revisar em Xd".
  - **>7d**: ícone discreto com data no tooltip.

**Pipeline page:**
- Adicionar toggle no header **"Só revisar hoje/atrasados"** que filtra `items` por `data_revisao <= hoje`.
- Card de KPI "Para revisar hoje" no topo (junto com totais do passo 1).

---

## Detalhes técnicos

**Arquivos a criar:**
- `src/components/pipeline/PipelineAnexos.tsx` — gerenciador de arquivos do bucket por proposta.
- `src/lib/pipelinePendencias.ts` — regras de campos faltantes.
- `supabase/migrations/<ts>_pipeline_anexos_e_revisao.sql` — bucket + RLS storage + coluna `data_revisao`.

**Arquivos a editar:**
- `src/pages/app/Pipeline.tsx` — total geral, KPI de revisão, toggle de filtro, passar `data_revisao` adiante.
- `src/components/pipeline/PipelineCard.tsx` — badge de revisão, lista de pendências, indicador de anexos.
- `src/components/pipeline/PipelineForm.tsx` — campo `data_revisao`, seção "Anexos" (quando editando).
- `src/integrations/supabase/types.ts` — auto-gerado após migração.

**Sem necessidade de novos secrets.** Tudo usa Lovable Cloud (Supabase Storage + DB).

## Decisões assumidas
- Bucket privado com download via `createSignedUrl` (não público), limite implícito de 50MB por arquivo (default Supabase).
- Pendências são heurística client-side (sem nova coluna no banco) — recalcula em cada render.
- `data_revisao` é separada da `data_vigencia` (uso operacional do corretor).
- Filtro "para revisar" é client-side (já temos todos os items em memória).
