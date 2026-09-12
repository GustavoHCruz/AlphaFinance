# Migração segura do histórico anterior

## Estado preservado

O Docker antigo deve continuar ativo durante a validação. Há um dump PostgreSQL completo em `backups/alphafinance-postgres-2026-09-12.dump`, acompanhado do SHA-256 registrado durante a criação. A pasta `backups/` é ignorada pelo Git para não publicar dados financeiros.

## Exportar novamente

```powershell
npm run legacy:export-mobile
```

O exportador conecta ao PostgreSQL em transação somente leitura e cria `backups/alphafinance-mobile-import-<data>.json`. Ele converte perfil, categorias/etiquetas, recorrências, movimentações e configuração dos meses para o snapshot v1. Contas, cartões e Inbox começam vazios porque não existiam no modelo anterior.

## Importar no Android

1. Copie o JSON exportado para um local visível ao telefone ou ao emulador.
2. No app, abra **Organizar e proteger → Importar histórico antigo**.
3. Escolha o JSON. O app valida formato, versão, IDs e referências antes de substituir o SQLite.
4. Confira totais, meses, recorrências e saldo anterior.
5. Crie um backup criptografado do app mobile em **Criar backup**.

Não remova banco, volumes, Compose ou aplicação web até essa conferência terminar. A importação pode ser repetida a partir de um novo arquivo enquanto o sistema anterior estiver preservado.
