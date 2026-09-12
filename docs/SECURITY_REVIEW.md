# Revisão de segurança de dependências

Revisão executada em 12 de setembro de 2026.

`expo-doctor` aprovou os 21 checks de compatibilidade do app mobile. O `npm audit --omit=dev` do monorepo ainda reporta 15 avisos (10 moderados e 5 altos):

- os avisos altos passam pelo backend antigo NestJS/Express e pelo `multer` transitivo;
- os moderados passam principalmente pelas ferramentas de configuração/build do Expo e pelo pacote `xcode`, que não participa da execução Android;
- não há aviso crítico;
- a correção automática sugerida pelo npm inclui downgrades incompatíveis (Expo 46 e NestJS 7), portanto não foi aplicada cegamente.

O APK release não declara permissão de internet, armazenamento amplo, sobreposição ou vibração. Isso reduz a superfície do aplicativo instalado, mas não substitui a necessidade de acompanhar atualizações oficiais do Expo e do backend preservado.

Antes de expor novamente a aplicação web antiga à internet, atualize e reavalie NestJS/`multer`. Durante a migração ela deve permanecer limitada às portas locais já configuradas. O aplicativo mobile é distribuído somente como APK gerado e instalado diretamente.
