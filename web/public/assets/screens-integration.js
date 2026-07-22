/* ============================================================
   ARIA ERP — screens: Integration (connectors, sync logs, data import)
   ============================================================ */

function connStatusTone(s){ return {Connected:'ok',Error:'danger',Paused:'neutral',Setup:'info'}[s]||'neutral'; }
function dirChip(dir){
  const m={Inbound:['receive','In'],Outbound:['upload','Out'],'Two-way':['transfer','Two-way']};
  const [icon,lbl]=m[dir]||['transfer',dir];
  return `<span style="display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:12.5px">${ic(icon)}${lbl}</span>`;
}
function logStatusTone(s){ return {Success:'ok',Failed:'danger',Partial:'warn',Retry:'info'}[s]||'neutral'; }

/* ---------------- CONNECTORS HUB (listing — module landing) ---------------- */
SCREENS['integration'] = function(root){
  let filter='all';
  const chips=[['all',t('common.all'),null],['connected',ts('Connected'),'ok'],['issues',t('int.issues'),'danger'],['paused',ts('Paused'),'neutral']];
  function rows(){
    return DB.connectors.filter(c=>{
      if(filter==='all') return true;
      if(filter==='connected') return c.status==='Connected';
      if(filter==='issues') return c.status==='Error';
      if(filter==='paused') return c.status==='Paused'||c.status==='Setup';
      return true;
    });
  }
  function table(){
    return buildTable({
      rowId:c=>c.name,
      columns:[
        {label:t('int.col.connector'),render:c=>`<div style="display:flex;align-items:center;gap:11px"><span class="wc-ic ${c.health==='danger'?'red':c.health==='ok'?'green':'slate'}" style="width:30px;height:30px;border-radius:9px">${ic(c.ic)}</span><div class="cellsub"><b>${esc(c.name)}</b><small>${esc(c.cat)}</small></div></div>`},
        {label:t('int.col.direction'),align:'l',render:c=>dirChip(c.dir)},
        {label:t('int.col.frequency'),align:'l',render:c=>esc(c.freq)},
        {label:t('int.col.records'),align:'r',render:c=>`<span class="tnum">${esc(c.records)}</span>`},
        {label:t('int.col.lastsync'),align:'l',render:c=>esc(c.last)},
        {label:t('col.status'),align:'l',render:c=>cap(ts(c.status),connStatusTone(c.status))},
        {label:'',align:'c',render:()=>`<span class="rowact"><button data-tip="${esc(t('int.viewlogs'))}" data-act="logs">${ic('history')}</button><button data-tip="${esc(t('int.configure'))}">${ic('gear')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  const s=DB.integrationStats;
  function statTile(label,value,sub,tone){
    return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
      <b class="tnum" style="font-size:24px;font-weight:600;letter-spacing:-.02em;color:${tone||'var(--fg)'}">${value}</b>
      <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.integration'),t('int.crumb')])}
      <div class="h1row"><h1>${esc(t('nav.integration'))}</h1><span class="countchip" id="connCount"></span></div>
    </div>
    <div class="statwrap"><div class="statcards">
      ${statTile(t('int.t.active'),s.active+' / '+DB.connectors.length,t('int.t.activesub'))}
      ${statTile(t('int.t.calls'),s.calls,t('int.t.callssub'))}
      ${statTile(t('int.t.success'),s.success+'%',t('int.t.successsub'),'var(--ok)')}
      ${statTile(t('int.t.failed'),s.failed,t('int.t.failedsub').replaceAll('{n}',s.queued),'var(--danger)')}
    </div></div>
    <div class="alert danger" style="margin:0 24px 4px"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>${esc(t('int.alert'))}</b> ${esc(t('int.alert2'))}</span>
      ${btn(t('int.reauth'),{icon:'refresh',cls:'soft',attrs:'onclick="toast(\'Opening CIMB OAuth flow…\',\'info\')"'})}</div>
    <div class="toolbar">
      <div class="filterchips" id="connChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${c[2]?`<span class="dot" style="background:var(--${c[2]})"></span>`:''}${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('int.logstip'))}" onclick="navigate('integration-logs')">${ic('history')}${esc(t('int.logs'))}</button>
      ${btn(t('int.import'),{icon:'upload',cls:'soft',attrs:'onclick="navigate(\'data-import\')"'})}
      ${btn(t('int.add'),{icon:'plus',cls:'primary',attrs:'onclick="toast(\'Connector catalogue — not in this build\',\'info\')"'})}
    </div>
    <div class="tablewrap" id="connTable">${table()}</div>
  </section></div>`;
  const wrap=$('#connTable');
  $('#connCount').textContent=rows().filter(c=>c.status==='Connected').length+' '+t('int.connected');
  function rewire(){
    wireTable(wrap,{ onRow:(id)=>{ const c=DB.connectors.find(x=>x.name===id); c&&c.status==='Error'?toast(id+' — re-authorization required','danger'):toast('Opening '+id,'info'); } });
    wrap.querySelectorAll('[data-act="logs"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();navigate('integration-logs');}));
  }
  rewire();
  $('#connChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('#connChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
    wrap.innerHTML=table(); rewire();
  }));
};

/* ---------------- INTEGRATION LOGS (canonical outbox facts) ---------------- */
function integrationEventCopy(){
  const packs={
    en:{title:'Delivery log',sub:'Sanitized transactional outbox facts. Payloads, tokens and worker identities are never exposed.',total:'Events',delivered:'Delivered',waiting:'Awaiting delivery',retry:'Needs retry',all:'All',processing:'Processing',pending:'Pending',channel:'Channel',topic:'Event topic',aggregate:'Source record',attempts:'Attempts',activity:'Last activity',status:'Status',details:'Delivery detail',email:'Email',outbox:'Outbox',outbound:'Outbound',none:'No delivery facts exist for this company yet.',emptyFilter:'No events match this status.',loading:'Loading canonical delivery facts…',error:'Delivery facts could not be loaded.',retryLoad:'Retry',connectorPreview:'Connector preview',bounded:'Latest 100 events · newest first',readOnly:'Read-only boundary',readOnlyBody:'Delivery retries remain controlled by the leased server worker. Connector setup and manual replay stay Preview until encrypted credentials and generic webhook delivery are implemented.',errorNone:'No worker error recorded.',errorTransport:'The delivery transport is unavailable. The worker will retry with backoff.',errorUnsupported:'The worker does not support this topic yet.',errorGeneric:'Delivery failed. Sensitive worker diagnostics are withheld.',available:'Next available',created:'Created'},
    ms:{title:'Log penghantaran',sub:'Fakta peti keluar transaksi yang dinyahpeka. Muatan, token dan identiti worker tidak pernah didedahkan.',total:'Peristiwa',delivered:'Dihantar',waiting:'Menunggu penghantaran',retry:'Perlu cuba semula',all:'Semua',processing:'Sedang diproses',pending:'Menunggu',channel:'Saluran',topic:'Topik peristiwa',aggregate:'Rekod sumber',attempts:'Percubaan',activity:'Aktiviti terakhir',status:'Status',details:'Butiran penghantaran',email:'E-mel',outbox:'Peti keluar',outbound:'Keluar',none:'Belum ada fakta penghantaran untuk syarikat ini.',emptyFilter:'Tiada peristiwa sepadan dengan status ini.',loading:'Memuatkan fakta penghantaran kanonik…',error:'Fakta penghantaran tidak dapat dimuatkan.',retryLoad:'Cuba lagi',connectorPreview:'Pratonton penyambung',bounded:'100 peristiwa terkini · paling baharu dahulu',readOnly:'Sempadan baca sahaja',readOnlyBody:'Cubaan semula penghantaran dikawal oleh worker pelayan bersewa. Persediaan penyambung dan ulang tayang manual kekal Pratonton sehingga kelayakan disulitkan dan penghantaran webhook generik tersedia.',errorNone:'Tiada ralat worker direkodkan.',errorTransport:'Pengangkutan penghantaran tidak tersedia. Worker akan mencuba semula dengan sela meningkat.',errorUnsupported:'Worker belum menyokong topik ini.',errorGeneric:'Penghantaran gagal. Diagnostik worker sensitif disembunyikan.',available:'Tersedia seterusnya',created:'Dicipta'},
    zh:{title:'投递日志',sub:'来自事务 Outbox 的脱敏事实。载荷、令牌和 Worker 身份绝不会在此暴露。',total:'事件',delivered:'已投递',waiting:'等待投递',retry:'需要重试',all:'全部',processing:'处理中',pending:'等待中',channel:'渠道',topic:'事件主题',aggregate:'来源记录',attempts:'尝试次数',activity:'最近活动',status:'状态',details:'投递资料',email:'电子邮件',outbox:'Outbox',outbound:'出站',none:'当前公司尚无投递事实。',emptyFilter:'没有符合该状态的事件。',loading:'正在加载真实投递事实…',error:'无法加载投递事实。',retryLoad:'重试',connectorPreview:'连接器预览',bounded:'最近 100 个事件 · 最新优先',readOnly:'只读边界',readOnlyBody:'投递重试只由采用租约的服务端 Worker 控制。在加密凭据和通用 Webhook 投递完成前，连接器设置与手工重放仍为预览功能。',errorNone:'未记录 Worker 错误。',errorTransport:'投递渠道不可用。Worker 将按退避策略重试。',errorUnsupported:'Worker 尚不支持该事件主题。',errorGeneric:'投递失败。敏感的 Worker 诊断资料已隐藏。',available:'下次可用',created:'创建时间'},
    ja:{title:'配信ログ',sub:'トランザクションOutboxのマスキング済み事実です。ペイロード、トークン、ワーカーIDは公開しません。',total:'イベント',delivered:'配信済み',waiting:'配信待ち',retry:'再試行が必要',all:'すべて',processing:'処理中',pending:'待機中',channel:'チャネル',topic:'イベントトピック',aggregate:'元レコード',attempts:'試行回数',activity:'最終アクティビティ',status:'ステータス',details:'配信詳細',email:'メール',outbox:'Outbox',outbound:'送信',none:'この会社には配信事実がありません。',emptyFilter:'このステータスに一致するイベントはありません。',loading:'標準配信事実を読み込み中…',error:'配信事実を読み込めません。',retryLoad:'再試行',connectorPreview:'コネクタープレビュー',bounded:'最新100イベント・新しい順',readOnly:'読み取り専用境界',readOnlyBody:'再試行はリース方式のサーバーワーカーだけが制御します。暗号化認証情報と汎用Webhook配信が完成するまで、コネクター設定と手動再実行はプレビューのままです。',errorNone:'ワーカーエラーは記録されていません。',errorTransport:'配信トランスポートを利用できません。ワーカーがバックオフして再試行します。',errorUnsupported:'ワーカーはこのトピックをまだサポートしていません。',errorGeneric:'配信に失敗しました。機密性のある診断情報は非表示です。',available:'次回実行可能',created:'作成日時'},
    vi:{title:'Nhật ký chuyển phát',sub:'Dữ kiện transactional outbox đã được che dữ liệu nhạy cảm. Payload, token và danh tính worker không bao giờ được hiển thị.',total:'Sự kiện',delivered:'Đã chuyển',waiting:'Đang chờ chuyển',retry:'Cần thử lại',all:'Tất cả',processing:'Đang xử lý',pending:'Đang chờ',channel:'Kênh',topic:'Chủ đề sự kiện',aggregate:'Bản ghi nguồn',attempts:'Số lần thử',activity:'Hoạt động gần nhất',status:'Trạng thái',details:'Chi tiết chuyển phát',email:'Email',outbox:'Outbox',outbound:'Gửi đi',none:'Chưa có dữ kiện chuyển phát cho công ty này.',emptyFilter:'Không có sự kiện phù hợp trạng thái này.',loading:'Đang tải dữ kiện chuyển phát chuẩn…',error:'Không thể tải dữ kiện chuyển phát.',retryLoad:'Thử lại',connectorPreview:'Xem trước trình kết nối',bounded:'100 sự kiện mới nhất · mới nhất trước',readOnly:'Ranh giới chỉ đọc',readOnlyBody:'Việc thử lại do worker máy chủ có lease kiểm soát. Cấu hình trình kết nối và phát lại thủ công vẫn là Bản xem trước cho đến khi có thông tin xác thực mã hóa và webhook chung.',errorNone:'Không ghi nhận lỗi worker.',errorTransport:'Kênh chuyển phát không khả dụng. Worker sẽ thử lại với thời gian lùi.',errorUnsupported:'Worker chưa hỗ trợ chủ đề này.',errorGeneric:'Chuyển phát thất bại. Chẩn đoán nhạy cảm của worker đã được ẩn.',available:'Lần khả dụng kế tiếp',created:'Đã tạo'},
  };
  const lang=typeof getLang==='function'?getLang():'en';
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

function integrationEventTime(value){
  if(!value) return '—';
  const parsed=value instanceof Date?value:new Date(value);
  if(Number.isNaN(parsed.getTime())) return esc(String(value));
  const locales={en:'en-SG',ms:'ms-MY',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'};
  return new Intl.DateTimeFormat(locales[typeof getLang==='function'?getLang():'en']||'en-SG',{
    dateStyle:'medium',timeStyle:'short',hour12:false,
  }).format(parsed);
}

function integrationEventStatusLabel(status,c){
  return c(status==='delivered'?'delivered':status==='processing'?'processing':status==='retry'?'retry':'pending');
}
function integrationEventStatusTone(status){
  return {delivered:'ok',processing:'info',retry:'danger',pending:'warn'}[status]||'neutral';
}
function integrationEventError(row,c){
  return row.errorCode==='transport_unavailable'?c('errorTransport'):
    row.errorCode==='unsupported_topic'?c('errorUnsupported'):
    row.errorCode==='delivery_failed'?c('errorGeneric'):c('errorNone');
}

function filterIntegrationEventRows(status){
  const root=$('#viewRoot');
  if(!root||CURRENT_ROUTE!=='integration-logs') return;
  let visible=0;
  root.querySelectorAll('[data-integration-event-row]').forEach(row=>{
    const show=status==='all'||row.dataset.status===status;
    row.style.display=show?'':'none';
    const detail=root.querySelector(`[data-integration-event-detail="${row.dataset.eventId}"]`);
    if(detail&&!show) detail.style.display='none';
    if(show) visible++;
  });
  root.querySelectorAll('[data-integration-filter]').forEach(button=>{
    button.classList.toggle('on',button.dataset.integrationFilter===status);
  });
  const empty=root.querySelector('[data-integration-filter-empty]');
  if(empty) empty.style.display=visible?'none':'';
}
function toggleIntegrationEventDetails(eventId){
  const root=$('#viewRoot');
  const detail=root&&root.querySelector(`[data-integration-event-detail="${eventId}"]`);
  if(detail) detail.style.display=detail.style.display==='none'?'':'none';
}

SCREENS['integration-logs'] = async function(){
  const c=integrationEventCopy();
  const page=await listPage('integration/events',{limit:100});
  const rows=page.data||[];
  const count=status=>rows.filter(row=>row.status===status).length;
  const waiting=count('pending')+count('processing');
  const stat=(label,value,tone)=>`<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${esc(label)}</small><b class="tnum" style="font-size:24px;font-weight:600;color:${tone||'var(--fg)'}">${num(value)}</b></div>`;
  const eventRows=rows.map(row=>{
    const activity=row.deliveredAt||row.lastAttemptAt||row.createdAt;
    return `<div class="dt-r integration-event-row" data-integration-event-row="true" data-event-id="${Number(row.id)}" data-status="${esc(row.status)}" onclick="toggleIntegrationEventDetails(${Number(row.id)})" style="cursor:pointer">
      <div class="dt-c l"><div class="cellsub"><b>${esc(row.channel==='email'?c('email'):c('outbox'))}</b><small>${esc(c('outbound'))}</small></div></div>
      <div class="dt-c l mono" style="font-size:12px">${esc(row.topic)}</div>
      <div class="dt-c l"><div class="cellsub"><b>${esc(row.aggregateType)}</b><small>#${esc(row.aggregateId)}</small></div></div>
      <div class="dt-c r tnum">${num(row.attempts||0)}</div>
      <div class="dt-c l" style="font-size:12px;color:var(--muted)">${esc(integrationEventTime(activity))}</div>
      <div class="dt-c l">${cap(integrationEventStatusLabel(row.status,c),integrationEventStatusTone(row.status))}</div>
    </div><div class="dt-r integration-event-detail" data-integration-event-detail="${Number(row.id)}" style="display:none"><div class="dt-c l" style="grid-column:1/-1;padding:12px 16px;background:var(--surface2);display:grid;gap:6px;font-size:12.5px;color:var(--muted)">
      <div><b style="color:var(--fg)">${esc(c('details'))}</b> · ${esc(integrationEventError(row,c))}</div>
      <div>${esc(c('created'))}: ${esc(integrationEventTime(row.createdAt))} · ${esc(c('available'))}: ${esc(integrationEventTime(row.availableAt))}</div>
    </div></div>`;
  }).join('');
  const table=rows.length?`<div class="dt-page"><div class="dt" role="table" style="--tpl:minmax(110px,.8fr) minmax(190px,1.4fr) minmax(160px,1.1fr) 85px minmax(150px,1.1fr) 120px">
    <div class="dt-r dt-head"><div class="dt-c l">${esc(c('channel'))}</div><div class="dt-c l">${esc(c('topic'))}</div><div class="dt-c l">${esc(c('aggregate'))}</div><div class="dt-c r">${esc(c('attempts'))}</div><div class="dt-c l">${esc(c('activity'))}</div><div class="dt-c l">${esc(c('status'))}</div></div>
    <div class="dt-body">${eventRows}</div></div></div>`:statePanel({icon:'history',title:c('none')});
  const body=`<div data-integration-events-canonical="true">
    <div class="statwrap"><div class="statcards">${stat(c('total'),rows.length)}${stat(c('delivered'),count('delivered'),'var(--ok)')}${stat(c('waiting'),waiting,'var(--accent)')}${stat(c('retry'),count('retry'),'var(--danger)')}</div></div>
    <div class="alert info" style="margin:0 24px 14px">${ic('shield')}<span class="grow"><b>${esc(c('readOnly'))}</b> ${esc(c('readOnlyBody'))}</span></div>
    <div class="toolbar"><div class="filterchips">${['all','delivered','pending','processing','retry'].map(status=>`<button class="chip ${status==='all'?'on':''}" data-integration-filter="${status}" onclick="filterIntegrationEventRows('${status}')">${esc(c(status))}</button>`).join('')}</div><div class="grow"></div><span class="hideonsmall" style="font-size:12px;color:var(--muted)">${esc(c('bounded'))}</span>${btn(c('connectorPreview'),{icon:'plug',cls:'soft',attrs:'onclick="navigate(\'integration\')"'})}</div>
    <div class="tablewrap" data-integration-event-table="true">${table}<div data-integration-filter-empty="true" style="display:none;padding:32px">${statePanel({icon:'filter',title:c('emptyFilter')})}</div></div>
  </div>`;
  return modulePage({module:'integration',route:'integration-logs',active:'integration-logs',title:c('title'),sub:c('sub'),count:rows.length,body});
};

/* ---------------- DATA IMPORT (canonical bounded customer CSV) ---------------- */
let ACTIVE_IMPORT_JOB_ID=null;

function customerImportCopy(){
  const packs={
    en:{title:'Customer CSV import',sub:'Validate a bounded customer file, persist every row result, then run one audited import.',template:'Download template',newJob:'New validation job',file:'CSV file',choose:'Choose CSV',paste:'Or paste CSV',pasteHint:'Required header: code,name. Optional: industry. Maximum 250 data rows.',strategy:'Existing customer codes',update:'Update name and industry',skip:'Skip existing customers',validate:'Validate file',recent:'Recent jobs',none:'No customer import jobs exist yet.',job:'Job',customer:'Customer master',validated:'Validated',invalid:'Invalid',processing:'Processing',completed:'Completed',failed:'Failed',ready:'Ready',errors:'Errors',skipped:'Skipped',imported:'Imported',rows:'Rows',run:'Import ready rows',running:'Importing…',code:'Code',name:'Customer name',industry:'Industry',operation:'Operation',result:'Result',create:'Create',updateOp:'Update',skipOp:'Skip',invalidOp:'Invalid',row:'CSV row',issue:'Validation issue',required:'Required value is missing.',invalidType:'Value must be text.',tooLong:'Value is too long.',duplicate:'Code appears more than once in this file.',unsupported:'The row contains an unsupported column.',fileLoaded:'CSV loaded',validatedToast:'Validation job created.',completedToast:'Customer import completed.',readBoundary:'Small-file boundary',readBoundaryBody:'This route accepts customer CSV files only and processes at most 250 rows per job. Larger or other-module files remain unsupported rather than being silently truncated.',selectJob:'Select a job to inspect persisted row results.',noRows:'This job has no row facts.',uploadError:'The CSV could not be parsed.',exactHeader:'Only code, name and industry columns are supported in this slice.',created:'Created',duplicateUpdate:'Update existing',duplicateSkip:'Skip existing'},
    ms:{title:'Import CSV pelanggan',sub:'Sahkan fail pelanggan terhad, simpan setiap hasil baris, kemudian jalankan satu import beraudit.',template:'Muat turun templat',newJob:'Kerja pengesahan baharu',file:'Fail CSV',choose:'Pilih CSV',paste:'Atau tampal CSV',pasteHint:'Pengepala wajib: code,name. Pilihan: industry. Maksimum 250 baris data.',strategy:'Kod pelanggan sedia ada',update:'Kemas kini nama dan industri',skip:'Langkau pelanggan sedia ada',validate:'Sahkan fail',recent:'Kerja terkini',none:'Belum ada kerja import pelanggan.',job:'Kerja',customer:'Induk pelanggan',validated:'Disahkan',invalid:'Tidak sah',processing:'Diproses',completed:'Selesai',failed:'Gagal',ready:'Sedia',errors:'Ralat',skipped:'Dilangkau',imported:'Diimport',rows:'Baris',run:'Import baris sedia',running:'Mengimport…',code:'Kod',name:'Nama pelanggan',industry:'Industri',operation:'Operasi',result:'Hasil',create:'Cipta',updateOp:'Kemas kini',skipOp:'Langkau',invalidOp:'Tidak sah',row:'Baris CSV',issue:'Isu pengesahan',required:'Nilai wajib tiada.',invalidType:'Nilai mesti teks.',tooLong:'Nilai terlalu panjang.',duplicate:'Kod muncul lebih daripada sekali dalam fail.',unsupported:'Baris mengandungi lajur tidak disokong.',fileLoaded:'CSV dimuatkan',validatedToast:'Kerja pengesahan dicipta.',completedToast:'Import pelanggan selesai.',readBoundary:'Sempadan fail kecil',readBoundaryBody:'Laluan ini hanya menerima CSV pelanggan dan memproses maksimum 250 baris setiap kerja. Fail lebih besar atau modul lain kekal tidak disokong dan tidak dipotong secara senyap.',selectJob:'Pilih kerja untuk melihat hasil baris tersimpan.',noRows:'Kerja ini tiada fakta baris.',uploadError:'CSV tidak dapat dihuraikan.',exactHeader:'Hanya lajur code, name dan industry disokong dalam bahagian ini.',created:'Dicipta',duplicateUpdate:'Kemas kini sedia ada',duplicateSkip:'Langkau sedia ada'},
    zh:{title:'客户 CSV 导入',sub:'验证有界客户文件、持久化每行结果，再执行一次可审计导入。',template:'下载模板',newJob:'新建验证任务',file:'CSV 文件',choose:'选择 CSV',paste:'或粘贴 CSV',pasteHint:'必需表头：code,name；可选：industry。每个任务最多 250 行数据。',strategy:'遇到已有客户代码',update:'更新名称与行业',skip:'跳过已有客户',validate:'验证文件',recent:'最近任务',none:'尚无客户导入任务。',job:'任务',customer:'客户主数据',validated:'已验证',invalid:'无效',processing:'处理中',completed:'已完成',failed:'失败',ready:'可导入',errors:'错误',skipped:'已跳过',imported:'已导入',rows:'行数',run:'导入有效行',running:'正在导入…',code:'代码',name:'客户名称',industry:'行业',operation:'操作',result:'结果',create:'新建',updateOp:'更新',skipOp:'跳过',invalidOp:'无效',row:'CSV 行',issue:'验证问题',required:'缺少必填值。',invalidType:'值必须是文本。',tooLong:'值过长。',duplicate:'同一文件中客户代码重复。',unsupported:'该行包含不支持的列。',fileLoaded:'CSV 已载入',validatedToast:'验证任务已创建。',completedToast:'客户导入已完成。',readBoundary:'小文件边界',readBoundaryBody:'本页面仅支持客户 CSV，每个任务最多处理 250 行。更大的文件或其他模块不会被静默截断，而是明确保持不支持。',selectJob:'选择任务以查看已持久化的逐行结果。',noRows:'此任务没有逐行记录。',uploadError:'无法解析 CSV。',exactHeader:'此切片只支持 code、name 和 industry 列。',created:'创建时间',duplicateUpdate:'更新已有记录',duplicateSkip:'跳过已有记录'},
    ja:{title:'顧客CSVインポート',sub:'上限付き顧客ファイルを検証し、各行の結果を保存してから監査可能なインポートを実行します。',template:'テンプレートをダウンロード',newJob:'新しい検証ジョブ',file:'CSVファイル',choose:'CSVを選択',paste:'またはCSVを貼り付け',pasteHint:'必須ヘッダー: code,name。任意: industry。最大250データ行。',strategy:'既存の顧客コード',update:'名称と業種を更新',skip:'既存顧客をスキップ',validate:'ファイルを検証',recent:'最近のジョブ',none:'顧客インポートジョブはまだありません。',job:'ジョブ',customer:'顧客マスター',validated:'検証済み',invalid:'無効',processing:'処理中',completed:'完了',failed:'失敗',ready:'準備完了',errors:'エラー',skipped:'スキップ',imported:'インポート済み',rows:'行',run:'準備済み行をインポート',running:'インポート中…',code:'コード',name:'顧客名',industry:'業種',operation:'操作',result:'結果',create:'作成',updateOp:'更新',skipOp:'スキップ',invalidOp:'無効',row:'CSV行',issue:'検証問題',required:'必須値がありません。',invalidType:'値はテキストである必要があります。',tooLong:'値が長すぎます。',duplicate:'同じコードがファイル内に複数あります。',unsupported:'未対応の列が含まれています。',fileLoaded:'CSVを読み込みました',validatedToast:'検証ジョブを作成しました。',completedToast:'顧客インポートが完了しました。',readBoundary:'小規模ファイル境界',readBoundaryBody:'この画面は顧客CSVのみを受け付け、1ジョブ最大250行を処理します。大きなファイルや他モジュールは切り捨てず、未対応として明示します。',selectJob:'ジョブを選択して保存済み行結果を確認してください。',noRows:'このジョブには行データがありません。',uploadError:'CSVを解析できませんでした。',exactHeader:'この範囲ではcode、name、industry列だけをサポートします。',created:'作成日時',duplicateUpdate:'既存を更新',duplicateSkip:'既存をスキップ'},
    vi:{title:'Nhập CSV khách hàng',sub:'Xác thực tệp khách hàng có giới hạn, lưu kết quả từng dòng rồi chạy một lần nhập có kiểm toán.',template:'Tải mẫu',newJob:'Tác vụ xác thực mới',file:'Tệp CSV',choose:'Chọn CSV',paste:'Hoặc dán CSV',pasteHint:'Tiêu đề bắt buộc: code,name. Tùy chọn: industry. Tối đa 250 dòng dữ liệu.',strategy:'Mã khách hàng đã có',update:'Cập nhật tên và ngành',skip:'Bỏ qua khách hàng đã có',validate:'Xác thực tệp',recent:'Tác vụ gần đây',none:'Chưa có tác vụ nhập khách hàng.',job:'Tác vụ',customer:'Danh mục khách hàng',validated:'Đã xác thực',invalid:'Không hợp lệ',processing:'Đang xử lý',completed:'Hoàn tất',failed:'Thất bại',ready:'Sẵn sàng',errors:'Lỗi',skipped:'Đã bỏ qua',imported:'Đã nhập',rows:'Dòng',run:'Nhập các dòng sẵn sàng',running:'Đang nhập…',code:'Mã',name:'Tên khách hàng',industry:'Ngành',operation:'Thao tác',result:'Kết quả',create:'Tạo',updateOp:'Cập nhật',skipOp:'Bỏ qua',invalidOp:'Không hợp lệ',row:'Dòng CSV',issue:'Lỗi xác thực',required:'Thiếu giá trị bắt buộc.',invalidType:'Giá trị phải là văn bản.',tooLong:'Giá trị quá dài.',duplicate:'Mã xuất hiện nhiều lần trong tệp.',unsupported:'Dòng chứa cột chưa được hỗ trợ.',fileLoaded:'Đã tải CSV',validatedToast:'Đã tạo tác vụ xác thực.',completedToast:'Đã hoàn tất nhập khách hàng.',readBoundary:'Giới hạn tệp nhỏ',readBoundaryBody:'Trang này chỉ nhận CSV khách hàng và xử lý tối đa 250 dòng mỗi tác vụ. Tệp lớn hơn hoặc mô-đun khác được báo chưa hỗ trợ thay vì âm thầm cắt bớt.',selectJob:'Chọn tác vụ để xem kết quả từng dòng đã lưu.',noRows:'Tác vụ này không có dữ kiện dòng.',uploadError:'Không thể phân tích CSV.',exactHeader:'Phạm vi này chỉ hỗ trợ các cột code, name và industry.',created:'Đã tạo',duplicateUpdate:'Cập nhật bản ghi có sẵn',duplicateSkip:'Bỏ qua bản ghi có sẵn'},
  };
  const lang=typeof getLang==='function'?getLang():'en';
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

function parseCustomerImportCsv(text){
  const input=String(text||'').replace(/^\uFEFF/,'');
  const records=[];
  let row=[]; let field=''; let quoted=false;
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(quoted){
      if(ch==='"'&&input[i+1]==='"'){ field+='"'; i++; }
      else if(ch==='"') quoted=false;
      else field+=ch;
    }else if(ch==='"') quoted=true;
    else if(ch===','){ row.push(field); field=''; }
    else if(ch==='\n'){
      row.push(field); field='';
      if(row.some(value=>String(value).trim())) records.push(row);
      row=[];
    }else if(ch!=='\r') field+=ch;
  }
  if(quoted) throw new Error('Unclosed CSV quote.');
  row.push(field);
  if(row.some(value=>String(value).trim())) records.push(row);
  if(records.length<2) throw new Error('CSV must include a header and at least one data row.');
  const headers=records[0].map(value=>String(value).trim().toLowerCase());
  if(new Set(headers).size!==headers.length) throw new Error('CSV headers must be unique.');
  if(!headers.includes('code')||!headers.includes('name')) throw new Error('Required headers: code,name.');
  const unsupported=headers.filter(key=>!['code','name','industry'].includes(key));
  if(unsupported.length) throw new Error('Unsupported header(s): '+unsupported.join(', ')+'.');
  if(records.length-1>250) throw new Error('Maximum 250 data rows per job.');
  return records.slice(1).map(values=>{
    const source={};
    headers.forEach((header,index)=>{ source[header]=values[index]==null?'':String(values[index]); });
    return source;
  });
}

function downloadCustomerImportTemplate(){
  const blob=new Blob(['code,name,industry\nDEMO-CUST-001,Fictional Precision Pte Ltd,Manufacturing\n'],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob); link.download='customer-import-template.csv'; link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),0);
}

async function customerImportFileChanged(input){
  const c=customerImportCopy();
  const file=input&&input.files&&input.files[0];
  if(!file) return;
  try{
    if(file.size>512*1024) throw new Error('CSV must be 512 KB or smaller.');
    const text=await file.text();
    parseCustomerImportCsv(text);
    const area=$('#customerImportCsv'); if(area) area.value=text;
    const name=$('#customerImportFileName'); if(name) name.value=file.name;
    toast(c('fileLoaded')+' · '+file.name,'ok');
  }catch(error){ toast(c('uploadError')+' '+error.message,'danger'); }
}

async function createCustomerImportJobFromUi(){
  const c=customerImportCopy();
  try{
    const area=$('#customerImportCsv');
    const rows=parseCustomerImportCsv(area&&area.value);
    const name=$('#customerImportFileName');
    const strategy=$('#customerImportStrategy');
    const result=await window.ErpSystemData.create('integration/import-jobs',{
      fileName:(name&&name.value.trim())||'pasted-customers.csv',
      duplicateStrategy:strategy&&strategy.value||'update_existing',
      rows,
    });
    ACTIVE_IMPORT_JOB_ID=Number(result.data.id);
    toast(c('validatedToast'),'ok');
    navigate('data-import');
  }catch(error){ toast(c('uploadError')+' '+error.message,'danger'); }
}

async function runCustomerImportJobFromUi(jobId){
  const c=customerImportCopy();
  try{
    await window.ErpSystemData.action(
      'integration/import-jobs',Number(jobId),'run',{},
      'customer-import-'+jobId+'-'+Date.now(),
    );
    ACTIVE_IMPORT_JOB_ID=Number(jobId);
    toast(c('completedToast'),'ok');
    navigate('data-import');
  }catch(error){ toast(error.message,'danger'); }
}

function selectCustomerImportJob(jobId){
  ACTIVE_IMPORT_JOB_ID=Number(jobId);
  navigate('data-import');
}

SCREENS['data-import'] = async function(){
  const c=customerImportCopy();
  const jobsPage=await listPage('integration/import-jobs',{limit:100});
  const jobs=(jobsPage.data||[]).slice().sort((a,b)=>Number(b.id)-Number(a.id));
  const selected=jobs.find(job=>Number(job.id)===Number(ACTIVE_IMPORT_JOB_ID))||jobs[0]||null;
  if(selected) ACTIVE_IMPORT_JOB_ID=Number(selected.id);
  const [rowsPage,errorsPage]=selected?await Promise.all([
    listPage('integration/import-rows',{jobId:selected.id,limit:100}),
    listPage('integration/import-errors',{jobId:selected.id,limit:100}),
  ]):[{data:[]},{data:[]}];
  const rows=rowsPage.data||[];
  const errors=errorsPage.data||[];
  const errorByRow={};
  errors.forEach(error=>{ (errorByRow[error.rowNumber]=errorByRow[error.rowNumber]||[]).push(error); });
  const statusTone={validated:'info',invalid:'danger',processing:'warn',completed:'ok',failed:'danger'};
  const rowTone={ready:'info',error:'danger',skipped:'neutral',imported:'ok'};
  const statusLabel=status=>c(status)||status;
  const operationLabel=operation=>c(operation==='update'?'updateOp':operation==='skip'?'skipOp':operation==='invalid'?'invalidOp':'create');
  const errorLabel=error=>c(error.errorCode==='invalid_type'?'invalidType':error.errorCode==='too_long'?'tooLong':error.errorCode==='duplicate_in_file'?'duplicate':error.errorCode==='unsupported_field'?'unsupported':'required');
  const jobList=jobs.length?jobs.map(job=>`<button class="sumcard" onclick="selectCustomerImportJob(${Number(job.id)})" style="width:100%;text-align:left;cursor:pointer;border-color:${selected&&job.id===selected.id?'var(--accent)':'var(--hairline)'}">
    <div style="display:flex;align-items:center;gap:8px"><b>${esc(c('job'))} #${num(job.id)}</b><span class="grow"></span>${cap(statusLabel(job.status),statusTone[job.status]||'neutral')}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:6px">${esc(job.fileName)} · ${num(job.totalRows)} ${esc(c('rows'))}</div>
  </button>`).join(''):`<div class="sumcard" style="color:var(--muted)">${esc(c('none'))}</div>`;
  const rowTable=selected&&rows.length?`<div class="tablewrap"><div class="dt-page"><div class="dt" role="table" style="--tpl:70px minmax(100px,.8fr) minmax(170px,1.3fr) minmax(120px,.8fr) 105px 105px">
    <div class="dt-r dt-head"><div class="dt-c r">${esc(c('row'))}</div><div class="dt-c l">${esc(c('code'))}</div><div class="dt-c l">${esc(c('name'))}</div><div class="dt-c l">${esc(c('industry'))}</div><div class="dt-c l">${esc(c('operation'))}</div><div class="dt-c l">${esc(c('result'))}</div></div>
    <div class="dt-body">${rows.map(row=>`<div class="dt-r"><div class="dt-c r tnum">${num(row.rowNumber)}</div><div class="dt-c l mono">${esc(row.code||'—')}</div><div class="dt-c l"><div class="cellsub"><b>${esc(row.name||'—')}</b>${errorByRow[row.rowNumber]?`<small style="color:var(--danger)">${esc(errorByRow[row.rowNumber].map(errorLabel).join(' '))}</small>`:''}</div></div><div class="dt-c l">${esc(row.industry||'—')}</div><div class="dt-c l">${esc(operationLabel(row.operation))}</div><div class="dt-c l">${cap(statusLabel(row.status),rowTone[row.status]||'neutral')}</div></div>`).join('')}</div>
  </div></div></div>`:statePanel({icon:'upload',title:selected?c('noRows'):c('selectJob')});
  const selectedHead=selected?`<div class="panel"><div class="panel-h"><h3>${esc(c('job'))} #${num(selected.id)} · ${esc(selected.fileName)}</h3><span class="grow"></span>${cap(statusLabel(selected.status),statusTone[selected.status]||'neutral')}</div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(80px,1fr));gap:8px;padding:14px">
      ${[['ready',selected.readyRows],['errors',selected.errorRows],['skipped',selected.skippedRows],['imported',selected.importedRows]].map(metric=>`<div class="card" style="padding:10px"><small style="color:var(--muted)">${esc(c(metric[0]))}</small><b class="tnum" style="display:block;font-size:21px;margin-top:3px">${num(metric[1])}</b></div>`).join('')}
    </div>${selected.status==='validated'?`<div style="padding:0 14px 14px;display:flex;justify-content:flex-end">${btn(c('run'),{icon:'upload',cls:'primary',attrs:`onclick="runCustomerImportJobFromUi(${Number(selected.id)})"`})}</div>`:''}</div>`:'';
  const body=`<div data-customer-import-canonical="true">
    <div class="alert info" style="margin:0 24px 14px">${ic('shield')}<span><b>${esc(c('readBoundary'))}</b> ${esc(c('readBoundaryBody'))}</span></div>
    <div class="toolbar"><div class="grow"></div>${btn(c('template'),{icon:'download',cls:'soft',attrs:'onclick="downloadCustomerImportTemplate()"'})}</div>
    <div class="doclayout" style="padding:0 24px 24px">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>${esc(c('newJob'))}</h3></div><div style="padding:14px;display:grid;gap:12px">
          <div class="fld"><span>${esc(c('file'))}</span><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input id="customerImportFile" type="file" accept=".csv,text/csv" onchange="customerImportFileChanged(this)"><input id="customerImportFileName" value="pasted-customers.csv" style="min-width:210px"></div></div>
          <div class="fld"><span>${esc(c('paste'))}</span><textarea id="customerImportCsv" rows="7" placeholder="code,name,industry\nDEMO-CUST-001,Fictional Precision Pte Ltd,Manufacturing" style="width:100%;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></textarea><small>${esc(c('pasteHint'))}</small></div>
          <div class="fld"><span>${esc(c('strategy'))}</span><select id="customerImportStrategy"><option value="update_existing">${esc(c('update'))}</option><option value="skip_existing">${esc(c('skip'))}</option></select><small>${esc(c('exactHeader'))}</small></div>
          <div style="display:flex;justify-content:flex-end">${btn(c('validate'),{icon:'check',cls:'primary',attrs:'onclick="createCustomerImportJobFromUi()"'})}</div>
        </div></div>
        ${selectedHead}${rowTable}
      </div>
      <aside class="summary"><div class="sectitle" style="margin-top:0">${esc(c('recent'))}</div>${jobList}</aside>
    </div>
  </div>`;
  return modulePage({module:'integration',route:'data-import',active:'data-import',title:c('title'),sub:c('sub'),count:jobs.length,body});
};
