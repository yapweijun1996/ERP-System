/* ============================================================
   ARIA ERP — canonical quality screens
   Reads and writes only through the formal ErpSystemData contract.
   ============================================================ */
(function canonicalQualityScreens(){
  function copy(){
    const lang=typeof getLang==='function'?getLang():'en';
    const text={
      en:{
        inspections:'Quality inspections',newInspection:'New inspection',inspection:'Inspection',
        type:'Type',source:'Source',lotQty:'Lot quantity',sampleQty:'Sample quantity',
        inspector:'Inspector',date:'Date',status:'Status',product:'Product',results:'Results',
        characteristic:'Characteristic',specification:'Specification',method:'Method',
        measured:'Measured value',outcome:'Outcome',completePass:'Complete as pass',
        completeFail:'Complete with failure',completed:'Inspection completed',
        ncrs:'Non-conformance',raiseNcr:'Raise NCR',ncrRaised:'NCR raised',
        severity:'Severity',affected:'Affected quantity',defect:'Defect description',
        disposition:'Disposition',corrective:'Corrective actions',release:'Release',
        reject:'Reject / scrap',released:'NCR closed and material released',
        rejected:'NCR closed and material rejected',empty:'No canonical quality records.',
        emptyHelp:'Create an inspection from an active plan.',all:'All',scheduled:'Scheduled',
        inInspection:'In inspection',passed:'Passed',failed:'Failed',closed:'Closed',
        incoming:'Incoming',inProcess:'In process',final:'Final',open:'Open',
        inProgress:'In progress',quarantine:'Quarantine',major:'Major',minor:'Minor',
        critical:'Critical',dataLimit:'Showing the first 100 canonical rows.',
      },
      ms:{
        inspections:'Pemeriksaan kualiti',newInspection:'Pemeriksaan baharu',inspection:'Pemeriksaan',
        type:'Jenis',source:'Sumber',lotQty:'Kuantiti lot',sampleQty:'Kuantiti sampel',
        inspector:'Pemeriksa',date:'Tarikh',status:'Status',product:'Produk',results:'Keputusan',
        characteristic:'Ciri',specification:'Spesifikasi',method:'Kaedah',
        measured:'Nilai diukur',outcome:'Hasil',completePass:'Selesaikan sebagai lulus',
        completeFail:'Selesaikan dengan kegagalan',completed:'Pemeriksaan selesai',
        ncrs:'Ketidakpatuhan',raiseNcr:'Buka NCR',ncrRaised:'NCR dibuka',
        severity:'Keparahan',affected:'Kuantiti terjejas',defect:'Keterangan kecacatan',
        disposition:'Pelupusan',corrective:'Tindakan pembetulan',release:'Lepaskan',
        reject:'Tolak / lupus',released:'NCR ditutup dan bahan dilepaskan',
        rejected:'NCR ditutup dan bahan ditolak',empty:'Tiada rekod kualiti kanonik.',
        emptyHelp:'Cipta pemeriksaan daripada pelan aktif.',all:'Semua',scheduled:'Dijadualkan',
        inInspection:'Sedang diperiksa',passed:'Lulus',failed:'Gagal',closed:'Ditutup',
        incoming:'Masuk',inProcess:'Dalam proses',final:'Akhir',open:'Terbuka',
        inProgress:'Sedang berjalan',quarantine:'Kuarantin',major:'Utama',minor:'Kecil',
        critical:'Kritikal',dataLimit:'Menunjukkan 100 rekod kanonik pertama.',
      },
      zh:{
        inspections:'质量检验',newInspection:'新建检验',inspection:'检验单',
        type:'检验类型',source:'来源',lotQty:'批次数量',sampleQty:'抽样数量',
        inspector:'检验员',date:'日期',status:'状态',product:'物料',results:'检验结果',
        characteristic:'检验项目',specification:'规格',method:'方法',
        measured:'实测值',outcome:'判定',completePass:'全部合格并完成',
        completeFail:'记录不合格并完成',completed:'检验已完成',
        ncrs:'不合格报告',raiseNcr:'创建 NCR',ncrRaised:'NCR 已创建',
        severity:'严重程度',affected:'影响数量',defect:'缺陷说明',
        disposition:'处置',corrective:'纠正措施',release:'放行',
        reject:'拒收 / 报废',released:'NCR 已关闭，物料已放行',
        rejected:'NCR 已关闭，物料已拒收',empty:'目前没有标准质量记录。',
        emptyHelp:'可从有效检验计划创建检验单。',all:'全部',scheduled:'待检',
        inInspection:'检验中',passed:'合格',failed:'不合格',closed:'已关闭',
        incoming:'来料',inProcess:'过程',final:'完工',open:'未关闭',
        inProgress:'处理中',quarantine:'隔离',major:'主要',minor:'轻微',
        critical:'严重',dataLimit:'显示前 100 条标准记录。',
      },
      ja:{
        inspections:'品質検査',newInspection:'新規検査',inspection:'検査',
        type:'種類',source:'ソース',lotQty:'ロット数量',sampleQty:'サンプル数量',
        inspector:'検査員',date:'日付',status:'状態',product:'製品',results:'結果',
        characteristic:'検査項目',specification:'仕様',method:'方法',
        measured:'測定値',outcome:'判定',completePass:'合格として完了',
        completeFail:'不合格として完了',completed:'検査が完了しました',
        ncrs:'不適合',raiseNcr:'NCRを作成',ncrRaised:'NCRを作成しました',
        severity:'重大度',affected:'影響数量',defect:'不具合内容',
        disposition:'処置',corrective:'是正措置',release:'リリース',
        reject:'拒否 / 廃棄',released:'NCRを閉じて材料をリリースしました',
        rejected:'NCRを閉じて材料を拒否しました',empty:'品質レコードがありません。',
        emptyHelp:'有効な計画から検査を作成してください。',all:'すべて',scheduled:'予定',
        inInspection:'検査中',passed:'合格',failed:'不合格',closed:'終了',
        incoming:'受入',inProcess:'工程内',final:'最終',open:'未処理',
        inProgress:'処理中',quarantine:'隔離',major:'重大',minor:'軽微',
        critical:'致命的',dataLimit:'最初の100件を表示しています。',
      },
      vi:{
        inspections:'Kiểm tra chất lượng',newInspection:'Tạo kiểm tra',inspection:'Kiểm tra',
        type:'Loại',source:'Nguồn',lotQty:'Số lượng lô',sampleQty:'Số lượng mẫu',
        inspector:'Người kiểm tra',date:'Ngày',status:'Trạng thái',product:'Sản phẩm',results:'Kết quả',
        characteristic:'Đặc tính',specification:'Quy cách',method:'Phương pháp',
        measured:'Giá trị đo',outcome:'Kết luận',completePass:'Hoàn tất đạt',
        completeFail:'Hoàn tất không đạt',completed:'Đã hoàn tất kiểm tra',
        ncrs:'Không phù hợp',raiseNcr:'Tạo NCR',ncrRaised:'Đã tạo NCR',
        severity:'Mức độ',affected:'Số lượng ảnh hưởng',defect:'Mô tả lỗi',
        disposition:'Xử lý',corrective:'Hành động khắc phục',release:'Giải phóng',
        reject:'Từ chối / loại bỏ',released:'Đã đóng NCR và giải phóng vật tư',
        rejected:'Đã đóng NCR và từ chối vật tư',empty:'Không có hồ sơ chất lượng.',
        emptyHelp:'Tạo kiểm tra từ kế hoạch đang hoạt động.',all:'Tất cả',scheduled:'Đã lên lịch',
        inInspection:'Đang kiểm tra',passed:'Đạt',failed:'Không đạt',closed:'Đã đóng',
        incoming:'Đầu vào',inProcess:'Trong quy trình',final:'Cuối',open:'Mở',
        inProgress:'Đang xử lý',quarantine:'Cách ly',major:'Nặng',minor:'Nhẹ',
        critical:'Nghiêm trọng',dataLimit:'Hiển thị 100 bản ghi đầu tiên.',
      },
    };
    const selected=text[lang]||text.en;
    return key=>selected[key]||text.en[key]||key;
  }
  function adapter(){
    if(!window.ErpSystemData) throw new Error('ERP data adapter is unavailable.');
    return window.ErpSystemData;
  }
  function byId(rows){ return new Map((rows||[]).map(row=>[Number(row.id),row])); }
  function statusLabel(s,value){
    return ({
      scheduled:s('scheduled'),in_inspection:s('inInspection'),passed:s('passed'),
      failed:s('failed'),closed:s('closed'),open:s('open'),in_progress:s('inProgress'),
    })[value]||value;
  }
  function statusTone(value){
    return ({
      scheduled:'neutral',in_inspection:'info',passed:'ok',failed:'danger',
      closed:'neutral',open:'warn',in_progress:'info',
    })[value]||'neutral';
  }
  function typeLabel(s,value){
    return ({incoming:s('incoming'),in_process:s('inProcess'),final:s('final')})[value]||value;
  }
  function openInspection(id){
    window.ACTIVE_QUALITY_INSPECTION_ID=Number(id);
    navigate('qc-report');
  }
  function openNcr(id){
    window.ACTIVE_QUALITY_NCR_ID=Number(id);
    navigate('ncr');
  }

  SCREENS['qc-inspection']=async function(root){
    const a=adapter(),s=copy();
    const [inspectionPage,productPage,planPage]=await Promise.all([
      a.list('quality/inspections',{limit:100}),
      a.list('inventory/products',{limit:100}),
      a.list('quality/plans',{limit:100}),
    ]);
    const inspections=inspectionPage.data||[],products=byId(productPage.data),plans=planPage.data||[];
    let active='all';
    function filtered(){ return active==='all'?inspections:inspections.filter(row=>row.status===active); }
    function table(){
      return buildTable({
        rowId:row=>row.id,
        columns:[
          {label:s('inspection'),sticky:true,render:row=>{
            const item=products.get(Number(row.productId))||{};
            return `<div class="cellsub"><b class="docnum">${esc(row.docNo)}</b>
              <small>${esc(item.sku||'#'+row.productId)} · ${esc(item.name||s('product'))}</small></div>`;
          }},
          {label:s('type'),render:row=>cap(typeLabel(s,row.inspectionType),'accent')},
          {label:s('source'),render:row=>`<div class="cellsub"><b>${esc(row.sourceRef||row.sourceType)}</b><small>${esc(row.sourceType)}</small></div>`},
          {label:s('lotQty'),align:'r',render:row=>`<span class="tnum">${num(Number(row.lotQty))}</span>`},
          {label:s('sampleQty'),align:'r',render:row=>`<span class="tnum">${num(Number(row.sampleQty))}</span>`},
          {label:s('inspector'),render:row=>esc(row.inspectorName)},
          {label:s('date'),render:row=>esc(dateLabel(row.inspectionDate))},
          {label:s('status'),render:row=>cap(statusLabel(s,row.status),statusTone(row.status))},
        ],
        rows:filtered(),
      });
    }
    const chips=[['all',s('all')],['scheduled',s('scheduled')],['passed',s('passed')],['failed',s('failed')],['closed',s('closed')]];
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,t('nav.quality'),s('inspections')])}
        <div class="h1row"><h1>${esc(s('inspections'))}</h1><span class="countchip" id="qualityCount">${inspections.length}</span>
          <div class="headright">${btn(s('newInspection'),{icon:'plus',cls:'primary',attrs:'data-create-inspection'})}</div>
        </div>
      </div>
      <div class="toolbar"><div class="filterchips" id="qualityFilters">
        ${chips.map(([key,label])=>`<button class="chip ${key==='all'?'on':''}" data-status="${key}">${esc(label)}</button>`).join('')}
      </div><div class="grow"></div><small style="color:var(--muted)">${esc(s('dataLimit'))}</small></div>
      <div class="tablewrap" id="qualityTable">${table()}</div>
      ${!inspections.length?`<div class="statepanel empty">${ic('checkc')}<h3>${esc(s('empty'))}</h3><p>${esc(s('emptyHelp'))}</p></div>`:''}
    </section></div>`;
    const tableRoot=root.querySelector('#qualityTable');
    function wire(){ if(tableRoot) wireTable(tableRoot,{onRow:id=>openInspection(id)}); }
    wire();
    root.querySelectorAll('[data-status]').forEach(button=>button.addEventListener('click',()=>{
      root.querySelector('.chip.on')?.classList.remove('on');
      button.classList.add('on');
      active=button.dataset.status;
      tableRoot.innerHTML=table(); wire();
      root.querySelector('#qualityCount').textContent=String(filtered().length);
    }));
    root.querySelector('[data-create-inspection]')?.addEventListener('click',async event=>{
      const button=event.currentTarget,plan=plans.find(row=>row.isActive!==false);
      if(!plan){ toast(s('emptyHelp'),'warn'); return; }
      const item=products.get(Number(plan.productId))||productPage.data?.[0];
      if(!item){ toast(s('emptyHelp'),'warn'); return; }
      button.disabled=true;
      try{
        const created=await a.create('quality/inspections',{
          docNo:`QI-${inspections.length+1}`,planId:Number(plan.id),productId:Number(item.id),
          sourceType:'manual',sourceRef:'Manual quality request',lotQty:String(plan.sampleSize||1),
          sampleQty:String(plan.sampleSize||1),inspectorName:'Demo QA',
          inspectionDate:new Date().toISOString().slice(0,10),
        });
        window.ACTIVE_QUALITY_INSPECTION_ID=Number(created.data.id);
        await navigate('qc-report');
      }catch(error){
        button.disabled=false; toast(error&&error.message||'Quality create failed','danger');
      }
    });
  };

  SCREENS['qc-report']=async function(root){
    const a=adapter(),s=copy();
    const pages=await Promise.all([
      a.list('quality/inspections',{limit:100}),
      a.list('quality/results',{limit:100}),
      a.list('inventory/products',{limit:100}),
      a.list('quality/ncrs',{limit:100}),
    ]);
    const inspections=pages[0].data||[];
    const id=Number(window.ACTIVE_QUALITY_INSPECTION_ID)||Number(inspections[0]?.id);
    const inspection=inspections.find(row=>Number(row.id)===id)||inspections[0];
    if(!inspection){
      root.innerHTML=`<div class="content full"><section class="master"><div class="statepanel empty">
        ${ic('checkc')}<h3>${esc(s('empty'))}</h3><p>${esc(s('emptyHelp'))}</p></div></section></div>`;
      return;
    }
    window.ACTIVE_QUALITY_INSPECTION_ID=Number(inspection.id);
    const item=byId(pages[2].data).get(Number(inspection.productId))||{};
    const results=(pages[1].data||[]).filter(row=>Number(row.inspectionId)===Number(inspection.id))
      .sort((x,y)=>Number(x.sequence)-Number(y.sequence));
    const ncr=(pages[3].data||[]).find(row=>Number(row.inspectionId)===Number(inspection.id));
    const pending=['scheduled','in_inspection'].includes(inspection.status);
    const resultRows=results.map((row,index)=>`<tr><td class="lineno">${index+1}</td>
      <td class="l li-name"><b>${esc(row.characteristic)}</b><small>${esc(row.method)}</small></td>
      <td class="l" style="white-space:normal">${esc(row.specification)}</td>
      <td class="l">${esc(row.measuredValue||'—')}</td>
      <td class="l">${cap(row.result==='pending'?s('scheduled'):row.result,row.result==='pass'?'ok':row.result==='fail'?'danger':'neutral')}</td></tr>`).join('');
    root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,t('nav.quality'),s('inspections'),{cur:inspection.docNo}])}
      <div class="dochead"><div class="dh-row1"><div>
        <div class="dt">${ic('checkc')}${esc(s('inspection'))} <span class="dnum">${esc(inspection.docNo)}</span></div>
        <div class="h1sub">${esc(item.sku||'#'+inspection.productId)} · ${esc(item.name||s('product'))}</div>
      </div><div class="dactions">${cap(statusLabel(s,inspection.status),statusTone(inspection.status))}
        ${ncr?btn(ncr.docNo,{icon:'shield',cls:'soft',attrs:`data-open-ncr="${ncr.id}"`}):inspection.status==='failed'?btn(s('raiseNcr'),{icon:'shield',cls:'primary',attrs:'data-raise-ncr'}):''}
      </div></div>
      <div class="docmeta">
        <div class="dm"><small>${esc(s('type'))}</small><b>${esc(typeLabel(s,inspection.inspectionType))}</b></div>
        <div class="dm"><small>${esc(s('source'))}</small><b>${esc(inspection.sourceRef||inspection.sourceType)}</b></div>
        <div class="dm"><small>${esc(s('lotQty'))}</small><b class="tnum">${num(Number(inspection.lotQty))}</b></div>
        <div class="dm"><small>${esc(s('sampleQty'))}</small><b class="tnum">${num(Number(inspection.sampleQty))}</b></div>
        <div class="dm"><small>${esc(s('inspector'))}</small><b>${esc(inspection.inspectorName)}</b></div>
      </div></div>
      <div class="panel"><div class="panel-h"><h3>${esc(s('results'))}</h3></div>
        <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(s('characteristic'))}</th>
          <th class="l">${esc(s('specification'))}</th><th class="l">${esc(s('measured'))}</th><th class="l">${esc(s('outcome'))}</th>
        </tr></thead><tbody>${resultRows}</tbody></table></div>
    </div></div>
    ${pending?`<div class="set-savebar"><div class="grow"></div>
      ${btn(s('completeFail'),{icon:'warn',cls:'soft',attrs:'data-complete-quality="fail"'})}
      ${btn(s('completePass'),{icon:'check',cls:'primary',attrs:'data-complete-quality="pass"'})}
    </div>`:''}</section></div>`;
    root.querySelector('[data-open-ncr]')?.addEventListener('click',event=>openNcr(event.currentTarget.dataset.openNcr));
    root.querySelectorAll('[data-complete-quality]').forEach(button=>button.addEventListener('click',async()=>{
      const outcome=button.dataset.completeQuality;
      root.querySelectorAll('[data-complete-quality]').forEach(node=>{node.disabled=true;});
      try{
        await a.action('quality/inspections',inspection.id,'complete',{
          results:results.map((row,index)=>({
            resultId:Number(row.id),
            measuredValue:outcome==='pass'?'Within specification':index===0?'Outside specification':'Within specification',
            result:outcome==='fail'&&index===0?'fail':'pass',
            defectClass:outcome==='fail'&&index===0?'major':null,
          })),
        },`complete-quality-inspection-${inspection.id}-${outcome}`);
        toast(s('completed'),outcome==='pass'?'ok':'warn');
        await navigate('qc-report');
      }catch(error){
        root.querySelectorAll('[data-complete-quality]').forEach(node=>{node.disabled=false;});
        toast(error&&error.message||'Quality completion failed','danger');
      }
    }));
    root.querySelector('[data-raise-ncr]')?.addEventListener('click',async event=>{
      const button=event.currentTarget; button.disabled=true;
      try{
        const created=await a.create('quality/ncrs',{
          docNo:`NCR-${(pages[3].data||[]).length+1}`,
          inspectionId:Number(inspection.id),severity:'major',
          affectedQty:String(inspection.lotQty),
          defectDescription:'Inspection characteristic failed the released specification.',
          actions:[{action:'Review the process and verify corrective evidence',ownerName:'Demo QA',
            dueDate:new Date(Date.now()+7*86400000).toISOString().slice(0,10)}],
        });
        toast(s('ncrRaised'),'ok'); openNcr(created.data.id);
      }catch(error){
        button.disabled=false; toast(error&&error.message||'NCR create failed','danger');
      }
    });
  };

  SCREENS['ncr']=async function(root){
    const a=adapter(),s=copy();
    const pages=await Promise.all([
      a.list('quality/ncrs',{limit:100}),
      a.list('quality/inspections',{limit:100}),
      a.list('quality/corrective-actions',{limit:100}),
      a.list('inventory/products',{limit:100}),
    ]);
    const ncrs=pages[0].data||[];
    const id=Number(window.ACTIVE_QUALITY_NCR_ID)||Number(ncrs[0]?.id);
    const ncr=ncrs.find(row=>Number(row.id)===id)||ncrs[0];
    if(!ncr){
      root.innerHTML=`<div class="content full"><section class="master"><div class="statepanel empty">
        ${ic('shield')}<h3>${esc(s('empty'))}</h3><p>${esc(s('emptyHelp'))}</p></div></section></div>`;
      return;
    }
    window.ACTIVE_QUALITY_NCR_ID=Number(ncr.id);
    const inspection=(pages[1].data||[]).find(row=>Number(row.id)===Number(ncr.inspectionId))||{};
    const item=byId(pages[3].data).get(Number(ncr.productId))||{};
    const actions=(pages[2].data||[]).filter(row=>Number(row.ncrId)===Number(ncr.id))
      .sort((x,y)=>Number(x.sequence)-Number(y.sequence));
    const actionRows=actions.map((action,index)=>`<div class="oprow"><span class="opseq">A${index+1}</span>
      <div class="opmain"><b>${esc(action.action)}</b><small>${esc(action.ownerName)} · ${esc(dateLabel(action.dueDate))}</small></div>
      ${cap(statusLabel(s,action.status),statusTone(action.status))}</div>`).join('');
    root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,t('nav.quality'),s('ncrs'),{cur:ncr.docNo}])}
      <div class="dochead"><div class="dh-row1"><div>
        <div class="dt">${ic('shield')}${esc(s('ncrs'))} <span class="dnum">${esc(ncr.docNo)}</span></div>
        <div class="h1sub">${esc(item.sku||'#'+ncr.productId)} · ${esc(item.name||s('product'))}</div>
      </div><div class="dactions">${cap(ncr.severity,ncr.severity==='critical'?'danger':'warn')}
        ${cap(statusLabel(s,ncr.status),statusTone(ncr.status))}
        ${btn(inspection.docNo||s('inspection'),{icon:'checkc',cls:'soft',attrs:`data-open-inspection="${ncr.inspectionId}"`})}
      </div></div></div>
      <div class="doclayout"><div class="docmain">
        <div class="panel"><div class="panel-h"><h3>${esc(s('defect'))}</h3></div>
          <div class="panel-body"><p style="margin:0;white-space:normal">${esc(ncr.defectDescription)}</p></div></div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('corrective'))}</h3></div>
          <div class="panel-body" style="padding:6px 0">${actionRows||`<div class="empty">${esc(s('empty'))}</div>`}</div></div>
      </div><aside class="summary"><div class="sumcard">
        <div class="sectitle" style="margin-top:0">${esc(s('disposition'))}</div>
        <div class="sumrow"><span class="sk2">${esc(s('affected'))}</span><span class="sv tnum">${num(Number(ncr.affectedQty))}</span></div>
        <div class="sumrow"><span class="sk2">${esc(s('severity'))}</span><span class="sv">${esc(ncr.severity)}</span></div>
        <div class="sumrow total"><span class="sk2">${esc(s('disposition'))}</span><span class="sv">${esc(ncr.disposition||s('quarantine'))}</span></div>
      </div></aside></div>
    </div></div>
    ${ncr.status!=='closed'?`<div class="set-savebar"><div class="grow"></div>
      ${btn(s('reject'),{icon:'warn',cls:'soft',attrs:'data-dispose-ncr="reject"'})}
      ${btn(s('release'),{icon:'check',cls:'primary',attrs:'data-dispose-ncr="release"'})}
    </div>`:''}</section></div>`;
    root.querySelector('[data-open-inspection]')?.addEventListener('click',event=>openInspection(event.currentTarget.dataset.openInspection));
    root.querySelectorAll('[data-dispose-ncr]').forEach(button=>button.addEventListener('click',async()=>{
      const disposition=button.dataset.disposeNcr;
      root.querySelectorAll('[data-dispose-ncr]').forEach(node=>{node.disabled=true;});
      try{
        await a.action('quality/ncrs',ncr.id,disposition,{},`dispose-quality-ncr-${ncr.id}-${disposition}`);
        toast(disposition==='release'?s('released'):s('rejected'),disposition==='release'?'ok':'warn');
        await navigate('ncr');
      }catch(error){
        root.querySelectorAll('[data-dispose-ncr]').forEach(node=>{node.disabled=false;});
        toast(error&&error.message||'NCR disposition failed','danger');
      }
    }));
  };
})();
