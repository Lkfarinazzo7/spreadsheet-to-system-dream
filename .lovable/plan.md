
# Sistema de Gestão para Corretor de Planos de Saúde e Odontológicos

Substituirá as 3 planilhas (Dados Gerais, Saúde/Dental Fechados, Financeiro) por um sistema integrado, moderno e responsivo.

## 🎯 Contexto entendido
Você é corretor de planos de saúde/odonto. Hoje controla em Excel:
- Contratos fechados (PJ, PF, Adesão) por operadora (Amil, Bradesco, Porto Seguro, Assim Saúde, MedSenior…)
- Canais de venda (Cliente Antigo, Indicação, Prospecção Outbound Advogados/UFRJ…)
- Recebimentos e parcelas de comissão (Bancária, Vida, Adesão)
- Comissão prevista vs. recebida (com proporção, ex: 3,8x o valor mensal)
- Despesas operacionais (CRM/Pipe etc.)

## 🧩 Módulos do sistema

### 1. Dashboard (home)
- Cards: Receita do mês, Comissão a receber, Comissão recebida, Contratos ativos, Ticket médio
- Gráfico de comissão mês a mês (previsto x realizado)
- Distribuição por operadora (donut)
- Performance por canal de venda (barras)
- Próximos vencimentos (lista)

### 2. Contratos / Vendas Fechadas
- Tabela com filtros: operadora, canal, tipo (PJ/PF/Adesão), categoria, vigência, status
- Cadastro/edição com campos: nº proposta, nomenclatura (cliente), tipo, canal, operadora, categoria do plano, valor mensal, data de vigência
- Página de detalhe do contrato com aba de comissões geradas
- Busca rápida e exportação

### 3. Financeiro – Comissões a Receber
- Lançamentos de parcelas (1, 2, 3, 4) com tipo (Bancária / Vida / Adesão)
- Mês previsto, data de pagamento, valor, status PAGO?
- Marcar como pago em 1 clique → atualiza dashboard
- Filtro por mês, operadora, status

### 4. Financeiro – Comissão Total (Previsto vs Recebido)
- Visão consolidada por contrato: valor mensal × proporção = comissão prevista
- Comparativo automático recebido vs previsto + % atingido
- Indicador visual quando há desvio

### 5. Despesas
- Cadastro simples (descrição, categoria, valor, data, pago?)
- Categorias customizáveis (CRM, Marketing, etc.)
- Total por mês e por categoria

### 6. Alertas e Vencimentos
- Parcelas a vencer nos próximos 7/30 dias
- Comissões em atraso
- Contratos próximos da renovação anual
- Badge no menu + página dedicada

### 7. Relatórios
- Relatório mensal financeiro (receita, despesa, lucro)
- Relatório por operadora / canal / período
- Exportação em **Excel (.xlsx)** e **PDF**

### 8. Importador de planilhas
- Upload das 3 planilhas atuais (.xlsx)
- Preview + mapeamento de colunas
- Importação em lote para popular o sistema sem retrabalho

### 9. Cadastros auxiliares
- Operadoras, Categorias de plano, Canais de venda, Tipos de contrato — editáveis para evoluir com o negócio

## 🔐 Acesso e dados
- Login pessoal (e-mail/senha) — usuário único
- Backend com Lovable Cloud (banco de dados seguro, dados privados por usuário)
- Backups automáticos

## 🎨 Design
- Estilo **moderno SaaS** (cards, tipografia clean, microinterações)
- Layout com sidebar fixa + área principal
- Cores: paleta neutra com acento azul/verde para indicadores financeiros positivos e vermelho/âmbar para alertas
- Totalmente responsivo (desktop principal, mas usável no mobile)
- Light mode por padrão (dark mode pode vir depois)

## 🚀 Ordem de entrega na 1ª implementação
1. Estrutura, autenticação, banco de dados e cadastros auxiliares
2. Módulo de Contratos (CRUD + listagem + filtros)
3. Módulo Financeiro (comissões + despesas + previsto vs recebido)
4. Dashboard com indicadores e gráficos
5. Alertas/Vencimentos
6. Importador das planilhas existentes
7. Exportação Excel/PDF e Relatórios
