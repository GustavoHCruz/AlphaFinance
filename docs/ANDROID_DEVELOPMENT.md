# Desenvolvimento Android no Windows

## Ambiente configurado

- Node.js 24.14.1 e npm 11.11.0.
- Microsoft OpenJDK 17.0.20.1 LTS em `%LOCALAPPDATA%\Programs\Microsoft\jdk-17.0.20.1+1`.
- Android Studio 2026.1.4 em `%LOCALAPPDATA%\Programs\Android\android-studio`.
- Android SDK em `%LOCALAPPDATA%\Android\Sdk`.
- Platform Tools/adb 37.0.1, Android Platform 36, Build Tools 35/36, Emulator, CMake e NDK compatível com React Native.
- Emulador `AlphaFinance_API_36`.

`JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT` e os caminhos de ferramentas foram gravados no ambiente do usuário. Feche e reabra terminais já existentes para que eles recebam os novos valores.

## Comandos usuais

```powershell
npm run mobile:typecheck
npm run mobile:test
npm run test:native:android --workspace apps/mobile
npm run mobile:android
```

Para gerar o projeto Android novamente depois de alterar configuração nativa:

```powershell
npm run prebuild:android --workspace apps/mobile
```

Para um APK instalável e independente do servidor de desenvolvimento:

```powershell
npm run android:apk --workspace apps/mobile
```

O APK validado nesta etapa está em `dist/AlphaFinance-android-0.1.1.apk`. Ele é um pacote pessoal para instalação direta e compartilhamento manual. Todo APK Android precisa de uma assinatura técnica; atualmente o projeto usa a chave de desenvolvimento local.

SHA-256 do pacote validado: `B986EB2A2C58427E50ABD93B90EAED83FDE62A562F29087983A8E8C621725F6B`.

## Usar um celular por USB

Estas são as únicas ações necessárias no aparelho:

1. Em **Configurações → Sobre o telefone**, toque sete vezes em **Número da versão** para habilitar as opções do desenvolvedor.
2. Em **Opções do desenvolvedor**, habilite **Depuração USB**.
3. Conecte um cabo de dados e confirme no telefone a impressão digital RSA deste computador. Marque “Sempre permitir” somente se este for um computador confiável.
4. Execute `adb devices`; o aparelho deve aparecer como `device`. Depois use `npm run android:device --workspace apps/mobile`.

No Android 11 ou superior, também é possível habilitar **Depuração sem fio** nas opções do desenvolvedor. Telefone e computador devem estar na mesma rede. Use os endereço/código exibidos pelo aparelho com `adb pair ENDERECO:PORTA` e depois `adb connect ENDERECO:PORTA`.

Para receber candidatos do Banco Inter, abra **Organizar e proteger → Configurar acesso** dentro do AlphaFinance e habilite o acesso a notificações para o app. Essa permissão é opcional e pode ser revogada a qualquer momento.
