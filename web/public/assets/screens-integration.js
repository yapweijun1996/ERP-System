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

/* ---------------- DATA IMPORT (wizard) ---------------- */
SCREENS['data-import'] = function(root){
  const j=DB.importJob;
  const mapTone={Mapped:'ok',Review:'warn',Skip:'neutral'};
  const mapRows=j.mapping.map((m,i)=>`<tr>
      <td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(m.src)}</b></td>
      <td class="l" style="color:var(--muted)">${ic('arrowR')}</td>
      <td class="l">${m.field.includes('unmapped')?`<span style="color:var(--faint)">${esc(m.field)}</span>`:`<b style="font-weight:600">${esc(m.field)}</b>`}</td>
      <td class="l">${cap(m.status,mapTone[m.status]||'neutral')}</td></tr>`).join('');
  const prevRows=j.preview.map(p=>`<tr class="${p.ok?'':'editing'}">
      <td class="l li-name"><b>${esc(p.a)}</b></td>
      <td class="l mono" style="font-size:12px">${esc(p.b)}</td>
      <td class="l" style="color:${p.ok?'var(--fg)':'var(--danger)'}">${esc(p.c)}</td>
      <td class="l">${esc(p.d)}</td>
      <td class="c">${p.ok?cap('Ready','ok'):cap('Error','danger')}</td></tr>`).join('');

  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:1000px">
    ${crumbs([DB.company.name,'Integration','Import data'])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('upload')}Import data <span class="dnum">${esc(j.target)}</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(j.file)} · ${num(j.rows)} rows · ${esc(j.size)}</div></div>
        <div class="dactions">${cap('Validating','info')}${btn('Download template',{icon:'filexls',cls:'soft'})}</div></div>
      <div class="stepper">
        <div class="step done"><span class="sdot">${ic('check')}</span>Upload file</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Map fields</div><span class="stepline done"></span>
        <div class="step current"><span class="sdot">${ic('clock')}</span>Validate</div><span class="stepline"></span>
        <div class="step"><span class="sdot"></span>Import</div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel">
          <div class="panel-h"><h3>Field mapping</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${j.mapping.filter(m=>m.status==='Mapped').length} of ${j.mapping.length} mapped</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Source column</th><th></th><th class="l">Aria field</th><th class="l">Status</th></tr></thead><tbody>${mapRows}</tbody></table>
        </div>
        <div class="panel">
          <div class="panel-h"><h3>Preview &amp; validation</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">first 4 of ${num(j.rows)} rows</span></div>
          <table class="lines"><thead><tr><th class="l">Customer name</th><th class="l">Matched ID</th><th class="l">Email</th><th class="l">Terms</th><th class="c">Result</th></tr></thead><tbody>${prevRows}</tbody></table>
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Validation summary</div>
          <div class="indicator ok" style="margin-bottom:8px"><div class="ind-top">${ic('checkc')}<span>Ready to import</span><span class="ind-r">${num(j.ready)}</span></div><div class="track"><i style="width:${Math.round(j.ready/j.rows*100)}%"></i></div><small>${Math.round(j.ready/j.rows*100)}% of rows pass validation.</small></div>
          <div class="indicator warn" style="margin-bottom:8px"><div class="ind-top">${ic('warn')}<span>Warnings</span><span class="ind-r">${j.warnings}</span></div><small>Owner not matched — will import unassigned.</small></div>
          <div class="indicator danger"><div class="ind-top">${ic('xc')}<span>Errors (skipped)</span><span class="ind-r">${j.errors}</span></div><small>Missing required email — fix &amp; re-upload to include.</small></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Options</div>
          <div class="fld"><span>On duplicate</span><select><option>Update existing</option><option>Skip</option><option>Create new</option></select></div>
          <div class="fld"><span>Match key</span><select><option>Registration no.</option><option>Email</option><option>Customer name</option></select></div>
          <label style="display:flex;align-items:center;gap:9px;padding:10px 0 2px;font-size:13px;cursor:pointer"><input type="checkbox" class="checkbox" checked style="flex:none"><span>Send notification on completion</span></label>
        </div>
      </aside>
    </div>
    <div style="height:40px"></div>
  </div></div>
  <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
    <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall"><b style="color:var(--fg)">${num(j.ready)}</b> rows will be imported · ${j.warnings} with warnings · ${j.errors} skipped.</div>
    <div class="grow"></div>
    ${btn('Back to mapping',{icon:'chevL',cls:'soft',attrs:'onclick="toast(\'Back to field mapping\',\'info\')"'})}
    ${btn('Import '+num(j.ready)+' records',{icon:'check',cls:'primary',sm:false,attrs:'data-act="run"'})}
  </div>
  </section></div>`;

  root.querySelector('[data-act="run"]').addEventListener('click',()=>{
    appModal({ icon:'upload', title:'Run import?',
      body:`<p style="color:var(--muted);font-size:13.5px">${num(j.ready)} customer records will be created or updated in <b>${esc(j.target)}</b>. ${j.errors} rows with errors are skipped and logged. This action is recorded in the audit trail.</p>`,
      actions:`${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Import now',{icon:'check',cls:'primary',attrs:'onclick="closeModal();toast(\''+num(j.ready)+' records imported · job IMP-26-0044\',\'ok\')"'})}` });
  });
};
