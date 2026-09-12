# Auditoria funcional da aplicação anterior

Esta auditoria registra o comportamento que serviu de referência para a migração mobile. A aplicação antiga não foi removida nem teve seus dados alterados intencionalmente.

## Arquitetura encontrada

- Frontend Next.js/React em `apps/web`, com páginas de visão geral, contas, investimentos, movimentações, organização e configurações.
- Backend NestJS em `apps/api`, expondo CRUD e cálculos financeiros.
- TypeORM com PostgreSQL. O schema é evoluído por migrations.
- Docker Compose executa web, API e banco. Não há autenticação: é uma instalação pessoal.
- Perfil contém somente localidade e moeda. Não há analytics ou serviço externo de dados financeiros no código auditado.

## Modelo e regras preservadas

Os valores monetários são inteiros em centavos. O sistema distingue receita, despesa, conta e investimento. Categorias e etiquetas têm cor, tipo financeiro e ordenação.

Receitas podem ser negativas para registrar ajustes; os demais tipos exigem valor não negativo. Investimentos não usam categoria comum, mas podem usar etiquetas. Contas e investimentos guardam valor previsto e realizado, permitindo pendência. Uma conta ainda não paga não diminui o saldo disponível.

Receitas, contas e investimentos podem ser mensais. Ao abrir um mês, o sistema materializa a ocorrência daquele período. Exclusões recorrentes usam tombstones para não reaparecerem. A edição de uma recorrência atualiza sua definição e a classificação das ocorrências futuras; o encerramento preserva o histórico anterior.

Investimentos percentuais calculam uma estimativa sobre toda a renda ou sobre uma categoria de renda. O valor estimado é recalculado quando o mês muda. A opção de saldo anterior cria uma entrada técnica única para o mês seguinte.

O dashboard apresenta saldo, receitas, despesas, contas pendentes, investimentos e seis meses de histórico. A versão web também exporta movimentações em CSV.

## Entidades anteriores

- `profiles`: localidade e moeda.
- `tags`: categorias ou etiquetas, ligadas a um tipo financeiro.
- `recurrences` e etiquetas associadas.
- `entries` e etiquetas associadas, incluindo previsto/realizado, recorrência, estimativa e saldo anterior.
- `month_settings`: opção de transportar o saldo anterior.

Contas bancárias e cartões não existiam como entidades. Após a revisão do escopo, também não fazem parte do modelo mobile; “conta” no produto continua significando uma obrigação mensal a pagar.

## Fluxos de interface

A aplicação web concentra a visão mensal e usa formulários/modais para criar e editar movimentações. Há filtros por tipo, confirmação de pagamento/aplicação, gestão de recorrências e organização de categorias/etiquetas. A identidade usa tons verdes, dourados e superfícies claras; a versão mobile mantém essa linguagem, adaptada para navegação inferior, ações rápidas e revisão do Inbox.
