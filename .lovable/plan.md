## Objetivo

Deixar a Pipeline mais bonita e produtiva com 3 melhorias:
1. **Tags coloridas** para canal e operadora (cor estável por nome).
2. **Clique no card** abre edição direto (sem precisar do botão de lápis).
3. **Campo de texto livre** que preenche o formulário automaticamente a partir de informações soltas (ex: colar um WhatsApp/email).

---

## 1. Tags coloridas para operadora e canal

Criar `src/lib/tagColor.ts` com uma função `getTagColor(nome)` que:
- Faz hash determinístico do nome (mesmo nome → mesma cor sempre).
- Retorna uma das ~10 paletas pré-definidas (azul, verde, âmbar, roxo, rosa, ciano, etc.) usando tokens HSL do design system com baixa opacidade no fundo e cor sólida no texto/borda — segue o tema claro do app.
- Operadoras conhecidas (Amil, Bradesco, SulAmérica, Porto, Assim, MedSenior) recebem uma cor "oficial" mapeada à marca; demais caem no hash.

No `PipelineCard.tsx`:
- Substituir as linhas de operadora/canal (com ícone + texto cinza) por **chips/badges coloridas** lado a lado, no topo do card, abaixo do nome do cliente.
- Manter o badge de tipo (PF/PJ/Adesão) também colorido por tipo (cores fixas).
- Data de vigência e nº de vidas continuam como ícones discretos no rodapé.

## 2. Clique no card abre edição

No `PipelineCard.tsx`:
- Adicionar `onClick` no `Card` que chama `onEdit()`.
- Diferenciar **clique** de **drag**: o `useDraggable` já tem `activationConstraint: { distance: 5 }` no `Pipeline.tsx`, então arrastar não dispara click. Garantir que o handler só dispara em click puro.
- Remover o botão de lápis (Pencil). Manter apenas o botão de excluir, visível no hover, com `stopPropagation` para não abrir o modal.
- Adicionar leve `hover:bg-accent/30` + cursor pointer para indicar interatividade.

## 3. Preenchimento inteligente por texto livre

Adicionar no topo do `PipelineForm.tsx` (visível só ao criar nova proposta, recolhível ao editar) um bloco **"Preenchimento rápido"**:
- `Textarea` grande com placeholder de exemplo ("Cole aqui informações do cliente, da proposta, etc.").
- Botão **"Preencher automaticamente"** que envia o texto a uma edge function de IA.

### Edge function `pipeline-parse` (nova)
- Usa **Lovable AI Gateway** (`LOVABLE_API_KEY` já existe nos secrets) com modelo `google/gemini-2.5-flash` (rápido e barato, suficiente para extração).
- Recebe `{ texto, operadoras: [{id, nome}] }` e retorna JSON estruturado:
  ```
  { cliente, numero_proposta, tipo, cnpj_cpf, operadora_id,
    valor_mensal, data_vigencia, vidas, qtd_titulares,
    qtd_dependentes, acomodacao, coparticipacao, categoria,
    endereco_empresa, observacoes,
    titulares: [{ nome, cpf, data_nascimento, telefone, email,
                  endereco, plano_anterior, dependentes:[...] }] }
  ```
- Usa **structured outputs** (JSON schema) para forçar o formato.
- Mapeia nome de operadora detectado → `operadora_id` da lista enviada (case-insensitive, fuzzy simples).
- Configurada com `verify_jwt = true` em `supabase/config.toml` (default — usuário precisa estar logado).

### No formulário
- Após resposta, faz merge do JSON no estado atual (campos vazios são preenchidos; campos já preenchidos pelo usuário **não** são sobrescritos sem confirmação — mostrar toast "12 campos preenchidos").
- Loading state no botão durante a chamada.
- Tratamento de erro com toast.

---

## Detalhes técnicos

**Arquivos a criar:**
- `src/lib/tagColor.ts` — paleta + função de cor por nome.
- `supabase/functions/pipeline-parse/index.ts` — edge function de extração via Lovable AI.

**Arquivos a editar:**
- `src/components/pipeline/PipelineCard.tsx` — chips coloridos, click-to-edit, remover botão editar.
- `src/components/pipeline/PipelineForm.tsx` — bloco "Preenchimento rápido" no topo + lógica de merge.
- `supabase/config.toml` — registrar a função (se necessário para configs específicas).

**Sem mudanças no schema do banco.**

## Decisões assumidas
- Cor por nome via hash → consistente entre sessões sem precisar persistir nada.
- IA usa `google/gemini-2.5-flash` (sem custo de API key, via Lovable AI).
- Texto livre aceita qualquer formato (lista, parágrafo, mensagem colada). A IA decide.
- Merge não destrutivo (não sobrescreve o que o usuário já digitou).
