/* ============================================================
   ARIA ERP — screens: Admin
   (User Management, Audit Log, System Settings)
   ============================================================ */

function userStatusTone(s){ return {Active:'ok',Invited:'info',Disabled:'neutral'}[s]||'neutral'; }
function auditActionTone(a){
  return {create:'ok',set_active:'warn','set-permission':'warn',set_permission:'warn',post:'teal',confirm:'teal',accept:'ok',convert:'accent',complete:'ok',release:'accent',reject:'danger'}[a]||'neutral';
}

function adminCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{
      fieldEmail:'Email',emailPlaceholder:'name@company.com',fieldRole:'Role',
      emailRequired:'Enter a valid email address',roleRequired:'Select a role',
      inviteSent:'Invitation sent to {email}',inviteError:'Invitation could not be sent',
      enable:'Enable',disable:'Disable',you:'you',
      toggleEnabled:'{email} enabled',toggleDisabled:'{email} disabled',toggleError:'Could not update this user',
      cannotDisableSelf:"You can't disable your own account",
      invitedRow:'Invitation pending',
      addRole:'Add role',roleNameLabel:'Role name',roleNamePlaceholder:'e.g. Warehouse Lead',
      roleNameRequired:'Role name is required',roleCreated:'Role "{name}" created',roleCreateError:'Role could not be created',
      permMatrixTitle:'Module → permission access per role. Click a cell to toggle allowed / not allowed.',
      permAllowed:'Allowed',permDenied:'Not allowed',superadminNote:'Superadmin always has full access and cannot be edited.',
      permUpdated:'Permission updated',permUpdateError:'Permission could not be updated',
      grpDashboard:'Dashboard',grpInventory:'Inventory',grpSales:'Sales',grpFinance:'Finance',grpPurchasing:'Purchasing',
      grpCrm:'CRM',grpManufacturing:'Manufacturing',grpQuality:'Quality',grpAsset:'Fixed Assets',grpAdmin:'Admin',grpSession:'Session',
      auditFilterAllUsers:'All users',auditFilterAllEntities:'All record types',auditColTime:'Time',auditColUser:'User',
      auditColAction:'Action',auditColRecord:'Record',auditTitle:'Audit Trail',auditMeta:'{count} events · immutable system log{truncated}',
      auditTruncated:' · showing latest 100',auditNoEvents:'No activity recorded yet — actions you take are logged here in real time.',
      auditSystem:'System',
      modActTitle:'Module Activation Control',
      modActSubtitle:'Turn ERP modules on or off for {master}. Disabled modules are hidden from navigation and blocked from access, including through the API.',
      modActColModule:'Module',modActColStatus:'Status',modActColAction:'Action',
      modActEnabled:'Enabled',modActDisabled:'Disabled',modActOpen:'Open',modActRequired:'Required',
      modActResetDefaults:'Enable all',modActResetDone:'All modules enabled',modActUpdateError:'Could not update this module',
      modActAdminOnly:'Admin access required',modActAdminOnlyBody:'Only Admin and Superadmin accounts can manage module activation.',
      modActEnabledCount:'Enabled',
    },
    ms:{
      fieldEmail:'E-mel',emailPlaceholder:'nama@syarikat.com',fieldRole:'Peranan',
      emailRequired:'Masukkan alamat e-mel yang sah',roleRequired:'Pilih peranan',
      inviteSent:'Jemputan dihantar kepada {email}',inviteError:'Jemputan tidak dapat dihantar',
      enable:'Aktifkan',disable:'Lumpuhkan',you:'anda',
      toggleEnabled:'{email} diaktifkan',toggleDisabled:'{email} dilumpuhkan',toggleError:'Pengguna ini tidak dapat dikemas kini',
      cannotDisableSelf:'Anda tidak boleh melumpuhkan akaun sendiri',
      invitedRow:'Jemputan belum diterima',
      addRole:'Tambah peranan',roleNameLabel:'Nama peranan',roleNamePlaceholder:'cth. Ketua Gudang',
      roleNameRequired:'Nama peranan diperlukan',roleCreated:'Peranan "{name}" dicipta',roleCreateError:'Peranan tidak dapat dicipta',
      permMatrixTitle:'Akses modul → kebenaran mengikut peranan. Klik sel untuk togol dibenarkan / tidak dibenarkan.',
      permAllowed:'Dibenarkan',permDenied:'Tidak dibenarkan',superadminNote:'Superadmin sentiasa mempunyai akses penuh dan tidak boleh diubah.',
      permUpdated:'Kebenaran dikemas kini',permUpdateError:'Kebenaran tidak dapat dikemas kini',
      grpDashboard:'Papan Pemuka',grpInventory:'Inventori',grpSales:'Jualan',grpFinance:'Kewangan',grpPurchasing:'Perolehan',
      grpCrm:'CRM',grpManufacturing:'Pembuatan',grpQuality:'Kualiti',grpAsset:'Aset Tetap',grpAdmin:'Pentadbiran',grpSession:'Sesi',
      auditFilterAllUsers:'Semua pengguna',auditFilterAllEntities:'Semua jenis rekod',auditColTime:'Masa',auditColUser:'Pengguna',
      auditColAction:'Tindakan',auditColRecord:'Rekod',auditTitle:'Jejak Audit',auditMeta:'{count} peristiwa · log sistem tidak boleh diubah{truncated}',
      auditTruncated:' · memaparkan 100 terkini',auditNoEvents:'Belum ada aktiviti direkodkan — tindakan anda akan dilog di sini secara masa nyata.',
      auditSystem:'Sistem',
      modActTitle:'Kawalan Pengaktifan Modul',
      modActSubtitle:'Hidupkan atau matikan modul ERP untuk {master}. Modul yang dilumpuhkan disembunyikan daripada navigasi dan disekat daripada akses, termasuk melalui API.',
      modActColModule:'Modul',modActColStatus:'Status',modActColAction:'Tindakan',
      modActEnabled:'Diaktifkan',modActDisabled:'Dilumpuhkan',modActOpen:'Buka',modActRequired:'Diperlukan',
      modActResetDefaults:'Aktifkan semua',modActResetDone:'Semua modul diaktifkan',modActUpdateError:'Modul ini tidak dapat dikemas kini',
      modActAdminOnly:'Akses admin diperlukan',modActAdminOnlyBody:'Hanya akaun Admin dan Superadmin boleh mengurus pengaktifan modul.',
      modActEnabledCount:'Diaktifkan',
    },
    zh:{
      fieldEmail:'邮箱',emailPlaceholder:'name@company.com',fieldRole:'角色',
      emailRequired:'请输入有效的邮箱地址',roleRequired:'请选择角色',
      inviteSent:'邀请已发送至 {email}',inviteError:'邀请发送失败',
      enable:'启用',disable:'停用',you:'您',
      toggleEnabled:'{email} 已启用',toggleDisabled:'{email} 已停用',toggleError:'无法更新该用户',
      cannotDisableSelf:'无法停用自己的账户',
      invitedRow:'邀请待接受',
      addRole:'新增角色',roleNameLabel:'角色名称',roleNamePlaceholder:'例如:仓库主管',
      roleNameRequired:'请填写角色名称',roleCreated:'角色「{name}」已创建',roleCreateError:'角色创建失败',
      permMatrixTitle:'各角色的模块权限。点击单元格切换允许 / 不允许。',
      permAllowed:'允许',permDenied:'不允许',superadminNote:'超级管理员始终拥有完全权限,不可编辑。',
      permUpdated:'权限已更新',permUpdateError:'权限更新失败',
      grpDashboard:'仪表盘',grpInventory:'库存',grpSales:'销售',grpFinance:'财务',grpPurchasing:'采购',
      grpCrm:'客户关系',grpManufacturing:'生产',grpQuality:'质量',grpAsset:'固定资产',grpAdmin:'管理',grpSession:'会话',
      auditFilterAllUsers:'所有用户',auditFilterAllEntities:'所有记录类型',auditColTime:'时间',auditColUser:'用户',
      auditColAction:'操作',auditColRecord:'记录',auditTitle:'审计日志',auditMeta:'{count} 条事件 · 不可篡改的系统日志{truncated}',
      auditTruncated:' · 显示最近 100 条',auditNoEvents:'暂无活动记录 — 您执行的操作会实时记录在此处。',
      auditSystem:'系统',
      modActTitle:'模块启用控制',
      modActSubtitle:'为 {master} 开启或关闭 ERP 模块。已停用的模块会从导航中隐藏,并且包括通过 API 在内的所有访问都会被阻止。',
      modActColModule:'模块',modActColStatus:'状态',modActColAction:'操作',
      modActEnabled:'已启用',modActDisabled:'已停用',modActOpen:'打开',modActRequired:'必需',
      modActResetDefaults:'全部启用',modActResetDone:'所有模块已启用',modActUpdateError:'无法更新此模块',
      modActAdminOnly:'需要管理员权限',modActAdminOnlyBody:'只有管理员和超级管理员账户可以管理模块启用状态。',
      modActEnabledCount:'已启用',
    },
    ja:{
      fieldEmail:'メール',emailPlaceholder:'name@company.com',fieldRole:'役割',
      emailRequired:'有効なメールアドレスを入力してください',roleRequired:'役割を選択してください',
      inviteSent:'{email} に招待を送信しました',inviteError:'招待を送信できませんでした',
      enable:'有効化',disable:'無効化',you:'あなた',
      toggleEnabled:'{email} を有効化しました',toggleDisabled:'{email} を無効化しました',toggleError:'このユーザーを更新できませんでした',
      cannotDisableSelf:'自分自身のアカウントは無効化できません',
      invitedRow:'招待は保留中です',
      addRole:'役割を追加',roleNameLabel:'役割名',roleNamePlaceholder:'例:倉庫リーダー',
      roleNameRequired:'役割名を入力してください',roleCreated:'役割「{name}」を作成しました',roleCreateError:'役割を作成できませんでした',
      permMatrixTitle:'役割ごとのモジュール権限。セルをクリックして許可/不許可を切り替えます。',
      permAllowed:'許可',permDenied:'不許可',superadminNote:'スーパー管理者は常にフルアクセス権を持ち、編集できません。',
      permUpdated:'権限を更新しました',permUpdateError:'権限を更新できませんでした',
      grpDashboard:'ダッシュボード',grpInventory:'在庫',grpSales:'販売',grpFinance:'財務',grpPurchasing:'購買',
      grpCrm:'CRM',grpManufacturing:'製造',grpQuality:'品質',grpAsset:'固定資産',grpAdmin:'管理',grpSession:'セッション',
      auditFilterAllUsers:'すべてのユーザー',auditFilterAllEntities:'すべての記録種別',auditColTime:'日時',auditColUser:'ユーザー',
      auditColAction:'操作',auditColRecord:'記録',auditTitle:'監査証跡',auditMeta:'{count} 件のイベント · 改ざん不可のシステムログ{truncated}',
      auditTruncated:' · 最新100件を表示',auditNoEvents:'まだ活動記録がありません — 実行した操作はここにリアルタイムで記録されます。',
      auditSystem:'システム',
      modActTitle:'モジュール有効化管理',
      modActSubtitle:'{master} 用に ERP モジュールを有効/無効にします。無効化したモジュールはナビゲーションから非表示になり、API を含むすべてのアクセスがブロックされます。',
      modActColModule:'モジュール',modActColStatus:'ステータス',modActColAction:'操作',
      modActEnabled:'有効',modActDisabled:'無効',modActOpen:'開く',modActRequired:'必須',
      modActResetDefaults:'すべて有効化',modActResetDone:'すべてのモジュールを有効化しました',modActUpdateError:'このモジュールを更新できませんでした',
      modActAdminOnly:'管理者権限が必要です',modActAdminOnlyBody:'Admin および Superadmin アカウントのみがモジュールの有効化を管理できます。',
      modActEnabledCount:'有効',
    },
    vi:{
      fieldEmail:'Email',emailPlaceholder:'ten@congty.com',fieldRole:'Vai trò',
      emailRequired:'Vui lòng nhập địa chỉ email hợp lệ',roleRequired:'Vui lòng chọn vai trò',
      inviteSent:'Đã gửi lời mời đến {email}',inviteError:'Không thể gửi lời mời',
      enable:'Kích hoạt',disable:'Vô hiệu hóa',you:'bạn',
      toggleEnabled:'Đã kích hoạt {email}',toggleDisabled:'Đã vô hiệu hóa {email}',toggleError:'Không thể cập nhật người dùng này',
      cannotDisableSelf:'Bạn không thể vô hiệu hóa tài khoản của chính mình',
      invitedRow:'Lời mời đang chờ',
      addRole:'Thêm vai trò',roleNameLabel:'Tên vai trò',roleNamePlaceholder:'vd: Trưởng kho',
      roleNameRequired:'Vui lòng nhập tên vai trò',roleCreated:'Đã tạo vai trò "{name}"',roleCreateError:'Không thể tạo vai trò',
      permMatrixTitle:'Quyền truy cập theo mô-đun cho từng vai trò. Nhấp vào ô để chuyển đổi cho phép / không cho phép.',
      permAllowed:'Cho phép',permDenied:'Không cho phép',superadminNote:'Superadmin luôn có toàn quyền truy cập và không thể chỉnh sửa.',
      permUpdated:'Đã cập nhật quyền',permUpdateError:'Không thể cập nhật quyền',
      grpDashboard:'Bảng điều khiển',grpInventory:'Tồn kho',grpSales:'Bán hàng',grpFinance:'Tài chính',grpPurchasing:'Mua hàng',
      grpCrm:'CRM',grpManufacturing:'Sản xuất',grpQuality:'Chất lượng',grpAsset:'Tài sản cố định',grpAdmin:'Quản trị',grpSession:'Phiên đăng nhập',
      auditFilterAllUsers:'Tất cả người dùng',auditFilterAllEntities:'Tất cả loại bản ghi',auditColTime:'Thời gian',auditColUser:'Người dùng',
      auditColAction:'Hành động',auditColRecord:'Bản ghi',auditTitle:'Nhật ký kiểm toán',auditMeta:'{count} sự kiện · nhật ký hệ thống không thể sửa đổi{truncated}',
      auditTruncated:' · hiển thị 100 gần nhất',auditNoEvents:'Chưa có hoạt động nào được ghi nhận — các hành động của bạn sẽ được ghi lại tại đây theo thời gian thực.',
      auditSystem:'Hệ thống',
      modActTitle:'Kiểm soát kích hoạt mô-đun',
      modActSubtitle:'Bật hoặc tắt các mô-đun ERP cho {master}. Các mô-đun bị vô hiệu hóa sẽ bị ẩn khỏi điều hướng và bị chặn truy cập, kể cả qua API.',
      modActColModule:'Mô-đun',modActColStatus:'Trạng thái',modActColAction:'Hành động',
      modActEnabled:'Đã kích hoạt',modActDisabled:'Đã vô hiệu hóa',modActOpen:'Mở',modActRequired:'Bắt buộc',
      modActResetDefaults:'Kích hoạt tất cả',modActResetDone:'Đã kích hoạt tất cả mô-đun',modActUpdateError:'Không thể cập nhật mô-đun này',
      modActAdminOnly:'Yêu cầu quyền quản trị',modActAdminOnlyBody:'Chỉ tài khoản Admin và Superadmin mới có thể quản lý kích hoạt mô-đun.',
      modActEnabledCount:'Đã kích hoạt',
    },
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

const PERMISSION_GROUPS=[
  {prefix:'dashboard.',key:'grpDashboard'},{prefix:'inventory.',key:'grpInventory'},
  {prefix:'sales.',key:'grpSales'},{prefix:'finance.',key:'grpFinance'},
  {prefix:'purchasing.',key:'grpPurchasing'},{prefix:'crm.',key:'grpCrm'},
  {prefix:'manufacturing.',key:'grpManufacturing'},{prefix:'quality.',key:'grpQuality'},
  {prefix:'asset.',key:'grpAsset'},{prefix:'admin.',key:'grpAdmin'},{prefix:'session.',key:'grpSession'},
];
function permissionGroupKey(permissionKey){
  const hit=PERMISSION_GROUPS.find(g=>permissionKey.indexOf(g.prefix)===0);
  return hit?hit.key:'grpAdmin';
}

/* ---------------- USER MANAGEMENT (listing — module landing) ---------------- */
SCREENS['user-mgmt'] = async function(root){
  const s=adminCopy();
  const usersPage=(await listPage('admin/users')).data;
  const rows=[...usersPage.users, ...usersPage.invitations];
  let filter='all';
  const roleNames=[...new Set(usersPage.users.map(u=>u.roleName))];
  const chips=[['all',t('common.all')]].concat(roleNames.map(r=>[r,r]));
  function filtered(){ return filter==='all'?rows:rows.filter(u=>u.roleName===filter); }
  function initialsOf(text){
    return (text||'?').replace(/[^A-Za-z ]/g,'').split(' ').filter(Boolean).slice(0,2)
      .map(w=>w[0]).join('').toUpperCase()||'?';
  }
  function table(){
    return buildTable({
      rowId:u=>u.kind+'-'+u.id,
      columns:[
        {label:t('usr.col.user'),render:u=>`<div style="display:flex;align-items:center;gap:11px"><span class="kc-av" style="background:#0a84ff;width:30px;height:30px;font-size:11px">${esc(initialsOf(u.fullName||u.email))}</span><div class="cellsub"><b>${esc(u.fullName||u.email)}</b><small>${esc(u.email)}</small></div></div>`},
        {label:t('hr.col.role'),align:'l',render:u=>esc(u.roleName)},
        {label:t('usr.col.lastactive'),align:'l',render:u=>u.lastActiveAt?esc(String(u.lastActiveAt).slice(0,16).replace('T',' ')):'—'},
        {label:t('col.status'),align:'l',render:u=>cap(ts(u.status),userStatusTone(u.status))},
        {label:'',align:'c',render:u=>u.kind==='user'&&u.email!==(DB.user&&DB.user.email)
          ?`<span class="rowact"><button data-tip="${esc(u.status==='Active'?s('disable'):s('enable'))}" data-act="toggle" data-id="${u.id}" data-active="${u.status==='Active'}">${ic(u.status==='Active'?'x':'check')}</button></span>`
          :(u.kind==='user'?`<span class="rowact" data-tip="${esc(s('you'))}"><button disabled>${ic('user')}</button></span>`:'')},
      ],
      rows:filtered(),
    });
  }
  function statTile(label,value,sub,tone){
    return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
      <b class="tnum" style="font-size:23px;font-weight:600;letter-spacing:-.02em;color:${tone||'var(--fg)'}">${value}</b>
      <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
  }
  async function render(){
    const active=usersPage.users.filter(u=>u.status==='Active').length;
    const invited=usersPage.invitations.length;
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,t('nav.admin'),t('usr.crumb')])}
        <div class="h1row"><h1>${esc(t('usr.title'))}</h1><span class="countchip" id="usrCount"></span></div>
      </div>
      <div class="statwrap"><div class="statcards">
        ${statTile(t('usr.t.total'),usersPage.users.length,t('usr.t.totalsub'))}
        ${statTile(t('usr.t.active'),active,t('usr.t.activesub'),'var(--ok)')}
        ${statTile(t('usr.t.invites'),invited,t('usr.t.invitessub'),invited?'var(--warn)':undefined)}
      </div></div>
      <div class="toolbar">
        <div class="filterchips" id="usrChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${esc(c[0])}">${esc(c[1])}</button>`).join('')}</div>
        <div class="grow"></div>
        <button class="viewsel" data-tip="${esc(t('usr.rolestip'))}" onclick="navigate('role-permission')">${ic('shield')}${esc(t('usr.roles'))}</button>
        <button class="viewsel" data-tip="${esc(t('usr.audit'))}" onclick="navigate('audit-log')">${ic('history')}${esc(t('usr.audit'))}</button>
        ${btn(t('usr.invite'),{icon:'plus',cls:'primary',attrs:'data-act="invite"'})}
      </div>
      <div class="tablewrap" id="usrTable">${table()}</div>
    </section></div>`;
    $('#usrCount').textContent=filtered().length+' '+t('usr.users');
    rewire();
  }
  function rewire(){
    wireTable($('#usrTable'),{ onRow:()=>navigate('role-permission') });
    $('#usrTable').querySelectorAll('[data-act="toggle"]').forEach(b=>b.addEventListener('click',async e=>{
      e.stopPropagation();
      const userId=Number(b.dataset.id);
      const wasActive=b.dataset.active==='true';
      const row=usersPage.users.find(u=>u.id===userId);
      b.disabled=true;
      try{
        await window.ErpSystemData.action('admin/users',userId,'toggle-active',{isActive:!wasActive});
        toast(s(wasActive?'toggleDisabled':'toggleEnabled').replace('{email}',row?row.email:''),'ok');
        const refreshed=(await listPage('admin/users')).data;
        usersPage.users=refreshed.users; usersPage.invitations=refreshed.invitations;
        rows.length=0; rows.push(...usersPage.users,...usersPage.invitations);
        await render();
      }catch(error){
        b.disabled=false;
        toast(error&&error.message?error.message:s('toggleError'),'danger');
      }
    }));
    $('#usrChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
      $('#usrChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
      $('#usrTable').innerHTML=table(); $('#usrCount').textContent=filtered().length+' '+t('usr.users'); rewire();
    }));
    const inviteBtn=root.querySelector('[data-act="invite"]');
    inviteBtn&&inviteBtn.addEventListener('click',()=>openInviteModal());
  }
  function openInviteModal(){
    appModal({
      icon: 'people',
      title: t('usr.invite'),
      body: `<div class="set-grid">
        <div class="fld"><span>${esc(s('fieldEmail'))} <span class="req">*</span></span><input id="uiEmail" type="email" placeholder="${esc(s('emailPlaceholder'))}"></div>
        <div class="fld"><span>${esc(s('fieldRole'))} <span class="req">*</span></span><select id="uiRole">${usersPage.users.length?'':''}${roleOptions()}</select></div>
      </div>`,
      actions: `${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(t('usr.m.send'),{icon:'send',cls:'primary',attrs:'data-save="1"'})}`,
    });
    const saveBtn=$('#modalEl').querySelector('[data-save]');
    saveBtn.addEventListener('click',async()=>{
      const email=$('#uiEmail').value.trim();
      const roleId=Number($('#uiRole').value);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast(s('emailRequired'),'danger'); return; }
      if(!requireField(roleId, s('roleRequired'))) return;
      saveBtn.disabled=true;
      try{
        await window.ErpSystemData.create('admin/invitations',{email,roleId});
        closeModal();
        toast(s('inviteSent').replace('{email}',email),'ok');
        const refreshed=(await listPage('admin/users')).data;
        usersPage.users=refreshed.users; usersPage.invitations=refreshed.invitations;
        rows.length=0; rows.push(...usersPage.users,...usersPage.invitations);
        await render();
      }catch(error){
        saveBtn.disabled=false;
        toast(error&&error.message?error.message:s('inviteError'),'danger');
      }
    });
  }
  function roleOptions(){
    const uniqueRoles=[];
    const seen=new Set();
    usersPage.users.forEach(u=>{ if(!seen.has(u.roleId)){ seen.add(u.roleId); uniqueRoles.push({roleId:u.roleId,roleName:u.roleName}); } });
    return uniqueRoles.map(r=>`<option value="${r.roleId}">${esc(r.roleName)}</option>`).join('');
  }
  await render();
};

/* ---------------- AUDIT LOG (report) ---------------- */
SCREENS['audit-log'] = async function(root){
  const s=adminCopy();
  const page=await listPage('admin/audit-log');
  const events=page.data;
  let userFilter='all', entityFilter='all';
  const userNames=[...new Set(events.map(e=>e.actorName||e.actorEmail).filter(Boolean))];
  const entities=[...new Set(events.map(e=>e.entity))];
  function filtered(){
    return events.filter(e=>{
      if(userFilter!=='all'&&(e.actorName||e.actorEmail)!==userFilter) return false;
      if(entityFilter!=='all'&&e.entity!==entityFilter) return false;
      return true;
    }).slice().reverse();
  }
  function table(){
    const rows=filtered();
    if(!rows.length){
      return statePanel({icon:'history',title:s('auditNoEvents')});
    }
    const tpl='150px minmax(130px,1.2fr) minmax(140px,1.2fr) minmax(160px,1.6fr)';
    let h=`<div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
      <div class="dt-r dt-head"><div class="dt-c l">${esc(s('auditColTime'))}</div><div class="dt-c l">${esc(s('auditColUser'))}</div><div class="dt-c l">${esc(s('auditColAction'))}</div><div class="dt-c l">${esc(s('auditColRecord'))}</div></div>
      <div class="dt-body">`;
    rows.forEach(e=>{
      h+=`<div class="dt-r">
        <div class="dt-c l mono" style="color:var(--muted);font-size:12px">${esc(String(e.occurredAt).slice(0,16).replace('T',' '))}</div>
        <div class="dt-c l"><b style="font-weight:600">${esc(e.actorName||e.actorEmail||s('auditSystem'))}</b></div>
        <div class="dt-c l">${cap(esc(e.action),auditActionTone(e.action))}</div>
        <div class="dt-c l mono" style="font-size:12px;color:var(--accent)">${esc(e.entity)}${e.entityId!=null?' #'+esc(e.entityId):''}</div>
      </div>`;
    });
    h+=`</div></div></div>`; return h;
  }
  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>${esc(t('common.filter'))}</h3>
      <div class="fld"><span>${esc(s('auditColUser'))}</span><select id="alUser"><option value="all">${esc(s('auditFilterAllUsers'))}</option>${userNames.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join('')}</select></div>
      <div class="fld"><span>${esc(s('auditColRecord'))}</span><select id="alEntity"><option value="all">${esc(s('auditFilterAllEntities'))}</option>${entities.map(en=>`<option value="${esc(en)}">${esc(en)}</option>`).join('')}</select></div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">${esc(s('auditTitle'))}</b><div class="report-meta">${esc(s('auditMeta').replace('{count}',events.length).replace('{truncated}',page.nextCursor?s('auditTruncated'):''))}</div></div>
        <div class="grow"></div>
        ${btn(t('usr.crumb'),{icon:'people',cls:'soft',attrs:'onclick="navigate(\'user-mgmt\')"'})}
      </div>
      <div class="tablewrap" id="alTable">${table()}</div>
    </div>
  </div></section></div>`;
  function rewire(){ $('#alTable').innerHTML=table(); }
  $('#alUser').addEventListener('change',e=>{ userFilter=e.target.value; rewire(); });
  $('#alEntity').addEventListener('change',e=>{ entityFilter=e.target.value; rewire(); });
};

/* ---------------- SYSTEM SETTINGS (config) ---------------- */
SCREENS['sys-settings'] = function(root){
  const numRows=DB.numbering.map(n=>`<tr>
    <td class="l li-name"><b>${esc(n.doc)}</b></td>
    <td class="l mono" style="font-size:12px">${esc(n.format)}</td>
    <td class="tnum">${n.next}</td>
    <td class="l">${esc(n.reset)}</td>
    <td class="l"><button class="btn plain sm" onclick="toast('Edit sequence — ${esc(n.doc)}','info')">${ic('edit')}</button></td></tr>`).join('');
  const taxRows=DB.taxCodes.map(t=>`<tr>
    <td class="l li-name"><b>${esc(t.code)}</b><small>${esc(t.name)}</small></td>
    <td class="tnum">${t.rate.toFixed(1)}%</td>
    <td class="l">${esc(t.type)}</td>
    <td class="l">${cap(t.status,'ok')}</td></tr>`).join('');
  const curRows=DB.currencies.map(c=>`<tr>
    <td class="l li-name"><b>${esc(c.code)}</b><small>${esc(c.name)}</small></td>
    <td class="tnum">${c.base?'—':c.rate.toFixed(4)}</td>
    <td class="l">${c.base?cap('Base','accent'):'<span style="color:var(--muted)">vs USD</span>'}</td></tr>`).join('');

  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:980px">
    ${crumbs([DB.company.name,'Admin','System Settings'])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('gear')}System Settings</div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">Numbering · tax · currency · company configuration</div></div>
        <div class="dactions"><a class="btn soft sm" href="Database Workbench.html" target="_blank" rel="noopener" data-tip="Open in-browser Postgres">${ic('grid')}<span>Database workbench</span></a><span class="env" style="position:static">PRODUCTION</span></div></div>
      <div class="docmeta">
        <div class="dm"><small>Company</small><b>${esc(DB.company.name)}</b></div>
        <div class="dm"><small>Base currency</small><b>USD</b></div>
        <div class="dm"><small>Fiscal year</small><b>FY2026 · Jan–Dec</b></div>
        <div class="dm"><small>Current period</small><b>P06 · June · Open</b></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-h"><h3>Document numbering</h3><div class="ph-act">${btn('Add sequence',{icon:'plus',cls:'plain',attrs:'onclick="toast(\'New numbering sequence\',\'info\')"'})}</div></div>
      <table class="lines"><thead><tr><th class="l">Document</th><th class="l">Format</th><th>Next no.</th><th class="l">Reset</th><th class="l"></th></tr></thead><tbody>${numRows}</tbody></table>
    </div>
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-h"><h3>Tax codes</h3><div class="ph-act">${btn('Add tax code',{icon:'plus',cls:'plain',attrs:'onclick="toast(\'New tax code\',\'info\')"'})}</div></div>
      <table class="lines"><thead><tr><th class="l">Code</th><th>Rate</th><th class="l">Type</th><th class="l">Status</th></tr></thead><tbody>${taxRows}</tbody></table>
    </div>
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-h"><h3>Currencies &amp; FX rates</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">auto-updated daily · CIMB feed</span></div>
      <table class="lines"><thead><tr><th class="l">Currency</th><th>Rate</th><th class="l">Role</th></tr></thead><tbody>${curRows}</tbody></table>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>General</h3></div>
      <div class="panel-body">
        <div class="fldrow c3">
          <div class="fld"><span>Company name</span><input value="${esc(DB.company.name)}"></div>
          <div class="fld"><span>Default warehouse</span><input value="KL-Main"></div>
          <div class="fld"><span>Date format</span><select><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option></select></div>
        </div>
        <div class="fldrow c3" style="margin-top:4px">
          <div class="fld"><span>Negative stock</span><select><option>Block</option><option>Allow with warning</option></select></div>
          <div class="fld"><span>Approval threshold</span><input value="$50,000"></div>
          <div class="fld"><span>Session timeout</span><select><option>30 minutes</option><option>1 hour</option><option>4 hours</option></select></div>
        </div>
      </div>
    </div>
    <div style="height:50px"></div>
  </div></div>
  <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
    <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Changes are logged to the audit trail.</div>
    <div class="grow"></div>
    ${btn('Discard',{cls:'soft',attrs:'onclick="toast(\'Changes discarded\',\'info\')"'})}
    ${btn('Save settings',{icon:'check',cls:'primary',sm:false,attrs:'onclick="toast(\'Settings saved · audit entry created\',\'ok\')"'})}
  </div>
  </section></div>`;
};

/* ---------------- MODULE ACTIVATION CONTROL (master/client module toggles) ---------------- */
SCREENS['module-activation-control'] = async function(root){
  const s=adminCopy();
  if(!isModuleAdmin()){
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,'Admin',s('modActTitle')])}
        <div class="h1row"><h1>${esc(s('modActTitle'))}</h1>${cap('Admin only','warn')}</div>
      </div>
      ${statePanel({icon:'lock',title:s('modActAdminOnly'),body:s('modActAdminOnlyBody')})}
    </section></div>`;
    return;
  }

  await loadModuleControl();
  const rows=()=>moduleControlItems();
  let busy=null;

  function enabledCount(){ return rows().filter(m=>readModuleControl()[m.id]&&readModuleControl()[m.id].active).length; }

  function table(){
    const cfg=readModuleControl();
    const body=rows().map(m=>{
      const st=cfg[m.id]||{visible:true,active:true};
      return `<tr data-module="${esc(m.id)}">
        <td class="l li-name"><b>${ic(m.icon)} ${esc(m.label)}</b><small>${esc(m.group)} · ${esc(m.route)}${m.required?' · '+esc(s('modActRequired')):''}</small></td>
        <td class="l mono">${esc(currentMasterFn())}</td>
        <td class="l">${cap(st.active?s('modActEnabled'):s('modActDisabled'),st.active?'ok':'neutral')}</td>
        <td class="c">${m.required
          ?cap(s('modActRequired'),'accent')
          :`<input class="checkbox" type="checkbox" data-toggle="enabled" ${st.active?'checked':''} ${busy===m.id?'disabled':''} aria-label="${esc(s('modActEnabled'))} ${esc(m.label)}">`}</td>
        <td class="c">${btn(s('modActOpen'),{icon:'ext',cls:'plain',attrs:`data-open="${esc(m.route)}"`})}</td>
      </tr>`;
    }).join('');
    return `<table class="lines"><thead><tr><th class="l">${esc(s('modActColModule'))}</th><th class="l">Master FN</th><th class="l">${esc(s('modActColStatus'))}</th><th class="c">${esc(s('modActEnabled'))}</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
  }

  function render(){
    root.innerHTML=`<div class="content full"><section class="master"><div class="scrollarea">
      <div class="pagehead">
        ${crumbs([DB.company.name,'Admin',s('modActTitle')])}
        <div class="h1row"><h1>${esc(s('modActTitle'))}</h1><span class="acct-role" style="font-size:11px">${ic('shield')}${esc(DB.user.role)}</span>
          <div class="headright">
            <div class="kfig"><small>Master FN</small><b class="tnum">${esc(currentMasterFn())}</b></div>
            <div class="kfig"><small>${esc(s('modActEnabledCount'))}</small><b class="tnum">${enabledCount()}/${rows().length}</b></div>
          </div></div>
        <div class="h1sub">${esc(s('modActSubtitle').replace('{master}',currentMasterFn()))}</div>
      </div>
      <div class="toolbar">
        ${btn(s('modActResetDefaults'),{icon:'refresh',cls:'soft',attrs:'data-act="reset"'})}
      </div>
      <div class="panel" style="margin:0 24px 24px">
        <div class="panel-h"><h3>${esc(s('modActColModule'))}</h3></div>
        ${table()}
      </div>
    </div></section></div>`;

    root.querySelectorAll('[data-toggle="enabled"]').forEach(input=>input.addEventListener('change',async()=>{
      const id=input.closest('[data-module]').dataset.module;
      const item=rows().find(m=>m.id===id);
      if(!item||item.required) return;
      const enabled=input.checked;
      busy=id; render();
      try{
        await setModuleEnabled(id, enabled);
        renderSidebar(); renderTabbar(); setActiveNav(CURRENT_ROUTE);
        toast(`${item.label} ${enabled?s('modActEnabled'):s('modActDisabled')}`,'ok');
      }catch(e){
        toast(s('modActUpdateError'),'danger');
      }
      busy=null; render();
    }));
    root.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.open)));
    root.querySelector('[data-act="reset"]').addEventListener('click',async()=>{
      const toEnable=rows().filter(m=>!m.required&&!(readModuleControl()[m.id]&&readModuleControl()[m.id].active));
      if(!toEnable.length){ toast(s('modActResetDone'),'ok'); return; }
      try{
        await Promise.all(toEnable.map(m=>setModuleEnabled(m.id,true)));
        await loadModuleControl();
        renderSidebar(); renderTabbar(); setActiveNav(CURRENT_ROUTE);
        toast(s('modActResetDone'),'ok');
      }catch(e){
        toast(s('modActUpdateError'),'danger');
      }
      render();
    });
  }
  render();
};
