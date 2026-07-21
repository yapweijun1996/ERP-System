/* ============================================================
   ARIA ERP — New Journal Entry composer (create flow)
   Single-screen double-entry editor: header + balanced
   debit/credit lines with a live balance check. Posts to the
   GL only when Dr = Cr. Reached from Quick create, the command
   palette and the GL / Journal screens.
   ============================================================ */
SCREENS['new-journal-entry'] = function(root){
  const TODAY='2026-06-21';
  const canPost=DB.user.perms && DB.user.perms.post;

  const S={ date:TODAY, period:'P06', memo:'', reference:'', type:'Standard',
    lines:[ blank(), blank() ] };
  function blank(){ return {acct:'', dim:'', dr:0, cr:0}; }

  function totals(){
    let dr=0,cr=0; S.lines.forEach(l=>{ dr+=+l.dr||0; cr+=+l.cr||0; });
    return {dr,cr,diff:dr-cr,balanced:Math.abs(dr-cr)<0.005 && (dr>0||cr>0)};
  }
  function acctOptions(sel){
    return `<option value="">Select account…</option>`+DB.coa.map(g=>
      `<optgroup label="${esc(g.grp)}">`+g.accts.map(a=>
        `<option value="${a.code}" ${a.code===sel?'selected':''}>${esc(a.code)} · ${esc(a.name)}</option>`).join('')+`</optgroup>`).join('');
  }

  /* ---------------- lines ---------------- */
  function lineRows(){
    return S.lines.map((l,i)=>`<tr data-i="${i}">
      <td class="lineno">${i+1}</td>
      <td class="l"><select class="lineinput wAcct" style="width:100%;min-width:200px">${acctOptions(l.acct)}</select></td>
      <td class="l"><input class="lineinput wDim" value="${esc(l.dim)}" placeholder="Cost centre / project" style="width:100%;min-width:150px"></td>
      <td><input class="lineinput wDr" type="number" min="0" step="0.01" value="${l.dr||''}" placeholder="0.00" style="width:104px;text-align:right"></td>
      <td><input class="lineinput wCr" type="number" min="0" step="0.01" value="${l.cr||''}" placeholder="0.00" style="width:104px;text-align:right"></td>
      <td style="text-align:center"><button class="iconbtn wDel" data-tip="Remove line" style="width:28px;height:28px" ${S.lines.length<=2?'disabled style="opacity:.4"':''}>${ic('trash')}</button></td></tr>`).join('');
  }
  function totalsRow(){
    const t=totals();
    return `<div class="linefoot" style="display:flex;align-items:center;justify-content:flex-end;gap:26px;font-weight:600;padding:12px 14px">
      <span style="color:var(--muted);margin-right:auto;padding-left:6px">${S.lines.filter(l=>l.acct).length} of ${S.lines.length} lines coded</span>
      <span class="tnum">Dr ${money(t.dr)}</span><span class="tnum">Cr ${money(t.cr)}</span>
      <span id="wBalCap">${t.balanced?cap('Balanced','ok'):cap(t.dr||t.cr?'Out of balance':'Empty',t.dr||t.cr?'danger':'neutral')}</span></div>`;
  }
  function refreshLines(){
    $('#wLines').innerHTML=lineRows();
    $('#wFoot').innerHTML=totalsRow();
    $('#wSummary').innerHTML=summaryCard();
    bindLines(); updateBar();
  }
  function bindLines(){
    $$('#wLines tr[data-i]').forEach(tr=>{
      const i=+tr.dataset.i, l=S.lines[i];
      const ac=tr.querySelector('.wAcct'), dim=tr.querySelector('.wDim'),
            dr=tr.querySelector('.wDr'), cr=tr.querySelector('.wCr');
      ac.addEventListener('change',()=>{ l.acct=ac.value; recalc(); });
      dim.addEventListener('input',()=>l.dim=dim.value);
      // entering a debit zeroes the credit on the same line, and vice-versa
      dr.addEventListener('input',()=>{ l.dr=+dr.value||0; if(l.dr){ l.cr=0; cr.value=''; } recalc(); });
      cr.addEventListener('input',()=>{ l.cr=+cr.value||0; if(l.cr){ l.dr=0; dr.value=''; } recalc(); });
      tr.querySelector('.wDel').addEventListener('click',()=>{ if(S.lines.length>2){ S.lines.splice(i,1); refreshLines(); } });
    });
  }
  function recalc(){ $('#wFoot').innerHTML=totalsRow(); $('#wSummary').innerHTML=summaryCard(); updateBar(); }

  /* ---------------- summary / post card ---------------- */
  function summaryCard(){
    const t=totals();
    return `<div class="sumcard">
      <div class="sumrow"><span class="sk2">Total debit</span><span class="sv tnum">${money(t.dr)}</span></div>
      <div class="sumrow"><span class="sk2">Total credit</span><span class="sv tnum">${money(t.cr)}</span></div>
      <div class="sumrow total"><span class="sk2">Difference</span><span class="sv tnum">${money(Math.abs(t.diff))}</span></div>
      <div style="margin-top:10px">${t.balanced
        ?indicator({tone:'ok',icon:'checkc',label:'Entry balances',value:'Dr = Cr'})
        :indicator({tone:t.dr||t.cr?'danger':'warn',icon:'warn',label:'Must balance to post',
            value:t.diff>0?'Dr heavy':t.diff<0?'Cr heavy':'—',
            sub:t.dr||t.cr?`Add ${money(Math.abs(t.diff))} to the ${t.diff>0?'credit':'debit'} side.`:'Enter debits and credits.'})}</div>
    </div>`;
  }

  /* ---------------- bottom bar ---------------- */
  function bar(){
    const t=totals();
    const ok=t.balanced;
    const hint=ok?'Balanced · ready to post':'Debits must equal credits before posting';
    const postBtn= canPost
      ? btn('Post to GL',{icon:'check',cls:'primary',sm:false,attrs:`id="wPost" ${ok?'':'disabled style="opacity:.5;pointer-events:none"'}`})
      : `<button class="btn primary" disabled data-tip="Requires Finance Posting permission" style="opacity:.6">${ic('lock')}<span>Post to GL</span></button>`;
    return `<div style="font-size:12.5px;color:${ok?'var(--ok)':'var(--muted)'}" class="hideonsmall">${ok?ic('checkc'):''} ${hint}</div>
      <div class="grow"></div>
      ${btn('Cancel',{cls:'soft',attrs:'id="wCancel"'})}
      ${btn('Save draft',{icon:'save',cls:'soft',attrs:'id="wDraft"'})}
      ${postBtn}`;
  }
  function updateBar(){ const b=$('#wBar'); if(b){ b.innerHTML=bar(); wireBar(); } }

  /* ---------------- render ---------------- */
  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="New Journal Entry">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,'Finance','Journal Entry',{cur:'New'}])}
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic('book')}New Journal Entry</div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">Draft · manual double-entry · ${esc(DB.company.name)}</div></div>
            <div class="dactions">${cap('Draft','neutral')}</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-h">${ic('receipt')}<h3>Entry details</h3></div>
          <div class="panel-body">
            <div class="fldrow c3">
              <div class="fld"><span>Posting date</span><input type="date" id="wDate" value="${S.date}"></div>
              <div class="fld"><span>Period</span><select id="wPeriod"><option value="P06" selected>P06 · June 2026 (Open)</option><option value="P05" disabled>P05 · May 2026 (Locked)</option></select></div>
              <div class="fld"><span>Journal type</span><select id="wType">${['Standard','Accrual','Reversing','FX revaluation','Reclassification'].map(t=>`<option ${t===S.type?'selected':''}>${t}</option>`).join('')}</select></div>
            </div>
            <div class="fldrow c2" style="margin-top:12px">
              <div class="fld"><span>Memo / description <span class="req">*</span></span><input id="wMemo" value="${esc(S.memo)}" placeholder="e.g. Reclassify prepaid insurance to expense"></div>
              <div class="fld"><span>Reference</span><input id="wRef" value="${esc(S.reference)}" placeholder="Source doc / batch ref"></div>
            </div>
          </div>
        </div>

        <div class="doclayout"><div class="docmain">
          <div class="panel">
            <div class="panel-h">${ic('book')}<h3>Journal lines</h3>
              <button class="btn soft sm" id="wAddLine" style="margin-left:auto">${ic('plus')}<span>Add line</span></button></div>
            <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Account</th><th class="l">Dimension</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th></th></tr></thead>
              <tbody id="wLines">${lineRows()}</tbody></table>
            <div id="wFoot">${totalsRow()}</div>
          </div>
        </div>
        <aside class="summary" id="wSummary">${summaryCard()}
          <div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:8px">Period status</div>
            ${indicator({tone:'ok',icon:'unlock',label:'P06 · June 2026',value:'Open'})}
          </div>
        </aside></div>
        <div style="height:8px"></div>
      </div></div>
      <div class="set-savebar" id="wBar">${bar()}</div>
    </section></div>`;
    bindHeader(); bindLines(); wireBar();
  }
  function bindHeader(){
    const b=(id,key,ev='change')=>{ const el=$('#'+id); el&&el.addEventListener(ev,()=>S[key]=el.value); };
    b('wDate','date'); b('wPeriod','period'); b('wType','type');
    b('wMemo','memo','input'); b('wRef','reference','input');
    $('#wAddLine').addEventListener('click',()=>{ S.lines.push(blank()); refreshLines(); });
  }
  function wireBar(){
    const cancel=$('#wCancel'); cancel&&cancel.addEventListener('click',()=>navigate('gl'));
    const draft=$('#wDraft'); draft&&draft.addEventListener('click',()=>toast('Journal saved as draft','info'));
    const post=$('#wPost'); post&&post.addEventListener('click',()=>{
      const t=totals();
      appModal({
        icon: 'book',
        title: 'Post journal to GL?',
        body: `<div class="risk warn" style="margin:0 0 12px">${ic('warn')}<div><b>This action is irreversible.</b><small>Posting writes this entry to the ledger for period ${esc(S.period)}. Corrections require a reversing entry.</small></div></div>
          <div class="sumrow"><span class="sk2">Total debit</span><span class="sv tnum">${money(t.dr)}</span></div>
          <div class="sumrow"><span class="sk2">Total credit</span><span class="sv tnum">${money(t.cr)}</span></div>
          <div class="sumrow total"><span class="sk2">Lines</span><span class="sv tnum">${S.lines.filter(l=>l.acct).length}</span></div>`,
        actions: `${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Confirm & post',{icon:'check',cls:'primary',attrs:'onclick="closeModal();window.__jePosted&&window.__jePosted()"'})}`,
      });
      window.__jePosted=()=>{ navigate('gl'); setTimeout(()=>toast(`Journal JE-26-0613 posted to GL · ${money0(t.dr)} · period ${S.period}`,'ok'),180); };
    });
  }
  render();
};
