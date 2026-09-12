# Privacidade

O AlphaFinance mobile foi projetado para processar dados financeiros no próprio aparelho.

- Não usa analytics, telemetria ou crash reporting remoto.
- Não envia movimentações a servidor, agregador financeiro ou API bancária.
- Não armazena credenciais bancárias.
- O acesso às notificações Android é opcional, concedido nas configurações do sistema e restrito à criação local de candidatos para revisão.
- O texto bruto das notificações não é persistido.
- Backups são criptografados localmente antes de serem entregues ao seletor de arquivos do sistema.
- A senha do backup não é guardada e não pode ser recuperada pelo projeto.

O aplicativo funciona integralmente sem internet. Provedores de arquivos escolhidos pelo usuário, como Google Drive ou futuramente iCloud Drive, recebem apenas o arquivo já criptografado.
