/* Company Receipts register (TASK-179).
   Reads are permission-scoped by the API/demo adapter; this screen never
   broadens or filters tenant data in the browser. Search/date filters belong
   to TASK-180. */
(function companyReceiptRegisterScreen(){
  'use strict';

  const COPY={
    en:{title:'Company Receipts',sub:'Confirmed receipt records in your authorised scope.',date:'Date',merchant:'Merchant',number:'Receipt no.',category:'Category',amount:'Amount',currency:'Currency',uploader:'Uploader',status:'Status',empty:'No Company Receipts',emptyBody:'Confirmed receipts will appear here.',more:'Load more',loading:'Loading…',own:'My receipts',company:'Company register',loaded:'loaded'},
    zh:{title:'公司收据',sub:'显示您获授权范围内的已确认收据记录。',date:'日期',merchant:'商户',number:'收据编号',category:'类别',amount:'金额',currency:'币种',uploader:'上传者',status:'状态',empty:'暂无公司收据',emptyBody:'已确认的收据会显示在这里。',more:'加载更多',loading:'加载中…',own:'我的收据',company:'公司登记册',loaded:'已加载'},
    ms:{title:'Resit Syarikat',sub:'Rekod resit disahkan dalam skop yang dibenarkan.',date:'Tarikh',merchant:'Peniaga',number:'No. resit',category:'Kategori',amount:'Amaun',currency:'Mata wang',uploader:'Pemuat naik',status:'Status',empty:'Tiada Resit Syarikat',emptyBody:'Resit yang disahkan akan dipaparkan di sini.',more:'Muat lagi',loading:'Memuat…',own:'Resit saya',company:'Daftar syarikat',loaded:'dimuat'},
    vi:{title:'Biên lai công ty',sub:'Các biên lai đã xác nhận trong phạm vi được cấp quyền.',date:'Ngày',merchant:'Nhà cung cấp',number:'Số biên lai',category:'Danh mục',amount:'Số tiền',currency:'Tiền tệ',uploader:'Người tải lên',status:'Trạng thái',empty:'Không có biên lai công ty',emptyBody:'Biên lai đã xác nhận sẽ xuất hiện tại đây.',more:'Tải thêm',loading:'Đang tải…',own:'Biên lai của tôi',company:'Sổ công ty',loaded:'đã tải'},
    ja:{title:'会社領収書',sub:'許可された範囲の確認済み領収書レコードです。',date:'日付',merchant:'加盟店',number:'領収書番号',category:'カテゴリ',amount:'金額',currency:'通貨',uploader:'アップロード者',status:'状態',empty:'会社領収書はありません',emptyBody:'確認済みの領収書がここに表示されます。',more:'さらに読み込む',loading:'読み込み中…',own:'自分の領収書',company:'会社台帳',loaded:'件読込'},
  };
  function copy(){return COPY[typeof getLang==='function'?getLang():'en']||COPY.en;}
  function statusTone(value){return value==='ready'?'ok':value==='voided'?'neutral':'info';}
  function statusLabel(value){
    const text=String(value||'—').replace(/_/g,' ');
    return text==='—'?text:text.charAt(0).toUpperCase()+text.slice(1);
  }

  SCREENS['company-receipts']=async function(root){
    const c=copy();
    const adapter=window.ErpSystemData;
    if(!adapter||typeof adapter.companyReceipts!=='function'){
      throw new Error('Company Receipts adapter is unavailable.');
    }
    const pageSize=25;
    let response=await adapter.companyReceipts({limit:pageSize});
    let rows=Array.isArray(response&&response.data)?response.data:[];
    let meta=response&&response.meta||{};
    let loadingMore=false;
    let loadError='';
    let page;
    const scopeLabel=()=>meta.scope==='company'?c.company:c.own;
    const pagination=()=>{
      const summary=`<span>${esc(scopeLabel())} · ${rows.length} ${esc(c.loaded)}</span>`;
      if(!meta.nextCursor) return summary;
      return `${summary}${btn(loadingMore?c.loading:c.more,{icon:'down',cls:'soft',
        attrs:`data-company-receipts-more${loadingMore?' disabled':''}`})}${loadError?`<span class="danger">${esc(loadError)}</span>`:''}`;
    };
    page=transactionListPage(root,{
      module:typeof routeModuleId==='function'?routeModuleId('company-receipts'):'mywork',
      route:'company-receipts',title:c.title,description:c.sub,rows:()=>rows,
      rowId:row=>row.id,recordPreview:false,count:()=>rows.length,
      kpis:[{label:scopeLabel,value:()=>rows.length}],
      columns:[
        {key:'transactionDate',label:c.date,render:row=>esc(dateValue(row.transactionDate||row.createdAt))},
        {key:'merchant',label:c.merchant,primary:true},
        {key:'receiptNumber',label:c.number,render:row=>esc(row.receiptNumber||'—')},
        {key:'category',label:c.category},
        {key:'amount',label:c.amount,numeric:true,render:row=>esc(money(Number(row.amount),row.currency))},
        {key:'currency',label:c.currency},
        {key:'uploaderName',label:c.uploader,render:row=>esc(row.uploaderName||String(row.uploaderUserId||'—'))},
        {key:'status',label:c.status,render:row=>`<span class="badge ${statusTone(row.status)}">${esc(statusLabel(row.status))}</span>`},
      ],
      pagination,
      empty:{icon:'receipt',title:c.empty,description:c.emptyBody},
      afterRender:({root:screenRoot})=>{
        const layout=screenRoot.querySelector('[data-layout="transaction-list-v1"]');
        layout?.setAttribute('data-company-receipt-register','canonical');
        const labels=Array.from(layout?.querySelectorAll('.dt-head .dt-c')||[])
          .map(cell=>cell.textContent.trim());
        layout?.querySelectorAll('.dt-body .dt-r').forEach(row=>{
          row.querySelectorAll('.dt-c').forEach((cell,index)=>{
            cell.dataset.label=labels[index]||'';
          });
        });
        screenRoot.querySelector('[data-company-receipts-more]')?.addEventListener('click',async()=>{
          if(loadingMore||!meta.nextCursor) return;
          loadingMore=true;loadError='';page.render();
          try{
            response=await adapter.companyReceipts({limit:pageSize,afterId:meta.nextCursor});
            const next=Array.isArray(response&&response.data)?response.data:[];
            const known=new Set(rows.map(row=>String(row.id)));
            rows=rows.concat(next.filter(row=>!known.has(String(row.id))));
            meta=response&&response.meta||{};
          }catch(error){loadError=String(error&&error.message||error);}
          finally{loadingMore=false;page.render();}
        });
      },
    });
  };
})();
