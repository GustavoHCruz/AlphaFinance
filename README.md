# AlphaFinance

Personal finance management with a NestJS API, a Next.js web app, and PostgreSQL.
Track income, expenses, recurring bills, and investments.

## Requirements

- Docker Engine with Docker Compose, or Docker Desktop

## Run

Copy `.env.example` to `.env`, configure the required values, and run from the repository root:

```bash
docker compose up --build
```

## Local services

| Service           | Address                      |
| ----------------- | ---------------------------- |
| Web               | <http://localhost:3000>      |
| API documentation | <http://localhost:8000/docs> |
| PostgreSQL        | `localhost:5432`             |

These are the default addresses. Local ports can be configured through `WEB_PORT`, `API_PORT`, and `POSTGRES_PORT` in `.env`. Only the web service needs a tunnel: the browser calls `/api` on the web domain, and the web container forwards requests to `http://api:8000` over the Docker network. No public URLs need to be configured in the application.

All published ports are bound to `127.0.0.1`.

Stop the application while preserving its data:

```bash
docker compose down
```

Remove the application and all persisted data:

```bash
docker compose down --volumes
```
