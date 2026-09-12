# AlphaFinance

O AlphaFinance está migrando para um aplicativo mobile local-first. O app Android em `apps/mobile` usa React Native, TypeScript e SQLite, funciona sem servidor e mantém cada instalação independente.

A aplicação web anterior (`apps/web` + `apps/api` + PostgreSQL) permanece preservada durante a migração. Não remova os volumes Docker antes de validar o histórico no Android.

## Aplicativo Android

```powershell
npm install
npm run mobile:typecheck
npm run mobile:test
npm run mobile:android
```

O guia completo do ambiente, emulador e aparelho físico está em [docs/ANDROID_DEVELOPMENT.md](docs/ANDROID_DEVELOPMENT.md). A arquitetura e as decisões de privacidade estão em [docs/MOBILE_ARCHITECTURE.md](docs/MOBILE_ARCHITECTURE.md).
Os avisos atuais de dependências e seu impacto estão registrados em [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md).

## Migrar o histórico existente

Com o PostgreSQL antigo em execução:

```powershell
npm run legacy:export-mobile
```

O arquivo JSON gerado em `backups/` pode ser escolhido em **Organizar e proteger → Importar histórico antigo** no aplicativo. Veja [docs/MIGRATION.md](docs/MIGRATION.md).

## Aplicação web preservada

```powershell
docker compose up --build
```

As portas efetivas vêm do `.env`; nesta máquina, web, API e PostgreSQL estão publicados apenas em `127.0.0.1`. A auditoria funcional do produto anterior está em [docs/CURRENT_SYSTEM_AUDIT.md](docs/CURRENT_SYSTEM_AUDIT.md).
