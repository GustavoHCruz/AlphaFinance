# AlphaFinance

Aplicativo mobile local-first de controle financeiro pessoal. A versão 1.0 funciona integralmente offline no Android: cada instalação mantém seus próprios dados em SQLite e não depende de API, servidor ou conta online.

## O que está incluído

- Receitas, despesas, contas e investimentos.
- Recorrências mensais editáveis.
- Categorias e etiquetas configuráveis por tipo de movimentação.
- Saldo do mês anterior transportado automaticamente.
- Resumo mensal, fluxo de seis meses e distribuição de gastos por categoria.
- Inbox para revisar sinais financeiros antes de criar uma movimentação.
- Captura opcional de notificações do Banco Inter pelo recurso oficial do Android.
- Backup e restauração criptografados pelo seletor de arquivos do sistema, incluindo provedores como Google Drive.

## Arquitetura

```text
UI React Native
      ↓
domínio financeiro em TypeScript
      ↓
interfaces de repositories
      ↓
SQLite local

providers → FinancialEvent → Inbox → revisão → movimentação
SQLite → snapshot validado → AES-256-GCM → arquivo escolhido pelo usuário
```

O SQLite é a única fonte de verdade. O domínio não depende de React Native, Android ou SQLite. O banco usa migrations incrementais por `PRAGMA user_version`; valores monetários são armazenados em centavos.

O módulo Android usa `NotificationListenerService` somente após autorização explícita. O parser do Banco Inter é separado do listener e o texto bruto das notificações não é persistido. A capacidade é opcional e não impede o uso manual ou uma futura versão iOS.

Os backups usam AES-256-GCM com chave derivada por PBKDF2-HMAC-SHA-256. O arquivo é validado antes da restauração e a senha não é armazenada pelo aplicativo.

## Desenvolvimento Android

Ambiente validado: Node.js 24, JDK 17, Android SDK/Platform 36 e Android Build Tools 36.

```powershell
npm install
npm run mobile:typecheck
npm run mobile:test
npm run test:native:android --workspace apps/mobile
npm run mobile:android
```

Para regenerar o projeto Android e criar o APK release:

```powershell
npm run prebuild:android --workspace apps/mobile
npm run mobile:apk
```

O APK é gerado em `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. A cópia distribuível pode ser colocada em `dist/`, que não é versionada; para um GitHub Release, anexe o APK manualmente à versão publicada.

Para usar um aparelho, habilite as opções do desenvolvedor e a depuração USB, conecte-o e confirme com `adb devices`. Depois execute:

```powershell
npm run android:device --workspace apps/mobile
```

## Assinatura das versões

A versão 1.0 e suas futuras atualizações devem ser assinadas com a chave oficial mantida fora do repositório em `%USERPROFILE%\Documents\AlphaFinance-signing`. A variável de usuário `ALPHAFINANCE_SIGNING_PROPERTIES` aponta para o arquivo `signing.properties` dessa pasta.

Faça backup privado da pasta inteira. Nunca envie a chave ou o `signing.properties` ao GitHub. Sem eles, o Android não aceitará uma nova versão como atualização do aplicativo instalado.

Antes de gerar uma nova versão:

1. Atualize `version` e incremente `android.versionCode` em `apps/mobile/app.json`.
2. Execute os testes, o `expo-doctor` e gere o APK release.
3. Instale o APK como atualização em um aparelho com dados reais de teste.
4. Confirme backup, restauração, Inbox e inicialização offline.

O SHA-256 do APK é opcional e serve apenas para conferir se o arquivo distribuído não foi alterado.

## Direção para futuras iterações

- Preservar migrations e compatibilidade de backup ao evoluir o banco.
- Manter UI, domínio e repositories compartilháveis com iOS.
- Tratar o listener de notificações como capacidade exclusiva e opcional do Android.
- Adicionar novos parsers/providers sem acoplá-los ao Inbox, como CSV ou outras instituições.
- Continuar sem analytics, telemetria, backend obrigatório ou permissões amplas.

Consulte a [política de privacidade](PRIVACY.md) antes de introduzir dependências ou integrações.
