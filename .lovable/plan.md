# Ajustes nos e-mails de Elaboração e Antecipação

## E-mail de Elaboração (`src/lib/elaboracaoEmail.ts`)

1. **Remover o bloco de observação no final.** Hoje a última linha sempre imprime `form.observacoes` ou o fallback "Obs: A declaração de permanência ficará pronta em 2 dias úteis" — apagar as duas linhas finais que geram isso.
2. **Assunto sempre com o nome principal do cadastro (razão social / cliente), sem CPF do titular.**
   - Trocar `titularNome` por `form.cliente` no assunto.
   - Remover `titularCpf` do assunto: novo formato = `Elaboração <operadora> <cliente>`.

## E-mail de Antecipação (`src/lib/antecipacaoEmail.ts`)

1. **Assunto sempre com o nome do cliente/razão social, sem CPF.**
   - Novo formato: `Antecipação <operadora> <cliente>`.
2. **Substituir "código na planilha" por linha "Proposta".**
   - Remover o sufixo `(código na planilha é o <numero>)` da linha do plano.
   - Adicionar linha própria logo abaixo do "Plano": `Proposta: <form.numero_proposta>` (só imprime se existir).
3. **Acrescentar os beneficiários** (titulares e dependentes), no mesmo estilo do e-mail de Elaboração:
   - Bloco "Dados do Representante" com nome, e-mail, telefone e plano anterior do primeiro titular.
   - Sub-bloco "Dependentes" com nome, grau de parentesco e plano anterior de cada dependente.
   - Se houver titulares adicionais, incluir bloco "Titular N" para cada um, com os mesmos campos e respectivos dependentes.
   - Manter os campos administrativos existentes (Acomodação, Modalidade, CNPJ/CPF, Razão social, Endereço) antes do bloco de beneficiários.

## Fora de escopo
- Nenhuma mudança em UI, banco ou nos disparadores do e-mail — só o conteúdo gerado pelos dois builders.