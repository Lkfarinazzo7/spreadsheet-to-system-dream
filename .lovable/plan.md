## Objetivo
Ao abrir um card da Pipeline ou um contrato, ter um botão que copia todas as informações do cliente para a área de transferência com um clique.

## O que será feito

1. **Novo utilitário `src/lib/copiarInformacoes.ts`**
   - Função que recebe os dados da proposta/contrato e devolve um texto organizado, pronto para colar no WhatsApp/e-mail.
   - Formato:
     ```text
     CLIENTE: Sarmento e Moreira
     Nº da proposta: 12345
     Tipo: PJ | Operadora: Amil | Canal: Corretora X
     Valor mensal: R$ 1.234,56
     Vigência: 05/05/2026 | Reajuste: 05/05/2027
     Acomodação: Enfermaria | Coparticipação: Sim

     TITULARES
     1. Nome — CPF 000.000.000-00 — Nasc. 01/01/1990 — Tel (00) 00000-0000
        Dependentes: Pedro (Filho) — CPF ... — Nasc. ...

     OBSERVAÇÕES
     ...
     ```
   - Campos vazios são omitidos, para não copiar linhas em branco.

2. **`src/components/pipeline/PipelineForm.tsx`**
   - Botão "Copiar informações" (ícone de cópia) no rodapé do diálogo, junto dos botões de e-mail.
   - Copia os dados atuais do formulário (incluindo edições não salvas) e mostra um toast "Informações copiadas".

3. **`src/components/contratos/ContratoForm.tsx`**
   - Mesmo botão no rodapé do diálogo, usando o mesmo utilitário, com os dados do contrato (inclui status e etapa quando existir).

## Detalhes técnicos
- Cópia via `navigator.clipboard.writeText`, com fallback para `document.execCommand("copy")` em contextos sem permissão.
- Reuso das funções `formatCurrency` / `formatDate` de `src/lib/format.ts`.
- Nomes de operadora/canal resolvidos a partir das listas de lookup já carregadas nos formulários.
- Nenhuma mudança de banco de dados.
