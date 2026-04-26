
# Limpeza de menu + formulário completo de proposta no Kanban

## 1. Remover módulos
- **Alertas**: remover do menu lateral, remover rota `/app/alertas` e excluir `src/pages/app/Alertas.tsx`.
- **Importar planilhas**: remover do menu, remover rota `/app/importar` e excluir `src/pages/app/Importar.tsx`. (Será reintroduzido no futuro em outro lugar.)
- Limpar imports em `src/App.tsx` e `src/components/layout/AppSidebar.tsx`.

## 2. Corrigir bug "Nova proposta não cria"
Causa provável: o `onSaved` recarrega a lista mas a query de `load()` filtra `neq("etapa","Implantado")` e o `posicao` default (`0`) faz a ordenação esconder ou amontoar. Vou:
- Garantir `posicao` único no insert (usar `Date.now()` ou `max(posicao)+1` da etapa).
- Fechar o modal **somente após** insert bem-sucedido + `await load()` garantido.
- Toast de sucesso já existe; vou verificar caminho do erro silencioso (campo obrigatório novo). Se faltar `cliente`, o `required` HTML mostra a mensagem.
- Adicionar log/erro visível se `insert` falhar por RLS.

## 3. Novo formulário de Proposta (Kanban) — campos
Reestruturar `PipelineForm.tsx` em **3 seções colapsáveis** dentro do modal (modal mais largo, scroll interno):

### Seção A — Dados do contrato
- **Proposta** (texto livre, opcional)
- **Tipo contrato** (PF / PJ / Adesão)
- **CNPJ/CPF** (texto livre, máscara automática conforme tipo)
- **Operadora** (select das cadastradas)
- **Categoria** (texto livre)
- **Acomodação** (obrigatório: Enfermaria / Apartamento)
- **Coparticipação** (obrigatório: Total / Parcial / Não possui)
- **Vidas** (número) → quando preenchido, abre dois sub-campos: **Titulares** (número) e **Dependentes** (número). Validação: `titulares + dependentes = vidas`.
- **Valor** (R$, valor total mensal do contrato)
- **Data de vigência** (date)
- **Mês de implantação/reajuste** (auto-preenchido = mesmo mês/dia 1 ano após vigência, editável)
- **Endereço da empresa** (textarea, texto livre)

### Seção B — Titulares (repetidor dinâmico)
Quantidade de blocos = valor digitado em "Titulares". Cada bloco:
- Nome do titular
- CPF
- Idade
- Telefone
- E-mail
- Endereço (texto livre)
- Plano anterior
- **Dependentes deste titular** (input numérico) — define quantos sub-blocos de dependente aparecem dentro do titular

### Seção C — Dependentes (dentro de cada titular)
Para cada dependente do titular:
- Grau de parentesco
- Nome
- CPF
- Idade
- Plano anterior

Validação cruzada: soma dos dependentes de todos os titulares deve bater com "Dependentes" da seção A (alerta amarelo se não bater, mas permite salvar).

## 4. Persistência
Como o usuário pediu **só na Pipeline**, nada vai pra `contratos` ainda. Estratégia simples para evitar 5 tabelas novas:
- Adicionar coluna **`dados_proposta jsonb`** (nullable) em `pipeline_contratos` via migration.
- Salvar todo o bloco de campos detalhados (acomodação, coparticipação, vidas, titulares[], endereço, etc.) dentro desse JSON.
- Os campos já existentes da tabela (`cliente`, `tipo`, `operadora_id`, `valor_mensal`, `data_vigencia`, `numero_proposta`, `observacoes`) continuam usados normalmente — `cliente` recebe nome da empresa/PF principal, `valor_mensal` recebe o valor total.
- Quando promover para contrato, o JSON viaja como `observacoes` estruturadas no contrato (ou ignorado, conforme combinado: "só na pipeline").

## 5. Cartão do Kanban
Mostrar resumo enxuto: cliente, operadora, tipo, valor, vidas (se preenchido), data prevista. Detalhes completos no modal de edição.

## 6. Arquivos afetados
- **Migration**: `ALTER TABLE pipeline_contratos ADD COLUMN dados_proposta jsonb;`
- `src/App.tsx` — remover rotas Alertas/Importar
- `src/components/layout/AppSidebar.tsx` — remover itens
- `src/pages/app/Alertas.tsx` — **deletar**
- `src/pages/app/Importar.tsx` — **deletar**
- `src/components/pipeline/PipelineForm.tsx` — reescrever com novo schema completo + correção do bug de criação
- `src/components/pipeline/PipelineCard.tsx` — exibir vidas se houver
- `src/pages/app/Pipeline.tsx` — passar/receber `dados_proposta` no `handleEdit`

Pronto para implementar quando aprovar.
