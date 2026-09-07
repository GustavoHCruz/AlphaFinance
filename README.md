# AlphaFinance

Controlador financeiro pessoal com entradas, gastos, contas mensais recorrentes, investimentos, categorias, labels e gráficos. Interface em português e inglês, configurações de idioma e moeda, sem login.

## Executar

Com Docker e Docker Compose instalados e em execução:

```sh
docker compose up -d --build
```

- Aplicação: http://localhost:3100 (ajustável por `WEB_PORT` no `.env`).
- API / Swagger: http://localhost:3001/docs (a raiz redireciona para `/docs`).

O PostgreSQL é persistido em um volume Docker. Para parar: `docker compose down`. Não use `down -v` se quiser preservar os dados. Opcionalmente copie `.env.example` para `.env` e ajuste as credenciais antes da primeira execução.

`apps/api/src`: NestJS + TypeORM, migrations e resources com models, services e controllers. `apps/web/src`: Next.js, componentes e traduções. Portas acessíveis somente no próprio computador, sem autenticação.

Contas mensais compartilham o valor esperado na série; ao concluir, informe o valor efetivamente pago naquele mês. O saldo disponível desconta somente as contas pagas. Investimentos reservam o valor esperado até a confirmação do valor efetivamente guardado. Ative o saldo anterior em cada mês para incluí-lo como primeira entrada automática. Categorias e labels podem ser ordenadas e copiadas entre tipos. Gastos do dia a dia não têm repetição. Investimentos podem ser fixos ou um percentual das entradas totais (incluindo saldo anterior) ou de uma categoria de receita. A moeda altera a exibição, sem conversão.
