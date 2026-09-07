const fs=require('fs');
const p='apps/web/src/lib/i18n.ts'; let s=fs.readFileSync(p,'utf8');
s=s.replace(/    saved: 'Acumulado',\r?\n/,'');
const pos=s.lastIndexOf("    saved: 'Saved',");s=s.slice(0,pos)+s.slice(pos).replace(/    saved: 'Saved',\r?\n/,'');
const n=s.lastIndexOf("profileSubtitle: 'Escolha o idioma e a moeda da aplicação.'");s=s.slice(0,n)+s.slice(n).replace('Escolha o idioma e a moeda da aplicação.','Choose your language and currency.');
fs.writeFileSync(p,s);
const readme='README.md';fs.writeFileSync(readme,fs.readFileSync(readme,'utf8').replace('perfil com nome e foto','configurações de idioma e moeda').replace('O saldo usa a previsão nas pendentes e o pagamento nas concluídas.','O saldo disponível desconta somente as contas pagas. Investimentos reservam o valor esperado até a confirmação do valor efetivamente guardado.'));
