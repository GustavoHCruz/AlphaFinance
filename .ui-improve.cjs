const fs=require('fs'); function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')))}
edit('apps/web/src/components/finance-app.tsx',s=>{
 s=s.replace('  ArrowUp,\n  ArrowDown,\n','').replace('  Bell,\n','').replace('  UserRound,\n','').replace('ProfileForm','SettingsForm');
 s=s.replace("import { Modal } from './modal';", "import { Modal } from './modal';\nimport { TagSorter } from './tag-sorter';");
 s=s.replace("'bills' | 'organize'", "'bills' | 'investment' | 'organize'");
 s=s.replace("  { id: 'transactions', icon: ArrowLeftRight },\n  { id: 'bills', icon: ReceiptText },", "  { id: 'bills', icon: ReceiptText },\n  { id: 'investment', icon: TrendingUp },\n  { id: 'transactions', icon: ArrowLeftRight },");
 s=s.replace("          : error instanceof Error && error.message === 'PAID_AMOUNT_REQUIRED'", "          : error instanceof Error && error.message === 'ACTUAL_INVESTMENT_REQUIRED' ? t.actualInvestmentRequired\n          : error instanceof Error && error.message === 'PAID_AMOUNT_REQUIRED'");
 const moveStart=s.indexOf('  function moveTag('), moveEnd=s.indexOf('  useEffect(',moveStart); s=s.slice(0,moveStart)+s.slice(moveEnd);
 const headerStart=s.indexOf('        <header'), headerEnd=s.indexOf('        <main>',headerStart);
 s=s.slice(0,headerStart)+`        <button className="icon-button mobile-toggle mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label={t.menu}><Menu size={22} /></button>
`+s.slice(headerEnd);
 s=s.replace("  const pending = bills.filter((e) => !e.done);", `  const investments = data?.entries.filter(e => e.kind === 'investment').sort((a,b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description)) || [];
  const trackingPage = page === 'bills' || page === 'investment';
  const tracked = page === 'investment' ? investments : bills;
  const pending = bills.filter((e) => !e.done);`);
 s=s.replace("(page === 'bills' ? bills : data?.entries)","(trackingPage ? tracked : data?.entries)").replace("(page !== 'bills' || e.kind === 'bill') &&", "");
 s=s.replaceAll("page === 'bills' ? 'bill' : undefined", "page === 'bills' ? 'bill' : page === 'investment' ? 'investment' : undefined");
 s=s.replaceAll("page === 'bills' ? 'bill' : 'expense'", "page === 'bills' ? 'bill' : page === 'investment' ? 'investment' : 'expense'");
 s=s.replace("{page === 'bills' ? t.newBill : t.newExpense}", "{page === 'bills' ? t.newBill : page === 'investment' ? t.newInvestment : t.newExpense}");
 s=s.replace("                  : page === 'bills'", "                  : page === 'investment' ? t.investmentSubtitle\n                  : page === 'bills'");
 s=s.replaceAll("e.kind === 'bill' ? (", "(e.kind === 'bill' || e.kind === 'investment') ? (");
 s=s.replace("<th>{t.category}</th>", "{page !== 'investment' && <th>{t.category}</th>}").replace("{!compact && <th>{t.method}</th>}","{!compact && page !== 'investment' && <th>{t.method}</th>}");
 s=s.replace('                  <td>\n                    <span\n                      className="category-chip"', '                  {page !== \'investment\' && <td>\n                    <span\n                      className="category-chip"');
 s=s.replace('                  </td>\n                  {!compact && (\n                    <td>\n                      <div className="table-labels">', '                  </td>}\n                  {!compact && (\n                    <td>\n                      <div className="table-labels">');
 s=s.replace("{!compact && (\n                    <td className=\"muted\">{e.isCarryover ? '—' : t[e.method as 'pix']}</td>", "{!compact && page !== 'investment' && (\n                    <td className=\"muted\">{e.isCarryover || e.kind === 'investment' ? '—' : t[e.method as 'pix']}</td>");
 const start=s.indexOf('                    <section className="panel">',s.indexOf('<div className="overview-lists">'));
 const end=s.indexOf('                    <section className="panel">',start+20);
 s=s.slice(0,start)+`                    <div className="tracking-grid">
                      {trackingList(bills, false)}
                      {trackingList(investments, true)}
                    </div>
`+s.slice(end);
 s=s.replace("{(page === 'transactions' || page === 'bills') && (", "{(page === 'transactions' || trackingPage) && (");
 const summaryStart=s.indexOf("                  {page === 'bills' && (\n                    <div className=\"bill-summary\">");
 const summaryEnd=s.indexOf('                  <section className="panel">',summaryStart);
 s=s.slice(0,summaryStart)+`                  {trackingPage && <div className="bill-summary">
                    <div><span>{t.plan}</span><strong>{money(tracked.reduce((sum,e) => sum + (e.expectedAmount ?? e.amount),0))}</strong></div>
                    <div><span>{page === 'investment' ? t.savedAmount : t.paid}</span><strong className="positive">{money(tracked.filter(e => e.done).reduce((sum,e) => sum + e.amount,0))}</strong></div>
                    <div><span>{t.pending}</span><strong>{money(tracked.filter(e => !e.done).reduce((sum,e) => sum + e.amount,0))}</strong></div>
                    <div className="bill-completion"><span>{tracked.filter(e => e.done).length} / {tracked.length} {t.completed}</span>
                      <div className="progress-track"><i style={{width: tracked.length ? (tracked.filter(e => e.done).length / tracked.length * 100) + '%' : '0%'}} /></div>
                    </div>
                  </div>}
`+s.slice(summaryEnd);
 s=s.replace('                      <select\n                        aria-label={t.category}', "                      {page !== 'investment' && <select\n                        aria-label={t.category}");
 s=s.replace('                      </select>\n                      <select\n                        aria-label={t.labels}', '                      </select>}\n                      <select\n                        aria-label={t.labels}');
 s=s.replace("{page === 'bills' && (\n                        <select", "{trackingPage && (\n                        <select");
 s=s.replaceAll("(page !== 'bills' || r.kind === 'bill')", "(!trackingPage || r.kind === (page === 'investment' ? 'investment' : 'bill'))");
 s=s.replace("{(['category', 'label'] as const).map((type) => (", "{(['category', 'label'] as const).filter(type => tagKind !== 'investment' || type === 'label').map((type) => (");
 const ts=s.indexOf('                        <div className="tag-list">'); const te=s.indexOf('                      </section>',ts);
 s=s.slice(0,ts)+`                        <TagSorter tags={data.tags.filter(tag => tag.type === type && tag.kind === tagKind)} busy={busy} t={t}
                          reorder={ids => void save('tags/order', 'PUT', {type, kind: tagKind, ids})}
                          actions={tag => <>
                            <button className="icon-button" disabled={busy} title={t.copyTag} aria-label={t.copyTag + ': ' + tag.name} onClick={() => open({type:'copy',tag})}><Copy size={15} /></button>
                            <button className="icon-button" aria-label={t.edit + ': ' + tag.name} onClick={() => open({type:'tag',tagType:type,tag})}><Pencil size={15} /></button>
                            <button className="icon-button delete-button" aria-label={t.remove + ': ' + tag.name} onClick={() => open({type:'delete',path:'tags/' + tag.id})}><Trash2 size={15} /></button>
                          </>} />
`+s.slice(te);
 s=s.replace('                  notify={setNotice}\n','');
 s=s.replace('                  ? t.completeBill', "                  ? dialog.entry.kind === 'investment' ? t.completeInvestment : t.completeBill");
 const renderAt=s.indexOf('  function entryTable(');
 s=s.slice(0,renderAt)+`  function trackingList(rows: Entry[], investment: boolean) {
    return <section className="panel tracking-panel">
      <div className="panel-heading"><h2>{investment ? t.trackInvestments : t.upcoming}</h2><span className="count-pill">{rows.length}</span></div>
      <div className="tracking-scroll"><div className="tracking-list">
        {rows.map(e => <div className={\`tracking-row \${e.done ? 'is-complete' : ''}\`} key={e.id}>
          <button className={\`bill-check \${e.done ? 'checked' : ''}\`} aria-label={\`\${e.done ? t.pending : t.done}: \${e.description}\`} aria-pressed={e.done} disabled={busy} onClick={() => toggleBill(e)}>{e.done && <Check size={15} />}</button>
          <strong className="tracking-name" title={e.description}>{e.description}</strong>
          <time dateTime={e.date}>{formatDate(e.date)}</time>
          <span className="tracking-status">{e.done ? (investment ? t.saved : t.paid) : t.pending}</span>
          <span className="tracking-value"><small>{e.done ? investment ? t.saved : t.paidShort : t.expectedShort}</small><strong>{money(e.amount)}</strong></span>
        </div>)}
        {!rows.length && <p className="empty-inline">{investment ? t.noTrackedInvestments : t.noTrackedBills}</p>}
      </div></div>
      <div className="panel-footer"><span>{t.pending}</span><strong>{money(rows.filter(e => !e.done).reduce((sum,e) => sum + e.amount,0))}</strong></div>
    </section>;
  }
`+s.slice(renderAt);
 return s;
});
edit('apps/web/src/lib/i18n.ts',s=>s.replace("    settings: 'Meu perfil'", "    settings: 'Configurações'").replace("    settings: 'My profile'", "    settings: 'Settings'")
 .replace("    orderHint: 'Use as setas para definir a ordem nos formulários.'", "    reorder: 'Arrastar para ordenar',\n    trackInvestments: 'Investimentos para acompanhar',\n    savedAmount: 'Valor efetivamente guardado',\n    saved: 'Guardado',\n    expectedShort: 'Esperado',\n    paidShort: 'Pago',\n    completeInvestment: 'Registrar aporte',\n    noTrackedInvestments: 'Nenhum investimento cadastrado neste mês.',\n    investmentSubtitle: 'Planeje seus aportes e acompanhe o valor guardado a cada mês.',\n    actualInvestmentRequired: 'Informe o valor efetivamente guardado para confirmar o aporte.',\n    orderHint: 'Arraste pelos pontinhos para ordenar. No teclado, use as setas para cima e para baixo.'")
 .replace("    orderHint: 'Use the arrows to set the order in forms.'", "    reorder: 'Drag to reorder',\n    trackInvestments: 'Investments to track',\n    savedAmount: 'Amount actually saved',\n    saved: 'Saved',\n    expectedShort: 'Expected',\n    paidShort: 'Paid',\n    completeInvestment: 'Record contribution',\n    noTrackedInvestments: 'No investments registered this month.',\n    investmentSubtitle: 'Plan your contributions and track the amount saved each month.',\n    actualInvestmentRequired: 'Enter the amount actually saved to confirm the contribution.',\n    orderHint: 'Drag the grip to reorder. With a keyboard, use the up and down arrow keys.'")
 .replace("balanceHint: 'Entradas menos contas, gastos e investimentos'", "balanceHint: 'Entradas menos contas pagas, gastos e reservas de investimentos'")
 .replace("balanceHint: 'Income minus bills, expenses and investments'", "balanceHint: 'Income minus paid bills, expenses and investment reserves'")
 .replace("profileSaved: 'Perfil atualizado.'", "profileSaved: 'Configurações atualizadas.'").replace("profileSaved: 'Profile updated.'", "profileSaved: 'Settings updated.'")
 .replace(/profileSubtitle: '[^']*'/g, m=>m.includes('your') || m.includes('Your') ? "profileSubtitle: 'Choose your language and currency.'" : "profileSubtitle: 'Escolha o idioma e a moeda da aplicação.'"));
edit('apps/web/src/components/charts.tsx',s=>s.replace('dot gold','dot flow-income').replace('dot dark','dot flow-expense'));
