# Corretor SaaS

Sistema administrativo para acompanhar propostas em elaboração, implantar contratos e controlar comissões, despesas e relatórios financeiros.

## Desenvolvimento

Requisitos: Node.js 20.19 ou superior e um projeto Supabase configurado.

```sh
npm ci
npm run dev
```

Validação completa antes de publicar:

```sh
npm run check
```

## Banco e funções

As mudanças de banco ficam em `supabase/migrations`. Aplique as migrations no projeto Supabase antes de publicar uma versão que dependa delas e implante novamente a função `pipeline-parse` quando ela for alterada.

O cadastro público também deve permanecer desativado no painel do Supabase em Authentication. Nunca salve tokens pessoais ou chaves privadas no repositório; o front-end deve conter apenas a chave pública/anônima do projeto.
