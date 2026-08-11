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
  const FILTER_COPY={
    en:{search:'Search merchant, receipt no., notes or category',period:'Period',thisMonth:'This Month',lastMonth:'Last Month',thisQuarter:'This Quarter',thisYear:'This Year',custom:'Custom',allDates:'All Dates',from:'Date From',to:'Date To',apply:'Apply',clear:'Clear',invalid:'Date From must be on or before Date To.',missing:'Missing Date',missingHelp:'Add the transaction date from My Receipts; dated ranges exclude this record.'},
    zh:{search:'搜索商户、收据编号、备注或类别',period:'期间',thisMonth:'本月',lastMonth:'上月',thisQuarter:'本季度',thisYear:'本年',custom:'自定义',allDates:'全部日期',from:'开始日期',to:'结束日期',apply:'应用',clear:'清除',invalid:'开始日期不得晚于结束日期。',missing:'缺少日期',missingHelp:'请在“我的收据”补充交易日期；日期范围会排除此记录。'},
    ms:{search:'Cari peniaga, no. resit, nota atau kategori',period:'Tempoh',thisMonth:'Bulan Ini',lastMonth:'Bulan Lepas',thisQuarter:'Suku Ini',thisYear:'Tahun Ini',custom:'Tersuai',allDates:'Semua Tarikh',from:'Tarikh Dari',to:'Tarikh Hingga',apply:'Guna',clear:'Kosongkan',invalid:'Tarikh Dari mesti sebelum atau sama dengan Tarikh Hingga.',missing:'Tarikh Tiada',missingHelp:'Tambah tarikh transaksi di Resit Saya; julat bertarikh mengecualikan rekod ini.'},
    vi:{search:'Tìm nhà cung cấp, số biên lai, ghi chú hoặc danh mục',period:'Kỳ',thisMonth:'Tháng này',lastMonth:'Tháng trước',thisQuarter:'Quý này',thisYear:'Năm nay',custom:'Tùy chỉnh',allDates:'Mọi ngày',from:'Từ ngày',to:'Đến ngày',apply:'Áp dụng',clear:'Xóa',invalid:'Từ ngày phải trước hoặc bằng Đến ngày.',missing:'Thiếu ngày',missingHelp:'Thêm ngày giao dịch trong Biên lai của tôi; khoảng ngày sẽ loại bản ghi này.'},
    ja:{search:'加盟店、領収書番号、メモ、カテゴリを検索',period:'期間',thisMonth:'今月',lastMonth:'先月',thisQuarter:'今四半期',thisYear:'今年',custom:'カスタム',allDates:'全期間',from:'開始日',to:'終了日',apply:'適用',clear:'クリア',invalid:'開始日は終了日以前にしてください。',missing:'日付なし',missingHelp:'自分の領収書で取引日を追加してください。日付範囲では除外されます。'},
  };
  const PACK_COPY={
    en:{preview:'Preview Pack',pdf:'PDF',print:'Print',packTitle:'Company Receipt Pack',packRange:'Choose both Date From and Date To before creating a Receipt Pack.',packBusy:'Building Receipt Pack…',packError:'Receipt Pack could not be created.',close:'Close'},
    zh:{preview:'预览收据包',pdf:'PDF',print:'打印',packTitle:'公司收据包',packRange:'创建收据包前请选择开始日期和结束日期。',packBusy:'正在生成收据包…',packError:'无法生成收据包。',close:'关闭'},
    ms:{preview:'Pratonton Pek',pdf:'PDF',print:'Cetak',packTitle:'Pek Resit Syarikat',packRange:'Pilih Tarikh Dari dan Tarikh Hingga sebelum mencipta Pek Resit.',packBusy:'Membina Pek Resit…',packError:'Pek Resit tidak dapat dicipta.',close:'Tutup'},
    vi:{preview:'Xem trước gói',pdf:'PDF',print:'In',packTitle:'Gói biên lai công ty',packRange:'Chọn cả Từ ngày và Đến ngày trước khi tạo Gói biên lai.',packBusy:'Đang tạo Gói biên lai…',packError:'Không thể tạo Gói biên lai.',close:'Đóng'},
    ja:{preview:'パックをプレビュー',pdf:'PDF',print:'印刷',packTitle:'会社領収書パック',packRange:'領収書パックを作成する前に開始日と終了日を選択してください。',packBusy:'領収書パックを作成中…',packError:'領収書パックを作成できませんでした。',close:'閉じる'},
  };
  function copy(){const lang=typeof getLang==='function'?getLang():'en';return {...(COPY[lang]||COPY.en),...(FILTER_COPY[lang]||FILTER_COPY.en),...(PACK_COPY[lang]||PACK_COPY.en)};}
  function statusTone(value){return value==='ready'?'ok':value==='voided'?'neutral':'info';}
  function statusLabel(value){
    const text=String(value||'—').replace(/_/g,' ');
    return text==='—'?text:text.charAt(0).toUpperCase()+text.slice(1);
  }
  function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function presetRange(value){
    const now=new Date(),year=now.getFullYear(),month=now.getMonth();
    if(value==='thisMonth') return [iso(new Date(year,month,1)),iso(new Date(year,month+1,0))];
    if(value==='lastMonth') return [iso(new Date(year,month-1,1)),iso(new Date(year,month,0))];
    if(value==='thisQuarter'){const start=Math.floor(month/3)*3;return [iso(new Date(year,start,1)),iso(new Date(year,start+3,0))];}
    if(value==='thisYear') return [`${year}-01-01`,`${year}-12-31`];
    return [null,null];
  }

  SCREENS['company-receipts']=async function(root){
    const c=copy();
    const adapter=window.ErpSystemData;
    if(!adapter||typeof adapter.companyReceipts!=='function'){
      throw new Error('Company Receipts adapter is unavailable.');
    }
    const pageSize=25;
    const filters={search:'',dateFrom:null,dateTo:null,preset:'allDates'};
    let response=await adapter.companyReceipts({limit:pageSize});
    let rows=Array.isArray(response&&response.data)?response.data:[];
    let meta=response&&response.meta||{};
    let loadingMore=false;
    let loadError='';
    let currentPack=null;
    let page;
    async function reload(){
      response=await adapter.companyReceipts({limit:pageSize,search:filters.search,dateFrom:filters.dateFrom,dateTo:filters.dateTo});
      rows=Array.isArray(response&&response.data)?response.data:[];
      meta=response&&response.meta||{};
      currentPack=null;
    }
    function captureFilters(form){
      filters.search=form.querySelector('[data-receipt-search]').value.trim();
      filters.dateFrom=form.querySelector('[data-receipt-from]').value||null;
      filters.dateTo=form.querySelector('[data-receipt-to]').value||null;
      if(filters.dateFrom&&filters.dateTo&&filters.dateFrom>filters.dateTo) throw new Error(c.invalid);
    }
    async function ensurePack(form){
      captureFilters(form);
      if(!filters.dateFrom||!filters.dateTo) throw new Error(c.packRange);
      if(currentPack)return currentPack;
      if(typeof adapter.companyReceiptPack!=='function') throw new Error(c.packError);
      const response=await adapter.companyReceiptPack({
        packKey:`company-receipt-pack:${crypto.randomUUID()}`,
        search:filters.search,dateFrom:filters.dateFrom,dateTo:filters.dateTo,
        locale:typeof getLang==='function'?getLang():'en',
      });
      currentPack=response.data&&response.data.pack;
      if(!currentPack) throw new Error(c.packError);
      return currentPack;
    }
    async function getPackPdf(form,action){
      const pack=await ensurePack(form);
      if(typeof adapter.companyReceiptPackPdf!=='function') throw new Error(c.packError);
      const response=await adapter.companyReceiptPackPdf(pack.id,action);
      const content=response.data&&response.data.content;
      if(!content) throw new Error(c.packError);
      return {pack,response,url:URL.createObjectURL(new Blob([content],{type:'application/pdf'}))};
    }
    const scopeLabel=()=>meta.scope==='company'?c.company:c.own;
    const pagination=()=>{
      const summary=`<span>${esc(scopeLabel())} · ${rows.length} ${esc(c.loaded)}</span>`;
      const error=loadError?`<span class="danger">${esc(loadError)}</span>`:'';
      if(!meta.nextCursor) return `${summary}${error}`;
      return `${summary}${btn(loadingMore?c.loading:c.more,{icon:'down',cls:'soft',
        attrs:`data-company-receipts-more${loadingMore?' disabled':''}`})}${error}`;
    };
    page=transactionListPage(root,{
      module:typeof routeModuleId==='function'?routeModuleId('company-receipts'):'mywork',
      route:'company-receipts',title:c.title,description:c.sub,rows:()=>rows,
      rowId:row=>row.id,recordPreview:false,count:()=>rows.length,
      kpis:[{label:scopeLabel,value:()=>rows.length}],
      toolbarContent:()=>`<form class="company-receipt-filters" data-company-receipt-filters>
        <input type="search" data-receipt-search value="${esc(filters.search)}" placeholder="${esc(c.search)}" aria-label="${esc(c.search)}">
        <select data-receipt-preset aria-label="${esc(c.period)}">${[['allDates',c.allDates],['thisMonth',c.thisMonth],['lastMonth',c.lastMonth],['thisQuarter',c.thisQuarter],['thisYear',c.thisYear],['custom',c.custom]].map(([value,label])=>`<option value="${value}" ${filters.preset===value?'selected':''}>${esc(label)}</option>`).join('')}</select>
        <label><span>${esc(c.from)}</span><input type="date" data-receipt-from value="${esc(filters.dateFrom||'')}"></label>
        <label><span>${esc(c.to)}</span><input type="date" data-receipt-to value="${esc(filters.dateTo||'')}"></label>
        ${btn(c.apply,{icon:'search',cls:'primary',attrs:'type="submit"'})}${btn(c.clear,{cls:'soft',attrs:'type="button" data-receipt-clear'})}
        ${btn(c.preview,{icon:'eye',cls:'soft',attrs:'type="button" data-receipt-pack-preview'})}
        ${btn(c.pdf,{icon:'filepdf',cls:'soft',attrs:'type="button" data-receipt-pack-pdf'})}
        ${btn(c.print,{icon:'print',cls:'soft',attrs:'type="button" data-receipt-pack-print'})}
      </form>`,
      columns:[
        {key:'transactionDate',label:c.date,render:row=>row.transactionDate?esc(dateValue(row.transactionDate)):`<button class="badge warn" data-missing-date-route title="${esc(c.missingHelp)}">${esc(c.missing)}</button>`},
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
        screenRoot.querySelectorAll('[data-missing-date-route]').forEach(button=>button.addEventListener('click',event=>{
          event.stopPropagation();navigate('my-receipts');
        }));
        screenRoot.querySelector('[data-company-receipts-more]')?.addEventListener('click',async()=>{
          if(loadingMore||!meta.nextCursor) return;
          loadingMore=true;loadError='';page.render();
          try{
            response=await adapter.companyReceipts({limit:pageSize,afterId:meta.nextCursor,search:filters.search,dateFrom:filters.dateFrom,dateTo:filters.dateTo});
            const next=Array.isArray(response&&response.data)?response.data:[];
            const known=new Set(rows.map(row=>String(row.id)));
            rows=rows.concat(next.filter(row=>!known.has(String(row.id))));
            meta=response&&response.meta||{};
          }catch(error){loadError=String(error&&error.message||error);}
          finally{loadingMore=false;page.render();}
        });
        screenRoot.querySelector('[data-receipt-preset]')?.addEventListener('change',event=>{
          filters.preset=event.currentTarget.value;
          [filters.dateFrom,filters.dateTo]=presetRange(filters.preset);
          page.render();
        });
        screenRoot.querySelector('[data-company-receipt-filters]')?.addEventListener('submit',async event=>{
          event.preventDefault();
          try{captureFilters(event.currentTarget);}catch(error){loadError=String(error&&error.message||error);page.render();return;}
          loadError='';try{await reload();}catch(error){loadError=String(error&&error.message||error);}page.render();
        });
        screenRoot.querySelector('[data-receipt-clear]')?.addEventListener('click',async()=>{
          Object.assign(filters,{search:'',dateFrom:null,dateTo:null,preset:'allDates'});
          loadError='';await reload();page.render();
        });
        screenRoot.querySelector('[data-receipt-pack-preview]')?.addEventListener('click',async event=>{
          const button=event.currentTarget,form=screenRoot.querySelector('[data-company-receipt-filters]');
          button.disabled=true;loadError='';
          try{
            const result=await getPackPdf(form,'view');
            appModal({icon:'filepdf',title:c.packTitle,
              body:`<div class="company-receipt-pack-frame"><iframe src="${esc(result.url)}" title="${esc(c.packTitle)}"></iframe></div>`,
              actions:btn(c.close,{attrs:'onclick="closeModal()"'})});
            setTimeout(()=>URL.revokeObjectURL(result.url),300000);
          }catch(error){loadError=String(error&&error.message||c.packError);page.render();}
          finally{button.disabled=false;}
        });
        screenRoot.querySelector('[data-receipt-pack-pdf]')?.addEventListener('click',async event=>{
          const button=event.currentTarget,form=screenRoot.querySelector('[data-company-receipt-filters]');
          button.disabled=true;loadError='';
          try{
            const result=await getPackPdf(form,'download');
            const link=document.createElement('a');link.href=result.url;
            link.download=`company-receipt-pack-${result.pack.filters.dateFrom}-${result.pack.filters.dateTo}.pdf`;
            link.click();setTimeout(()=>URL.revokeObjectURL(result.url),60000);
          }catch(error){loadError=String(error&&error.message||c.packError);page.render();}
          finally{button.disabled=false;}
        });
        screenRoot.querySelector('[data-receipt-pack-print]')?.addEventListener('click',async event=>{
          const button=event.currentTarget,form=screenRoot.querySelector('[data-company-receipt-filters]');
          button.disabled=true;loadError='';
          try{
            const result=await getPackPdf(form,'print');
            const opened=window.open(result.url,'_blank','noopener');
            if(!opened)throw new Error(c.packError);
            setTimeout(()=>URL.revokeObjectURL(result.url),300000);
          }catch(error){loadError=String(error&&error.message||c.packError);page.render();}
          finally{button.disabled=false;}
        });
      },
    });
  };
})();
