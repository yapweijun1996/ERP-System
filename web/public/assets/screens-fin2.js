/* ============================================================
   ARIA ERP — screens: Finance depth
   (General Ledger, Account Ledger, Bank Reconciliation, P&L, AR Aging)
   ============================================================ */

function glTypeTone(t){ return {Assets:'accent',Liabilities:'warn',Equity:'violet',Income:'ok',Expenses:'teal'}[t]||'neutral'; }
function signed0(n){ return (n<0?'−':'')+money0(Math.abs(n)); }
function pnlCell(v){ return v<0?`<span style="color:var(--muted)">(${money0(-v)})</span>`:money0(v); }

function financeNumber(value){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:0;
}

function financeLocalDate(date){
  const pad=value=>String(value).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

function financeJournalSource(ref){
  if(String(ref).startsWith('INV-SO-')) return 'Sales confirmation';
  if(String(ref).startsWith('SINV-')) return 'Supplier invoice';
  if(String(ref).startsWith('IA-')) return 'Inventory adjustment';
  return 'Canonical posting';
}

/* Canonical finance presentation model. GL rows are the immutable fact source;
   reports and document views below are rebuilt from those rows on every load. */
async function prepareCanonicalFinanceData(){
  const adapter=window.ErpSystemData;
  if(adapter&&adapter.mode==='fallback'){
    if(
      Array.isArray(DB.coa)
      &&DB.acctLedgerDocs
      &&DB.journalDocs
      &&Array.isArray(DB.pnl)
      &&Array.isArray(DB.arAging)
    ) return;
    throw new Error('The offline canonical finance snapshot is unavailable.');
  }
  const pages=await Promise.all([
    listPage('finance/accounts'),
    listPage('finance/gl-entries'),
    listPage('sales/customers'),
    listPage('sales/invoices'),
    listPage('finance/journals'),
  ]);
  const [accounts,entries,customers,invoices,manualJournals]=pages.map(page=>page.data);
  const accountById=new Map(accounts.map(row=>[row.id,row]));
  const manualByDocNo=new Map(manualJournals.map(row=>[row.docNo,row]));
  const entriesByAccountId=new Map();
  const entriesByJournalRef=new Map();
  entries.slice().sort((left,right)=>left.id-right.id).forEach(row=>{
    const accountRows=entriesByAccountId.get(row.accountId)||[];
    accountRows.push(row);
    entriesByAccountId.set(row.accountId,accountRows);
    const journalRows=entriesByJournalRef.get(row.journalRef)||[];
    journalRows.push(row);
    entriesByJournalRef.set(row.journalRef,journalRows);
  });

  const typeGroup={
    asset:'Assets',liability:'Liabilities',equity:'Equity',income:'Income',expense:'Expenses',
  };
  const groupOrder=['Assets','Liabilities','Equity','Income','Expenses'];
  const accountGroups=new Map(groupOrder.map(group=>[group,[]]));
  accounts.forEach(accountRow=>{
    const legs=entriesByAccountId.get(accountRow.id)||[];
    const debit=legs.reduce((sum,row)=>sum+financeNumber(row.debit),0);
    const credit=legs.reduce((sum,row)=>sum+financeNumber(row.credit),0);
    const group=typeGroup[accountRow.type]||accountRow.type;
    const balance=accountRow.type==='income'||accountRow.type==='liability'||accountRow.type==='equity'
      ?credit-debit
      :debit-credit;
    const accountRows=accountGroups.get(group)||[];
    accountRows.push({
      id:accountRow.id,
      code:accountRow.code,
      name:accountRow.name,
      mvt:Math.round((debit-credit)*100)/100,
      bal:Math.round(Math.abs(balance)*100)/100,
      dc:credit>debit?'Cr':'Dr',
      rawType:accountRow.type,
    });
    accountGroups.set(group,accountRows);
  });
  DB.coa=groupOrder
    .map(group=>({grp:group,accts:accountGroups.get(group)||[]}))
    .filter(group=>group.accts.length);

  DB.journals=[];
  DB.journalDocs={};
  entriesByJournalRef.forEach((legs,ref)=>{
    const manual=manualByDocNo.get(ref);
    const date=dateValue((manual&&manual.postingDate)||(legs[0]&&legs[0].postedAt));
    const totalDebit=legs.reduce((sum,row)=>sum+financeNumber(row.debit),0);
    const source=manual?'Manual journal':financeJournalSource(ref);
    const memo=(manual&&manual.memo)||legs.map(row=>row.memo).filter(Boolean).join(' / ')||`Posted ${ref}`;
    const status=manual&&manual.status==='reversed'?'Reversed':'Posted';
    DB.journals.push({
      no:ref,date,memo,status,dr:totalDebit,
      period:date?date.slice(0,7):'—',by:manual?'Audited finance action':'System',
    });
    DB.journalDocs[ref]={
      no:ref,
      date,
      memo,
      period:date?date.slice(0,7):'—',
      status,
      rawStatus:(manual&&manual.status)||'posted',
      by:manual?'Audited finance action':'System',
      source,
      manualJournalId:manual&&manual.id,
      journalType:manual&&manual.journalType,
      reference:manual&&manual.reference,
      reversalOfId:manual&&manual.reversalOfId,
      lines:legs.map(row=>{
        const accountRow=accountById.get(row.accountId)||{};
        return {
          acct:accountRow.code||`Account #${row.accountId}`,
          name:accountRow.name||`Account #${row.accountId}`,
          dr:financeNumber(row.debit),
          cr:financeNumber(row.credit),
          dim:row.memo||'—',
        };
      }),
    };
  });
  DB.journals.sort((left,right)=>right.date.localeCompare(left.date)||right.no.localeCompare(left.no));
  DB.je0611=DB.journals.length?DB.journalDocs[DB.journals[0].no]:null;

  DB.acctLedgerDocs={};
  accounts.forEach(accountRow=>{
    const legs=entriesByAccountId.get(accountRow.id)||[];
    let close=0;
    const rows=legs.map(row=>{
      const debit=financeNumber(row.debit);
      const credit=financeNumber(row.credit);
      close+=debit-credit;
      return {
        date:dateValue(row.postedAt),
        je:row.journalRef,
        memo:row.memo||financeJournalSource(row.journalRef),
        dr:debit,
        cr:credit,
      };
    });
    DB.acctLedgerDocs[accountRow.code]={
      code:accountRow.code,
      name:accountRow.name,
      period:'Canonical posted ledger',
      open:0,
      close:Math.round(close*100)/100,
      rows,
    };
  });
  DB.acctLedger=DB.acctLedgerDocs['1100']
    ||DB.acctLedgerDocs[accounts[0]&&accounts[0].code]
    ||null;

  const incomeRows=accounts.filter(row=>row.type==='income').map(row=>{
    const legs=entriesByAccountId.get(row.id)||[];
    const actual=legs.reduce(
      (sum,entry)=>sum+financeNumber(entry.credit)-financeNumber(entry.debit),0,
    );
    return {name:row.name,cur:actual,ytd:actual,bud:actual};
  });
  const expenseRows=accounts.filter(row=>row.type==='expense').map(row=>{
    const legs=entriesByAccountId.get(row.id)||[];
    const actual=-legs.reduce(
      (sum,entry)=>sum+financeNumber(entry.debit)-financeNumber(entry.credit),0,
    );
    return {name:row.name,cur:actual,ytd:actual,bud:actual};
  });
  const costRows=expenseRows.filter((_row,index)=>String(
    accounts.filter(row=>row.type==='expense')[index]&&accounts.filter(row=>row.type==='expense')[index].code,
  ).startsWith('5'));
  const operatingRows=expenseRows.filter(row=>!costRows.includes(row));
  DB.pnl=[
    {grp:'Revenue',kind:'head',rows:incomeRows.length?incomeRows:[{name:'No posted revenue',cur:0,ytd:0,bud:0}],total:'Net revenue'},
    {grp:'Cost of sales',kind:'head',rows:costRows.length?costRows:[{name:'No posted cost of sales',cur:0,ytd:0,bud:0}],total:'Cost of sales'},
    {grp:'Gross profit',kind:'subtotal'},
    {grp:'Operating expenses',kind:'head',rows:operatingRows.length?operatingRows:[{name:'No posted operating expenses',cur:0,ytd:0,bud:0}],total:'Total opex'},
    {grp:'Operating profit',kind:'subtotal'},
  ];

  const customerById=new Map(customers.map(row=>[row.id,row]));
  const agingByCustomerId=new Map();
  const asAt=new Date();
  invoices.filter(row=>row.status==='unpaid').forEach(row=>{
    const invoiceDate=dateValue(row.invoiceDate);
    const due=new Date(`${invoiceDate}T00:00:00`);
    due.setDate(due.getDate()+30);
    const age=Math.floor((asAt.getTime()-due.getTime())/86400000);
    const current=agingByCustomerId.get(row.customerId)||{
      cust:customerById.get(row.customerId)?.name||`Customer #${row.customerId}`,
      code:customerById.get(row.customerId)?.code||'—',
      cur:0,b30:0,b60:0,b90:0,b90p:0,
    };
    const amount=financeNumber(row.totalAmount);
    if(age<=0) current.cur+=amount;
    else if(age<=30) current.b30+=amount;
    else if(age<=60) current.b60+=amount;
    else if(age<=90) current.b90+=amount;
    else current.b90p+=amount;
    agingByCustomerId.set(row.customerId,current);
  });
  DB.arAging=Array.from(agingByCustomerId.values());
  DB.financeAsAt=financeLocalDate(asAt);
  DB.financeReadMeta={
    truncated:pages.some(page=>Boolean(page.nextCursor)),
    invoiceCount:invoices.length,
    journalCount:entriesByJournalRef.size,
    nextCursors:pages.map(page=>page.nextCursor),
  };
}

/* ---------------- GENERAL LEDGER / CHART OF ACCOUNTS (module landing) ---------------- */
SCREENS['gl'] = async function(root){
  await prepareCanonicalFinanceData();
  const flat=DB.coa.flatMap(g=>g.accts.map(a=>({...a,type:g.grp})));
  const get=c=>flat.find(a=>a.code===c)?.bal||0;
  const cash=get('1000')+get('1010');
  /* TASK-023: 2100 is the real seeded Accounts Payable code (purchasing
     chain) — 2000 was never a real account, so this always read 0 before
     there was any AP data to show, accidentally looking correct. */
  const ar=get('1100'), ap=get('2100');
  const income=get('4000')+get('4100')-get('4900');
  const expense=['5000','6000','6100','6200','6300','6900'].reduce((s,c)=>s+get(c),0);
  const net=income-expense;
  const canonicalMeta=DB.financeReadMeta||{invoiceCount:0,journalCount:0};

  const chips=[['all',t('common.all'),null],['Assets',ts('Assets'),'accent'],['Liabilities',ts('Liabilities'),'warn'],['Income',ts('Income'),'ok'],['Expenses',ts('Expenses'),'teal']];
  transactionListPage(root,{
    module:'finance',route:'gl',title:t('gl.title'),
    description:`${DB.company.period}${canonicalMeta.truncated?' · first 100 rows':''}`,
    rows:flat,rowId:a=>a.code,
    filters:chips.map(([key,label])=>[key,label]),
    filterFn:(account,type)=>account.type===type,
    kpis:[
      {label:t('gl.t.cash'),value:money0(cash)},
      {label:t('gl.t.ar'),value:money0(ar)},
      {label:t('gl.t.ap'),value:money0(ap)},
      {label:t('gl.t.net'),value:money0(net),negative:net<0},
    ],
    toolbarActions:[
      {label:t('gl.pnl'),icon:'chart',onClick:()=>navigate('pnl')},
      {label:t('gl.reconcile'),icon:'bank',onClick:()=>navigate('bank-rec')},
    ],
    columns:[
      {label:t('gl.col.account'),render:a=>`<div class="cellsub"><b>${esc(a.code)} · ${esc(a.name)}</b></div>`},
      {label:t('qc.col.type'),render:a=>cap(ts(a.type),glTypeTone(a.type))},
      {label:t('gl.col.movement'),align:'r',render:a=>`<span class="tnum delta ${a.mvt<0?'neg':'pos'}">${a.mvt?signed0(a.mvt):'—'}</span>`},
      {label:t('gl.col.balance'),align:'r',render:a=>`<b class="tnum">${money0(a.bal)}</b>`},
      {label:t('gl.col.drcr'),align:'c',render:a=>esc(a.dc)},
    ],
    onOpen:a=>(DB.acctLedgerDocs&&DB.acctLedgerDocs[a.code])
      ?navigate('account-ledger',{code:a.code})
      :(a.code==='1000'?navigate('account-ledger'):toast('Open ledger · '+a.code,'info')),
    empty:{icon:'book',title:'No ledger accounts'},
  });
};

/* ---------------- ACCOUNT LEDGER (drill target) ---------------- */
SCREENS['account-ledger'] = async function(root, params){
  await prepareCanonicalFinanceData();
  const a=(params&&params.code&&DB.acctLedgerDocs&&DB.acctLedgerDocs[params.code])||DB.acctLedger;
  if(!a) throw new Error('No canonical account ledger is available.');
  let run=a.open;
  const rows=a.rows.map((r,i)=>{ run+=r.dr-r.cr; return `<tr class="je-link" data-je="${esc(r.je)}" style="cursor:pointer">
      <td class="lineno">${i+1}</td>
      <td class="l">${esc(r.date)}</td>
      <td class="l li-name"><b>${esc(r.je)}</b><small>${esc(r.memo)}</small></td>
      <td class="tnum">${r.dr?money(r.dr):'—'}</td>
      <td class="tnum">${r.cr?money(r.cr):'—'}</td>
      <td class="tnum"><b>${money(run)}</b></td></tr>`; }).join('');
  const totDr=a.rows.reduce((s,r)=>s+r.dr,0), totCr=a.rows.reduce((s,r)=>s+r.cr,0);
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:960px">
    ${crumbs([DB.company.name,'Finance','General Ledger',{cur:a.code}])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('book')}${esc(a.name)} <span class="dnum">${esc(a.code)}</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(a.period)} · ${a.rows.length} entries${DB.financeReadMeta&&DB.financeReadMeta.truncated?' · first 100 rows':''}</div></div>
        <div class="dactions">${btn('Back to GL',{icon:'chevL',cls:'soft',attrs:'onclick="navigate(\'gl\')"'})}${btn('Export',{icon:'download',cls:'soft'})}</div></div>
      <div class="docmeta">
        <div class="dm"><small>Opening balance</small><b>${money0(a.open)}</b></div>
        <div class="dm"><small>Total debits</small><b>${money0(totDr)}</b></div>
        <div class="dm"><small>Total credits</small><b>${money0(totCr)}</b></div>
        <div class="dm"><small>Closing balance</small><b>${money0(a.close)}</b></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>Transactions</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">running balance</span></div>
      <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Date</th><th class="l">Reference</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
      <tbody><tr style="background:var(--surface-2)"><td></td><td class="l" colspan="2" style="font-weight:600;color:var(--muted)">Opening balance</td><td></td><td></td><td class="tnum"><b>${money(a.open)}</b></td></tr>${rows}</tbody>
      <tfoot><tr><td></td><td class="l" colspan="2" style="font-weight:600">Closing balance</td><td class="tnum"><b>${money0(totDr)}</b></td><td class="tnum"><b>${money0(totCr)}</b></td><td class="tnum"><b>${money(a.close)}</b></td></tr></tfoot>
      </table>
    </div>
    <div style="height:40px"></div>
  </div></div></section></div>`;
  root.querySelectorAll('tr.je-link').forEach(tr=>tr.addEventListener('click',()=>{
    const ref=tr.dataset.je;
    (DB.journalDocs&&DB.journalDocs[ref])?navigate('journal-entry',{no:ref}):toast('Open journal · '+ref,'info');
  }));
};

/* ---------------- CANONICAL BANK RECONCILIATION ----------------
   Statement lines link one-to-one to immutable bank-account GL legs. This screen
   never fabricates or auto-posts adjustments: missing charges/interest must first be
   entered through the real manual-journal flow. */
function bankReconciliationCopy(){
  const packs={
    en:{title:'Bank reconciliation',sub:'Import bank statement facts, match exact GL bank legs and lock the completed statement.',import:'Import statement',statements:'Statements',select:'Select statement',period:'Period',account:'Bank account',status:'Status',draft:'Draft',reconciled:'Reconciled',lines:'Statement lines',matched:'Matched',unmatched:'Unmatched',match:'Match',unmatch:'Unmatch',reference:'Reference',description:'Description',date:'Date',amount:'Amount',ledger:'General Ledger match',noCandidate:'No exact unmatched GL bank leg exists.',postFirst:'Post missing bank activity first',complete:'Complete reconciliation',completeTitle:'Complete this reconciliation?',completeBody:'Every statement line is matched. Completion locks this statement and its matches.',confirm:'Complete & lock',cancel:'Cancel',done:'Bank statement reconciled',matchedMsg:'Statement line matched',unmatchedMsg:'Statement line unmatched',empty:'No bank statements yet',emptyHelp:'Import a real statement to begin. No sample statement is substituted.',number:'Statement number',start:'Period start',end:'Period end',opening:'Opening balance',closing:'Closing balance',csv:'Statement CSV lines',csvHint:'One line each: date, reference, description, signed amount. Positive is money in; negative is money out.',csvExample:'2026-07-22,REF-001,Customer receipt,125.00',importing:'Importing…',importNow:'Validate & import',required:'Complete the statement header and include at least one CSV line.',invalidCsv:'Each CSV line needs a valid date, description and non-zero signed amount.',imported:'Bank statement imported',source:'Canonical source',sourceHelp:'Imported statement rows and immutable GL legs; matching creates no accounting entry.',matchedCount:'{m} of {n} lines matched',movement:'Statement movement',balance:'Closing balance',candidate:'Choose GL entry…',noAccounts:'No asset account is configured for this company.',retry:'Retry',error:'Bank reconciliation could not be loaded.',allMatched:'All statement lines are matched.',stillOpen:'Match every statement line before completion.',immutable:'Completed statements are immutable.',exact:'Exact amount and bank account are enforced by the domain command.'},
    ms:{title:'Penyesuaian bank',sub:'Import fakta penyata bank, padankan kaki GL bank tepat dan kunci penyata lengkap.',import:'Import penyata',statements:'Penyata',select:'Pilih penyata',period:'Tempoh',account:'Akaun bank',status:'Status',draft:'Draf',reconciled:'Disesuaikan',lines:'Baris penyata',matched:'Dipadankan',unmatched:'Belum dipadan',match:'Padan',unmatch:'Nyahpadan',reference:'Rujukan',description:'Keterangan',date:'Tarikh',amount:'Amaun',ledger:'Padanan Lejar Am',noCandidate:'Tiada kaki GL bank belum dipadan dengan amaun tepat.',postFirst:'Pos aktiviti bank yang hilang dahulu',complete:'Lengkapkan penyesuaian',completeTitle:'Lengkapkan penyesuaian ini?',completeBody:'Setiap baris penyata telah dipadankan. Penyempurnaan akan mengunci penyata dan padanannya.',confirm:'Lengkap & kunci',cancel:'Batal',done:'Penyata bank telah disesuaikan',matchedMsg:'Baris penyata dipadankan',unmatchedMsg:'Padanan baris dibatalkan',empty:'Belum ada penyata bank',emptyHelp:'Import penyata sebenar untuk bermula. Tiada penyata sampel diganti.',number:'Nombor penyata',start:'Mula tempoh',end:'Akhir tempoh',opening:'Baki awal',closing:'Baki akhir',csv:'Baris CSV penyata',csvHint:'Satu baris: tarikh, rujukan, keterangan, amaun bertanda. Positif masuk; negatif keluar.',csvExample:'2026-07-22,REF-001,Terimaan pelanggan,125.00',importing:'Mengimport…',importNow:'Sahkan & import',required:'Lengkapkan pengepala dan sertakan sekurang-kurangnya satu baris CSV.',invalidCsv:'Setiap baris CSV memerlukan tarikh sah, keterangan dan amaun bukan sifar.',imported:'Penyata bank diimport',source:'Sumber kanonik',sourceHelp:'Baris penyata diimport dan kaki GL tidak berubah; padanan tidak mencipta catatan.',matchedCount:'{m} daripada {n} baris dipadan',movement:'Pergerakan penyata',balance:'Baki akhir',candidate:'Pilih catatan GL…',noAccounts:'Tiada akaun aset dikonfigurasi untuk syarikat ini.',retry:'Cuba lagi',error:'Penyesuaian bank tidak dapat dimuatkan.',allMatched:'Semua baris penyata telah dipadankan.',stillOpen:'Padankan setiap baris sebelum lengkap.',immutable:'Penyata lengkap tidak boleh diubah.',exact:'Amaun dan akaun bank tepat dikuatkuasakan oleh arahan domain.'},
    zh:{title:'银行对账',sub:'导入真实银行对账单，逐笔匹配准确的银行总账明细，并锁定已完成对账单。',import:'导入对账单',statements:'对账单',select:'选择对账单',period:'期间',account:'银行科目',status:'状态',draft:'草稿',reconciled:'已对账',lines:'对账单明细',matched:'已匹配',unmatched:'未匹配',match:'匹配',unmatch:'取消匹配',reference:'参考号',description:'说明',date:'日期',amount:'金额',ledger:'总账匹配',noCandidate:'没有金额完全相同且尚未匹配的银行总账明细。',postFirst:'先将缺少的银行交易过账',complete:'完成对账',completeTitle:'完成此银行对账？',completeBody:'全部对账单明细均已匹配。完成后将锁定对账单及其匹配关系。',confirm:'完成并锁定',cancel:'取消',done:'银行对账单已完成',matchedMsg:'对账单明细已匹配',unmatchedMsg:'已取消明细匹配',empty:'尚无银行对账单',emptyHelp:'请导入真实对账单开始处理；系统不会替换为示例数据。',number:'对账单编号',start:'期间开始',end:'期间结束',opening:'期初余额',closing:'期末余额',csv:'对账单 CSV 明细',csvHint:'每行格式：日期、参考号、说明、带正负号金额。正数为收款，负数为付款。',csvExample:'2026-07-22,REF-001,客户收款,125.00',importing:'导入中…',importNow:'验证并导入',required:'请填写对账单抬头并至少提供一行 CSV。',invalidCsv:'每行 CSV 必须包含有效日期、说明和非零金额。',imported:'银行对账单已导入',source:'Canonical 数据源',sourceHelp:'真实导入的对账单与不可变总账明细；匹配过程不会创建会计分录。',matchedCount:'已匹配 {m}/{n} 笔',movement:'对账单变动',balance:'期末余额',candidate:'选择总账明细…',noAccounts:'当前公司尚未配置资产类银行科目。',retry:'重试',error:'无法加载银行对账。',allMatched:'全部对账单明细均已匹配。',stillOpen:'完成前必须匹配全部对账单明细。',immutable:'已完成对账单不可修改。',exact:'领域命令强制核对相同银行科目与完全一致的金额。'},
    ja:{title:'銀行照合',sub:'銀行明細を取り込み、正確な銀行GL明細と照合して完了明細をロックします。',import:'明細を取込',statements:'銀行明細',select:'明細を選択',period:'期間',account:'銀行勘定',status:'ステータス',draft:'下書き',reconciled:'照合済',lines:'明細行',matched:'照合済',unmatched:'未照合',match:'照合',unmatch:'照合解除',reference:'参照',description:'摘要',date:'日付',amount:'金額',ledger:'総勘定元帳との照合',noCandidate:'金額が一致する未照合の銀行GL明細がありません。',postFirst:'不足する銀行取引を先に転記',complete:'照合を完了',completeTitle:'この照合を完了しますか？',completeBody:'全明細行が照合済みです。完了すると明細と照合関係がロックされます。',confirm:'完了してロック',cancel:'取消',done:'銀行明細を照合しました',matchedMsg:'明細行を照合しました',unmatchedMsg:'明細行の照合を解除しました',empty:'銀行明細はまだありません',emptyHelp:'実際の明細を取り込んで開始してください。サンプルは代用されません。',number:'明細番号',start:'期間開始',end:'期間終了',opening:'開始残高',closing:'終了残高',csv:'明細CSV行',csvHint:'1行：日付、参照、摘要、符号付き金額。プラスは入金、マイナスは出金です。',csvExample:'2026-07-22,REF-001,顧客入金,125.00',importing:'取込中…',importNow:'検証して取込',required:'ヘッダーと1行以上のCSVを入力してください。',invalidCsv:'各CSV行には有効な日付、摘要、ゼロ以外の金額が必要です。',imported:'銀行明細を取り込みました',source:'Canonical ソース',sourceHelp:'取込済銀行明細と不変GL明細。照合は仕訳を作成しません。',matchedCount:'{n}行中{m}行を照合',movement:'明細変動',balance:'終了残高',candidate:'GL明細を選択…',noAccounts:'この会社には資産勘定が設定されていません。',retry:'再試行',error:'銀行照合を読み込めませんでした。',allMatched:'全明細行が照合済みです。',stillOpen:'完了前に全明細行を照合してください。',immutable:'完了した明細は変更できません。',exact:'ドメインコマンドが銀行勘定と金額の完全一致を強制します。'},
    vi:{title:'Đối chiếu ngân hàng',sub:'Nhập sao kê thật, khớp chính xác dòng GL ngân hàng và khóa sao kê đã hoàn tất.',import:'Nhập sao kê',statements:'Sao kê',select:'Chọn sao kê',period:'Kỳ',account:'Tài khoản ngân hàng',status:'Trạng thái',draft:'Nháp',reconciled:'Đã đối chiếu',lines:'Dòng sao kê',matched:'Đã khớp',unmatched:'Chưa khớp',match:'Khớp',unmatch:'Bỏ khớp',reference:'Tham chiếu',description:'Diễn giải',date:'Ngày',amount:'Số tiền',ledger:'Khớp Sổ Cái',noCandidate:'Không có dòng GL ngân hàng chưa khớp với số tiền chính xác.',postFirst:'Ghi sổ hoạt động ngân hàng còn thiếu trước',complete:'Hoàn tất đối chiếu',completeTitle:'Hoàn tất đối chiếu này?',completeBody:'Mọi dòng sao kê đã được khớp. Hoàn tất sẽ khóa sao kê và quan hệ khớp.',confirm:'Hoàn tất & khóa',cancel:'Hủy',done:'Đã đối chiếu sao kê ngân hàng',matchedMsg:'Đã khớp dòng sao kê',unmatchedMsg:'Đã bỏ khớp dòng sao kê',empty:'Chưa có sao kê ngân hàng',emptyHelp:'Nhập sao kê thật để bắt đầu. Không thay thế bằng dữ liệu mẫu.',number:'Số sao kê',start:'Bắt đầu kỳ',end:'Kết thúc kỳ',opening:'Số dư đầu',closing:'Số dư cuối',csv:'Các dòng CSV sao kê',csvHint:'Mỗi dòng: ngày, tham chiếu, diễn giải, số tiền có dấu. Dương là tiền vào; âm là tiền ra.',csvExample:'2026-07-22,REF-001,Thu tiền khách hàng,125.00',importing:'Đang nhập…',importNow:'Kiểm tra & nhập',required:'Hoàn tất tiêu đề và có ít nhất một dòng CSV.',invalidCsv:'Mỗi dòng CSV cần ngày hợp lệ, diễn giải và số tiền khác không.',imported:'Đã nhập sao kê ngân hàng',source:'Nguồn Canonical',sourceHelp:'Dòng sao kê đã nhập và dòng GL bất biến; thao tác khớp không tạo bút toán.',matchedCount:'Đã khớp {m}/{n} dòng',movement:'Biến động sao kê',balance:'Số dư cuối',candidate:'Chọn dòng GL…',noAccounts:'Chưa cấu hình tài khoản tài sản cho công ty này.',retry:'Thử lại',error:'Không thể tải đối chiếu ngân hàng.',allMatched:'Mọi dòng sao kê đã được khớp.',stillOpen:'Hãy khớp mọi dòng trước khi hoàn tất.',immutable:'Sao kê hoàn tất là bất biến.',exact:'Lệnh miền bắt buộc đúng tài khoản ngân hàng và số tiền chính xác.'},
  };
  return packs[typeof getLang==='function'?getLang():'en']||packs.en;
}
function bankCents(value){
  const text=String(value??'0').trim();
  if(!/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text))return null;
  const neg=text.startsWith('-'),raw=neg?text.slice(1):text,parts=raw.split('.');
  const cents=BigInt(parts[0])*100n+BigInt((parts[1]||'').padEnd(2,'0'));
  return neg?-cents:cents;
}
function bankMoney(cents,currency){
  return new Intl.NumberFormat(({en:'en-SG',ms:'ms-MY',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'})[typeof getLang==='function'?getLang():'en']||'en-SG',{
    style:'currency',currency:currency||'SGD',minimumFractionDigits:2,maximumFractionDigits:2,
  }).format(Number(cents)/100);
}
function bankCsvCells(line){
  const cells=[];let value='',quoted=false;
  for(let i=0;i<line.length;i+=1){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i+=1;}else quoted=!quoted;}else if(ch===','&&!quoted){cells.push(value.trim());value='';}else value+=ch;}
  cells.push(value.trim());return cells;
}
async function bankListAll(resource,filters){
  const rows=[];let cursor=null;
  for(let page=0;page<5;page+=1){const response=await window.ErpSystemData.list(resource,Object.assign({limit:100},filters||{},cursor?{cursor}:{}));rows.push(...(response.data||[]));cursor=response.meta&&response.meta.nextCursor;if(!cursor)return {rows,truncated:false};}
  return {rows,truncated:!!cursor};
}
SCREENS['bank-rec'] = async function(root,params){
  const copy=bankReconciliationCopy();
  const loading=()=>{root.innerHTML=modulePage({module:'finance',route:'bank-rec',active:'bank-rec',title:copy.title,sub:copy.sub,body:`<div class="screen-loading">${skeletonRows(6)}</div>`});};
  loading();
  let base;
  try{
    const pages=await Promise.all([bankListAll('finance/bank-statements'),bankListAll('finance/accounts'),bankListAll('finance/bank-statement-lines')]);
    base={statements:pages[0].rows.sort((a,b)=>b.id-a.id),accounts:pages[1].rows.filter(a=>a.type==='asset').sort((a,b)=>String(a.code).localeCompare(String(b.code))),allLines:pages[2].rows,truncated:pages.some(p=>p.truncated)};
  }catch(error){root.innerHTML=modulePage({module:'finance',route:'bank-rec',active:'bank-rec',title:copy.title,sub:copy.sub,body:`${statePanel({icon:'warn',title:copy.error,body:(error&&error.message)||copy.error})}<div style="padding:0 24px">${btn(copy.retry,{icon:'refresh',cls:'primary',attrs:'data-bank-retry'})}</div>`});root.querySelector('[data-bank-retry]')?.addEventListener('click',()=>SCREENS['bank-rec'](root,params));return;}
  const requested=Number(params&&params.statementId);let selected=base.statements.find(s=>s.id===requested)||base.statements[0]||null;
  let detail=null;
  async function loadDetail(){
    if(!selected){detail=null;return;}
    const [linePage,glPage]=await Promise.all([bankListAll('finance/bank-statement-lines',{statementId:selected.id}),bankListAll('finance/gl-entries',{accountId:selected.bankAccountId})]);
    detail={lines:linePage.rows.sort((a,b)=>a.lineNo-b.lineNo),gl:glPage.rows,account:base.accounts.find(a=>a.id===selected.bankAccountId),truncated:linePage.truncated||glPage.truncated};
  }
  await loadDetail();
  function statusLabel(value){return value==='reconciled'?copy.reconciled:copy.draft;}
  function glSigned(row){return (bankCents(row.debit)||0n)-(bankCents(row.credit)||0n);}
  function candidateRows(line){const used=new Set(base.allLines.filter(item=>item.matchedGlEntryId!=null&&item.id!==line.id).map(item=>Number(item.matchedGlEntryId)));const amount=bankCents(line.amount);return detail.gl.filter(row=>!used.has(Number(row.id))&&glSigned(row)===amount);}
  function openImport(){
    if(!base.accounts.length){toast(copy.noAccounts,'danger');return;}
    const today=new Date().toISOString().slice(0,10),month=today.slice(0,7),start=month+'-01';
    appModal({icon:'upload',title:copy.import,wide:true,body:`<div class="fldrow c3"><div class="fld"><span>${esc(copy.number)} <span class="req">*</span></span><input data-bank-number value="BS-${today.replaceAll('-','')}"></div><div class="fld"><span>${esc(copy.account)} <span class="req">*</span></span><select data-bank-account>${base.accounts.map(a=>`<option value="${a.id}">${esc(a.code)} · ${esc(a.name)}</option>`).join('')}</select></div><div class="fld"><span>${esc(copy.status)}</span><input value="${esc(copy.draft)}" disabled></div></div><div class="fldrow c2" style="margin-top:12px"><div class="fld"><span>${esc(copy.start)}</span><input type="date" data-bank-start value="${start}"></div><div class="fld"><span>${esc(copy.end)}</span><input type="date" data-bank-end value="${today}"></div></div><div class="fldrow c2" style="margin-top:12px"><div class="fld"><span>${esc(copy.opening)}</span><input inputmode="decimal" data-bank-opening value="0.00"></div><div class="fld"><span>${esc(copy.closing)}</span><input inputmode="decimal" data-bank-closing value="0.00"></div></div><div class="fld" style="margin-top:12px"><span>${esc(copy.csv)} <span class="req">*</span></span><textarea data-bank-csv rows="7" placeholder="${esc(copy.csvExample)}"></textarea><small>${esc(copy.csvHint)}</small></div>`,actions:`${btn(copy.cancel,{cls:'soft',attrs:'data-bank-import-cancel'})}${btn(copy.importNow,{icon:'upload',cls:'primary',attrs:'data-bank-import-confirm'})}`});
    document.querySelector('[data-bank-import-cancel]')?.addEventListener('click',closeModal);
    document.querySelector('[data-bank-import-confirm]')?.addEventListener('click',async event=>{
      const button=event.currentTarget,statementNo=document.querySelector('[data-bank-number]')?.value.trim(),bankAccountId=Number(document.querySelector('[data-bank-account]')?.value),periodStart=document.querySelector('[data-bank-start]')?.value,periodEnd=document.querySelector('[data-bank-end]')?.value,openingBalance=document.querySelector('[data-bank-opening]')?.value.trim(),closingBalance=document.querySelector('[data-bank-closing]')?.value.trim(),csv=document.querySelector('[data-bank-csv]')?.value.trim();
      if(!statementNo||!bankAccountId||!periodStart||!periodEnd||!openingBalance||!closingBalance||!csv){toast(copy.required,'danger');return;}
      const lines=csv.split(/\r?\n/).map(row=>bankCsvCells(row)).map(cells=>({transactionDate:cells[0],reference:cells[1]||null,description:cells[2],amount:cells[3]}));
      if(lines.some(line=>!/^\d{4}-\d{2}-\d{2}$/.test(line.transactionDate||'')||!line.description||bankCents(line.amount)===null||bankCents(line.amount)===0n)){toast(copy.invalidCsv,'danger');return;}
      button.disabled=true;button.querySelector('span')&&(button.querySelector('span').textContent=copy.importing);
      try{const response=await window.ErpSystemData.create('finance/bank-statements',{statementNo,bankAccountId,currency:(DB.company&&DB.company.currency)||'SGD',periodStart,periodEnd,openingBalance,closingBalance,lines});closeModal();toast(copy.imported,'ok');navigate('bank-rec',{statementId:response.data.id});}catch(error){toast((error&&error.message)||copy.error,'danger');button.disabled=false;button.querySelector('span')&&(button.querySelector('span').textContent=copy.importNow);}
    });
  }
  function render(){
    if(!selected){root.innerHTML=modulePage({module:'finance',route:'bank-rec',active:'bank-rec',title:copy.title,sub:copy.sub,action:btn(copy.import,{icon:'upload',cls:'primary',attrs:'data-bank-import'}),body:`<div data-bank-reconciliation="canonical">${statePanel({icon:'bank',title:copy.empty,body:copy.emptyHelp,action:btn(copy.import,{icon:'upload',cls:'primary',attrs:'data-bank-empty-import'})})}</div>`});root.querySelectorAll('[data-bank-import],[data-bank-empty-import]').forEach(button=>button.addEventListener('click',openImport));return;}
    const account=detail.account||{code:'',name:`#${selected.bankAccountId}`},currency=selected.currency||((DB.company&&DB.company.currency)||'SGD'),matched=detail.lines.filter(line=>line.matchedGlEntryId!=null).length,allMatched=detail.lines.length>0&&matched===detail.lines.length,reconciled=selected.status==='reconciled';
    const rows=detail.lines.map(line=>{const candidates=candidateRows(line),matchedGl=line.matchedGlEntryId!=null?detail.gl.find(row=>Number(row.id)===Number(line.matchedGlEntryId)):null,amount=bankCents(line.amount)||0n;return `<div class="pickrow ${line.matchedGlEntryId!=null?'done':''}" data-bank-line="${line.id}"><div class="pick-check">${ic('check')}</div><div style="flex:1;min-width:180px"><div style="display:flex;align-items:center;gap:8px"><b>${esc(line.description)}</b>${line.matchedGlEntryId!=null?cap(copy.matched,'ok'):cap(copy.unmatched,'warn')}</div><small style="display:block;color:var(--muted);margin-top:3px">${esc(String(line.transactionDate).slice(0,10))} · ${esc(line.reference||'—')}</small><small style="display:block;color:var(--muted);margin-top:3px">${matchedGl?`${esc(matchedGl.journalRef)} · ${esc(matchedGl.memo||copy.ledger)}`:copy.exact}</small></div><div class="tnum" style="font-weight:700;color:${amount<0n?'var(--danger)':'var(--ok)'}">${bankMoney(amount,currency)}</div><div style="flex:0 1 290px;min-width:180px;text-align:right">${reconciled?cap(copy.immutable,'neutral'):line.matchedGlEntryId!=null?btn(copy.unmatch,{icon:'close',cls:'soft',attrs:`data-bank-unmatch="${line.id}"`}):candidates.length?`<div style="display:flex;gap:7px"><select data-bank-candidate="${line.id}" style="min-width:0;flex:1"><option value="">${esc(copy.candidate)}</option>${candidates.map(row=>`<option value="${row.id}">${esc(row.journalRef)} · ${esc(String(row.postedAt).slice(0,10))} · ${esc(row.memo||'')}</option>`).join('')}</select>${btn(copy.match,{icon:'link',cls:'primary',attrs:`data-bank-match="${line.id}"`})}</div>`:`<button class="btn soft sm" data-bank-post-first>${ic('plus')}<span>${esc(copy.postFirst)}</span></button>`}</div></div>`;}).join('');
    const movement=detail.lines.reduce((sum,line)=>sum+(bankCents(line.amount)||0n),0n),opening=bankCents(selected.openingBalance)||0n,closing=bankCents(selected.closingBalance)||0n;
    const select=base.statements.length>1?`<select data-bank-statement-select aria-label="${esc(copy.select)}">${base.statements.map(row=>`<option value="${row.id}" ${row.id===selected.id?'selected':''}>${esc(row.statementNo)} · ${esc(statusLabel(row.status))}</option>`).join('')}</select>`:`<b>${esc(selected.statementNo)}</b>`;
    const body=`<div class="bank-rec-canonical" data-bank-reconciliation="canonical" data-bank-status="${esc(selected.status)}"><div class="panel" style="margin:0 24px 16px"><div class="panel-body"><div class="fldrow c3"><div class="fld"><span>${esc(copy.statements)}</span>${select}</div><div class="fld"><span>${esc(copy.account)}</span><b>${esc(account.code)} · ${esc(account.name)}</b></div><div class="fld"><span>${esc(copy.period)}</span><b>${esc(String(selected.periodStart).slice(0,10))} → ${esc(String(selected.periodEnd).slice(0,10))}</b></div></div></div></div><div class="pick-layout" style="margin:0 24px 24px;border:1px solid var(--hairline);border-radius:var(--r-l);min-height:390px"><div class="pick-main"><div class="panel-h"><h3>${esc(copy.lines)}</h3><span style="margin-left:auto">${cap(copy.matchedCount.replace('{m}',matched).replace('{n}',detail.lines.length),allMatched?'ok':'warn')}</span></div><div style="padding:14px">${rows||statePanel({icon:'bank',title:copy.empty,body:copy.emptyHelp})}</div></div><aside class="pick-side"><div class="sectitle" style="margin-top:0">${esc(copy.title)}</div><div class="sumcard"><div class="sumrow"><span class="sk2">${esc(copy.opening)}</span><span class="sv tnum">${bankMoney(opening,currency)}</span></div><div class="sumrow"><span class="sk2">${esc(copy.movement)}</span><span class="sv tnum">${bankMoney(movement,currency)}</span></div><div class="sumrow total"><span class="sk2">${esc(copy.balance)}</span><span class="sv tnum">${bankMoney(closing,currency)}</span></div></div><div style="margin-top:12px">${reconciled?indicator({tone:'ok',icon:'checkc',label:copy.reconciled,value:selected.statementNo,sub:copy.immutable}):allMatched?indicator({tone:'ok',icon:'checkc',label:copy.allMatched,value:`${matched}/${detail.lines.length}`,sub:copy.completeBody}):indicator({tone:'warn',icon:'warn',label:copy.stillOpen,value:`${matched}/${detail.lines.length}`,sub:copy.exact})}</div><div class="sumcard" style="margin-top:12px"><div class="sectitle" style="margin-top:0">${esc(copy.source)}</div><p style="font-size:12.5px;color:var(--muted);margin:0">${esc(copy.sourceHelp)}</p></div>${!reconciled?`<div style="margin-top:14px">${btn(copy.complete,{icon:'check',cls:'primary',sm:false,attrs:`data-bank-complete ${allMatched?'':'disabled'}`})}</div>`:''}</aside></div></div>`;
    root.innerHTML=modulePage({module:'finance',route:'bank-rec',active:'bank-rec',title:copy.title,count:base.statements.length,sub:copy.sub,action:btn(copy.import,{icon:'upload',cls:'primary',attrs:'data-bank-import'}),body});
    root.querySelector('[data-bank-import]')?.addEventListener('click',openImport);
    root.querySelector('[data-bank-statement-select]')?.addEventListener('change',event=>navigate('bank-rec',{statementId:Number(event.target.value)}));
    root.querySelectorAll('[data-bank-post-first]').forEach(button=>button.addEventListener('click',()=>navigate('new-journal-entry')));
    root.querySelectorAll('[data-bank-match]').forEach(button=>button.addEventListener('click',async()=>{const lineId=Number(button.dataset.bankMatch),selectEl=root.querySelector(`[data-bank-candidate="${lineId}"]`),glEntryId=Number(selectEl&&selectEl.value);if(!glEntryId){toast(copy.candidate,'warn');return;}button.disabled=true;try{await window.ErpSystemData.action('finance/bank-statement-lines',lineId,'match',{glEntryId},`bank-match-${lineId}-${glEntryId}`);toast(copy.matchedMsg,'ok');navigate('bank-rec',{statementId:selected.id});}catch(error){toast((error&&error.message)||copy.error,'danger');button.disabled=false;}}));
    root.querySelectorAll('[data-bank-unmatch]').forEach(button=>button.addEventListener('click',async()=>{const lineId=Number(button.dataset.bankUnmatch);button.disabled=true;try{await window.ErpSystemData.action('finance/bank-statement-lines',lineId,'unmatch',{},`bank-unmatch-${lineId}-${Date.now()}`);toast(copy.unmatchedMsg,'ok');navigate('bank-rec',{statementId:selected.id});}catch(error){toast((error&&error.message)||copy.error,'danger');button.disabled=false;}}));
    root.querySelector('[data-bank-complete]')?.addEventListener('click',()=>{appModal({icon:'check',title:copy.completeTitle,body:`<div class="risk warn">${ic('lock')}<div><b>${esc(copy.completeBody)}</b><small>${esc(selected.statementNo)} · ${matched}/${detail.lines.length}</small></div></div>`,actions:`${btn(copy.cancel,{cls:'soft',attrs:'data-bank-complete-cancel'})}${btn(copy.confirm,{icon:'check',cls:'primary',attrs:'data-bank-complete-confirm'})}`});document.querySelector('[data-bank-complete-cancel]')?.addEventListener('click',closeModal);document.querySelector('[data-bank-complete-confirm]')?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await window.ErpSystemData.action('finance/bank-statements',selected.id,'reconcile',{},`bank-reconcile-${selected.id}`);closeModal();toast(copy.done,'ok');navigate('bank-rec',{statementId:selected.id});}catch(error){toast((error&&error.message)||copy.error,'danger');button.disabled=false;}});});
  }
  render();
};

/* ---------------- INCOME STATEMENT (P&L report) ---------------- */
SCREENS['pnl'] = async function(root){
  await prepareCanonicalFinanceData();
  function sum(rows,k){ return rows.reduce((s,r)=>s+r[k],0); }
  // compute running subtotals
  const rev=DB.pnl[0], cos=DB.pnl[1], opex=DB.pnl[3];
  const gp={cur:sum(rev.rows,'cur')+sum(cos.rows,'cur'), ytd:sum(rev.rows,'ytd')+sum(cos.rows,'ytd'), bud:sum(rev.rows,'bud')+sum(cos.rows,'bud')};
  const op={cur:gp.cur+sum(opex.rows,'cur'), ytd:gp.ytd+sum(opex.rows,'ytd'), bud:gp.bud+sum(opex.rows,'bud')};
  function varCell(ytd,bud){ const v=ytd-bud, pct=bud?v/Math.abs(bud)*100:0; const cls=v>=0?'pos':'neg'; return `<b class="tnum delta ${cls}">${v>=0?'+':''}${pct.toFixed(1)}%</b>`; }
  const tpl='minmax(220px,2.4fr) 130px 150px 150px 90px';
  let body='';
  function headRow(g){
    const cur=sum(g.rows,'cur'), ytd=sum(g.rows,'ytd'), bud=sum(g.rows,'bud');
    body+=`<div class="dt-r" style="background:var(--surface-3);font-weight:700"><div class="dt-c l">${esc(g.grp)}</div><div class="dt-c r tnum">${pnlCell(cur)}</div><div class="dt-c r tnum">${pnlCell(ytd)}</div><div class="dt-c r tnum" style="color:var(--muted)">${pnlCell(bud)}</div><div class="dt-c r">${varCell(ytd,bud)}</div></div>`;
    g.rows.forEach(r=>{ body+=`<div class="dt-r"><div class="dt-c l indent1">${esc(r.name)}</div><div class="dt-c r tnum">${pnlCell(r.cur)}</div><div class="dt-c r tnum">${pnlCell(r.ytd)}</div><div class="dt-c r tnum" style="color:var(--muted)">${pnlCell(r.bud)}</div><div class="dt-c r">${varCell(r.ytd,r.bud)}</div></div>`; });
  }
  function subtotal(label,o){
    body+=`<div class="dt-r grandtotal"><div class="dt-c l">${esc(label)}</div><div class="dt-c r tnum">${pnlCell(o.cur)}</div><div class="dt-c r tnum">${pnlCell(o.ytd)}</div><div class="dt-c r tnum" style="color:var(--muted)">${pnlCell(o.bud)}</div><div class="dt-c r">${varCell(o.ytd,o.bud)}</div></div>`;
  }
  headRow(rev); headRow(cos); subtotal('Gross profit',gp); headRow(opex); subtotal('Operating profit (Net)',op);
  const revenueYtd=sum(rev.rows,'ytd');
  const gpMargin=(revenueYtd?op.ytd/revenueYtd*100:0).toFixed(1);

  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>Parameters</h3>
      <div class="fld"><span>Company</span><select><option>${esc(DB.company.name)}</option><option>All companies (consolidated)</option></select></div>
      <div class="fld"><span>Period</span><select><option>All canonical postings</option></select></div>
      <div class="fld"><span>Compare to</span><select><option>Actual reference</option></select></div>
      <div class="fld"><span>Basis</span><select><option>Accrual</option><option>Cash</option></select></div>
      ${btn('Run report',{icon:'play',cls:'primary',sm:false,attrs:'onclick="toast(\'Income statement refreshed\',\'ok\')"'})}
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Income Statement (P&amp;L)</b><div class="report-meta">${DB.company.name} · canonical posted entries${DB.financeReadMeta&&DB.financeReadMeta.truncated?' · first 100 rows':''} · net margin ${gpMargin}% · reference equals actual until budgets are modeled</div></div>
        <div class="grow"></div>
        ${btn('Excel',{icon:'filexls',cls:'soft'})}${btn('Print',{icon:'print',cls:'soft'})}
      </div>
      <div class="tablewrap"><div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
        <div class="dt-r dt-head"><div class="dt-c l">Account</div><div class="dt-c r">This period</div><div class="dt-c r">YTD</div><div class="dt-c r">Actual reference</div><div class="dt-c r">Var %</div></div>
        <div class="dt-body">${body}</div>
      </div></div></div>
    </div>
  </div></section></div>`;
};

/* ---------------- AR AGING (report) ---------------- */
SCREENS['ar-aging'] = async function(root){
  await prepareCanonicalFinanceData();
  const keys=['cur','b30','b60','b90','b90p'];
  const colTot=k=>DB.arAging.reduce((s,r)=>s+r[k],0);
  const rowTot=r=>keys.reduce((s,k)=>s+r[k],0);
  const grand=DB.arAging.reduce((s,r)=>s+rowTot(r),0);
  const overdue=colTot('b30')+colTot('b60')+colTot('b90')+colTot('b90p');
  const overduePct=grand?Math.round(overdue/grand*100):0;
  function amt(v){ return v?`<span class="tnum">${money0(v)}</span>`:`<span style="color:var(--faint)">—</span>`; }
  const tpl='minmax(200px,2fr) 110px 110px 110px 110px 120px 130px';
  let body='';
  DB.arAging.slice().sort((a,b)=>rowTot(b)-rowTot(a)).forEach(r=>{
    const od=r.b30+r.b60+r.b90+r.b90p;
    body+=`<div class="dt-r drill" data-code="${esc(r.code)}">
      <div class="dt-c l"><div class="cellsub"><b>${esc(r.cust)}</b><small>${esc(r.code)}</small></div></div>
      <div class="dt-c r">${amt(r.cur)}</div>
      <div class="dt-c r" style="color:${r.b30?'var(--fg)':''}">${amt(r.b30)}</div>
      <div class="dt-c r" style="color:${r.b60?'var(--warn)':''}">${amt(r.b60)}</div>
      <div class="dt-c r" style="color:${r.b90?'var(--warn)':''}">${amt(r.b90)}</div>
      <div class="dt-c r" style="color:${r.b90p?'var(--danger)':''}">${amt(r.b90p)}</div>
      <div class="dt-c r tnum"><b>${money0(rowTot(r))}</b>${od>0?`<small style="display:block;color:var(--danger);font-size:10.5px">${money0(od)} overdue</small>`:''}</div></div>`;
  });
  body+=`<div class="dt-r grandtotal"><div class="dt-c l">Total receivables</div><div class="dt-c r tnum">${money0(colTot('cur'))}</div><div class="dt-c r tnum">${money0(colTot('b30'))}</div><div class="dt-c r tnum">${money0(colTot('b60'))}</div><div class="dt-c r tnum">${money0(colTot('b90'))}</div><div class="dt-c r tnum">${money0(colTot('b90p'))}</div><div class="dt-c r tnum"><b>${money0(grand)}</b></div></div>`;

  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>Parameters</h3>
      <div class="fld"><span>As at date</span><select><option>${esc(DB.financeAsAt)}</option></select></div>
      <div class="fld"><span>Aging buckets</span><select><option>30 / 60 / 90 days</option><option>15 / 30 / 45 days</option></select></div>
      <div class="fld"><span>Customer</span><select><option>All customers</option><option>Overdue only</option></select></div>
      <div class="fld"><span>Currency</span><select><option>${esc(DB.company.currency)} (functional)</option></select></div>
      ${btn('Run report',{icon:'play',cls:'primary',sm:false,attrs:'onclick="toast(\'Aging recalculated\',\'ok\')"'})}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:4px">
        <div class="indicator ${overduePct>20?'warn':'ok'}"><div class="ind-top">${ic('receipt')}<span>Overdue</span><span class="ind-r">${overduePct}%</span></div><div class="track"><i style="width:${overduePct}%"></i></div><small>${money0(overdue)} of ${money0(grand)} past due.</small></div>
      </div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Accounts Receivable Aging</b><div class="report-meta">As at ${esc(DB.financeAsAt)} · ${DB.arAging.length} customers · ${money0(overdue)} overdue${DB.financeReadMeta&&DB.financeReadMeta.truncated?' · first 100 rows':''}</div></div>
        <div class="grow"></div>
        ${btn('Excel',{icon:'filexls',cls:'soft'})}
      </div>
      <div class="tablewrap"><div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
        <div class="dt-r dt-head"><div class="dt-c l">Customer</div><div class="dt-c r">Not due</div><div class="dt-c r">1–30</div><div class="dt-c r">31–60</div><div class="dt-c r">61–90</div><div class="dt-c r">90+</div><div class="dt-c r">Total</div></div>
        <div class="dt-body">${body}</div>
      </div></div></div>
    </div>
  </div></section></div>`;
  root.querySelectorAll('.dt-r.drill').forEach(tr=>tr.addEventListener('click',()=>{
    toast('Customer detail · '+tr.dataset.code,'info');
  }));
};
