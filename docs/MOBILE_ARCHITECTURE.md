# Arquitetura mobile local-first

## Visão geral

```text
UI React Native
      ↓
casos de uso e domínio financeiro (TypeScript puro)
      ↓
interfaces de repositories
      ↓
SQLite local

providers → FinancialEvent → Inbox PENDING → revisão → Transaction
SQLite → snapshot validado → AES-256-GCM → arquivo escolhido pelo usuário
```

O SQLite é a única fonte de verdade do aplicativo. Não existe chamada ao backend antigo no código mobile. Regras financeiras em `src/domain` não importam SQLite, React Native nem código Android.

## Persistência

`expo-sqlite` abre `alphafinance.db` com chaves estrangeiras, WAL e timeout de concorrência. `PRAGMA user_version` controla migrations exclusivas e incrementais.

O schema mobile contém perfil, classificações, recorrências, movimentações, parcelas, configurações mensais, estado de providers e eventos do Inbox. Dinheiro permanece em centavos. Não existe cadastro separado de conta bancária ou cartão; “conta” é o tipo financeiro usado para obrigações mensais a pagar.

## Inbox e providers

`FinancialEvent` possui origem, identificador deduplicável, instituição, dados sugeridos, confiança e estado `PENDING`, `ACCEPTED` ou `IGNORED`. Aceitar sempre abre o editor; informações incompletas devem ser preenchidas antes de criar uma movimentação.

O contrato não depende de banco. As origens previstas são manual, notificação Android, CSV, importação legada e providers futuros.

O módulo Android usa somente `NotificationListenerService`, mediante concessão explícita na tela de ajustes do sistema. O listener extrai o texto em memória, entrega-o ao parser separado do Inter e persiste apenas um candidato estruturado quando existe valor útil. O texto bruto da notificação não é armazenado. Pacote, chave e horário formam um hash para deduplicação; a fila privada é limitada.

## Backup e restauração

O snapshot lógico v1 é JSON portável entre plataformas. Antes de sair do app ele é criptografado no módulo nativo com AES-256-GCM, chave derivada por PBKDF2-HMAC-SHA-256 (600.000 iterações), salt aleatório de 16 bytes e nonce aleatório de 12 bytes. A senha não é armazenada.

No Android, o Storage Access Framework permite escolher uma pasta provida pelo sistema, incluindo armazenamento local ou um provedor instalado como Google Drive, sem conceder acesso geral à conta. Na restauração, o arquivo é decifrado, validado por schema e integridade referencial e somente depois importado em transação. Antes da substituição, o app grava uma cópia de recuperação criptografada dentro de seu diretório privado; ela não sai do aparelho.

## Privacidade e dependências

Não foram adicionados analytics, crash reporting remoto, telemetria, agregadores financeiros ou SDK do Google Drive. O manifesto do APK bloqueia as permissões de internet, armazenamento amplo, sobreposição e vibração; o acesso a arquivos ocorre pelo seletor do sistema. O backup automático do Android também fica desabilitado, evitando que o banco privado seja enviado sem a escolha explícita do usuário. Expo/React Native, SQLite, seletor de documentos, sistema de arquivos, crypto, Zod, ícones, área segura e SVG são usados localmente; nenhuma dessas integrações é configurada para enviar movimentações.

O acesso global às notificações é uma capacidade exclusivamente Android e opcional. Todo o domínio, banco, UI, Inbox genérico e formato de backup permanecem compartilháveis com uma futura implementação iOS.
