const fs = require('fs');
function edit(path, fn) {const s=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n'); fs.writeFileSync(path,fn(s));}
const api='apps/api/src/resources/finance/';
edit(api+'services/finance.service.ts',s=>s
 .replace("dto.kind !== 'bill' && (dto.expectedAmount", "!['bill', 'investment'].includes(dto.kind!) && (dto.expectedAmount")
 .replace('Expected and paid amounts are only for bills','Expected and actual amounts require a bill or investment')
 .replace("if (dto.estimated && (dto.kind !== 'investment' || dto.percentageBps == null))", "if (dto.estimated && dto.kind !== 'investment')")
 .replace('Estimates require a percentage investment','Estimates require an investment')
 .replace('r."percentageBps" IS NOT NULL, CASE WHEN r.kind = \'bill\' THEN r.amount ELSE NULL END', "r.kind = 'investment', CASE WHEN r.kind IN ('bill', 'investment') THEN r.amount ELSE NULL END")
 .replace('await em.update(Entry, entry.id, { amount });\n        entry.amount = amount;', 'await em.update(Entry, entry.id, { amount, expectedAmount: amount });\n        entry.amount = amount;\n        entry.expectedAmount = amount;')
 .replace("rows.reduce((sum, e) => sum + (e.kind === 'income' ? e.amount : -e.amount), 0)", "rows.reduce((sum, e) => sum + (e.kind === 'income' ? e.amount : e.kind === 'bill' && !e.done ? 0 : -e.amount), 0)")
 .replace('remaining: income - expenses - bills - invested','remaining: income - expenses - (bills - unpaid) - invested')
 .replace('fields.estimated = dto.percentageBps != null ? (dto.estimated ?? true) : false;', "fields.estimated = fields.kind === 'investment' && !fields.done;")
 .replace("amount: fields.kind === 'bill' ? fields.expectedAmount! : fields.amount", "amount: ['bill', 'investment'].includes(fields.kind) ? fields.expectedAmount! : fields.amount")
 .replace("if (dto.kind !== 'bill') return dto;", `if (dto.kind === 'investment') {
      const done = dto.done ?? (dto.estimated === false);
      const expectedAmount = dto.expectedAmount ?? dto.amount;
      if (done && dto.paidAmount == null) throw new BadRequestException('ACTUAL_INVESTMENT_REQUIRED');
      return { ...dto, categoryId: null, method: 'transfer', done, estimated: !done,
        expectedAmount, paidAmount: done ? dto.paidAmount : null,
        amount: done ? dto.paidAmount! : expectedAmount };
    }
    if (dto.kind !== 'bill') return dto;`));
edit(api+'models/finance.dto.ts',s=>s.replace(/  @ApiProperty\(\) @IsString\(\) @MaxLength\(80\) name: string;[\s\S]*?  photo: string;\n/,'').replace('Expected bill amount in cents, shared by every month of its series.','Expected amount in cents; bills share this across their series.').replace('Actual paid amount in cents, required to complete a bill.','Actual paid or invested amount in cents, required for completion.'));
edit(api+'models/finance.entity.ts',s=>s.replace("  @Column({ default: '' }) name: string;\n  @Column('text', { default: '' }) photo: string;\n",''));
edit('apps/api/src/app.module.ts',s=>s.replace('@Controller()',"import { InvestmentChecklist1788760000000 } from './database/migrations/1788760000000-investment-checklist';\n\n@Controller()").replace('        BillPaymentsAndTagOrder1788750000000,','        BillPaymentsAndTagOrder1788750000000,\n        InvestmentChecklist1788760000000,'));
edit('apps/web/src/lib/types.ts',s=>s.replace('  name: string;\n  photo: string;\n',''));
edit('apps/web/src/components/forms.tsx',s=>{
 s=s.replace("import { useState } from 'react';\n",'').replace("import { Upload, UserRound } from 'lucide-react';\n",'');
 s=s.replace('const expected = entry.expectedAmount ?? entry.amount;', "const expected = entry.expectedAmount ?? entry.amount;\n  const investment = entry.kind === 'investment';");
 s=s.replace('{t.paidAmount} ({currency})','{investment ? t.savedAmount : t.paidAmount} ({currency})').replace('{t.paidAmountHint}', '{investment ? t.confirmInvestmentHint : t.paidAmountHint}');
 s=s.replace(".filter((kind) => kind !== tag.kind)",".filter((kind) => kind !== tag.kind && (tag.type !== 'category' || kind !== 'investment'))");
 s=s.replace("{(['income', 'expense', 'bill', 'investment'] as Kind[]).map((k) => (", "{(['income', 'expense', 'bill', 'investment'] as Kind[]).filter(k => type !== 'category' || k !== 'investment').map((k) => (");
 s=s.replace('export function ProfileForm(', 'export function SettingsForm(').replace('  notify,\n','').replace('  notify: (s: string) => void;\n','').replace('  const [photo, setPhoto] = useState(profile.photo);\n','');
 s=s.replace('          name: String(f.get(\'name\')).trim(),\n          photo,\n','');
 const start=s.indexOf('      <section className="panel profile-panel">'); const end=s.indexOf('      <section className="panel profile-panel">',start+1);
 return s.slice(0,start)+s.slice(end);
});
edit('apps/web/src/components/entry-form.tsx',s=>{
 s=s.replace('useState(!!entry?.percentageBps && !entry.estimated)', "useState(entry?.kind === 'investment' && entry.done)");
 s=s.replace('categoryId: category || null', "categoryId: kind === 'investment' ? null : category || null").replace("method: f.get('method')", "method: kind === 'investment' ? 'transfer' : f.get('method')");
 s=s.replace("done: kind === 'bill' && billDone", "done: kind === 'investment' ? confirmed : kind === 'bill' && billDone");
 s=s.replace("expectedAmount: kind === 'bill' ? cents(f.get('expectedAmount')) : null", "expectedAmount: kind === 'bill' ? cents(f.get('expectedAmount')) : kind === 'investment' ? (percentageInvestment ? estimate : cents(f.get('amount'))) : null");
 s=s.replace("paidAmount: kind === 'bill' && billDone ? cents(f.get('paidAmount')) : null", "paidAmount: (kind === 'bill' && billDone) || (kind === 'investment' && confirmed) ? cents(f.get('paidAmount')) : null");
 s=s.replace('estimated: percentageInvestment && !confirmed', "estimated: kind === 'investment' && !confirmed");
 s=s.replace('setBillDone(false);','setBillDone(false);\n                setConfirmed(false);');
 const a=s.indexOf('          <label className="checkbox-line">'); const b=s.indexOf('          </label>',a)+18; s=s.slice(0,a)+s.slice(b);
 s=s.replace('      <div className="form-grid">\n        {kind', '      <div className={`form-grid ${kind !== \'investment\' ? \'entry-details-grid\' : \'\'}`}>\n        {kind');
 s=s.replace("(!percentageInvestment || confirmed)", '!percentageInvestment');
 s=s.replace("? t.amount\n", "? t.expectedAmount\n");
 s=s.replace('                    ? entry.amount / 100', '                    ? (entry.expectedAmount ?? entry.amount) / 100');
 const catStart=s.indexOf('      </div>\n      <div className="form-grid">\n        <CategoryPicker');
 const catEnd=s.indexOf('      <fieldset>',catStart);
 s=s.slice(0,catStart)+`        {kind !== 'investment' && <label>
          {t.method}
          <select name="method" defaultValue={entry?.method || 'pix'}>
            {(['pix', 'credit', 'debit', 'cash', 'transfer'] as const).map(m => <option key={m} value={m}>{t[m]}</option>)}
          </select>
        </label>}
      </div>
      {kind !== 'investment' && <CategoryPicker title={t.category} noneLabel={t.uncategorized}
        tags={data.tags.filter(tag => tag.type === 'category' && tag.kind === kind)}
        value={category} onChange={setCategory} />}
      {kind === 'investment' && <>
        <label className="checkbox-line"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
          <span>{t.confirmInvestment}<small>{t.confirmInvestmentHint}</small></span>
        </label>
        {confirmed && <label>{t.savedAmount} ({data.profile.currency})
          <input name="paidAmount" type="number" min="0" max="10000000" step="0.01" required defaultValue={entry?.paidAmount != null ? entry.paidAmount / 100 : ''} />
        </label>}
      </>}
`+s.slice(catEnd);
 return s;
});
