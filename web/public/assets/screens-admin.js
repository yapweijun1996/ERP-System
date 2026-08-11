/* ============================================================
   ARIA ERP — screens: Admin
   (User Management, Audit Log, System Settings)
   ============================================================ */

function userStatusTone(s){ return {Active:'ok',Invited:'info',Disabled:'neutral'}[s]||'neutral'; }
function auditActionTone(a){
  return {create:'ok',set_active:'warn','set-permission':'warn',set_permission:'warn',post:'teal',confirm:'teal',accept:'ok',convert:'accent',complete:'ok',release:'accent',reject:'danger'}[a]||'neutral';
}

function adminCopy(){

  const packs={
    en:{
      fieldEmail:'Email',emailPlaceholder:'name@company.com',fieldRole:'Role',
      emailRequired:'Enter a valid email address',roleRequired:'Select a role',
      inviteSent:'Invitation sent to {email}',inviteError:'Invitation could not be sent',
      enable:'Enable',disable:'Disable',you:'you',
      manageRoles:'Manage roles',saveRoles:'Save roles',rolesUpdated:'Roles updated',rolesUpdateError:'Could not update roles',
      managedRole:'Managed automatically from the employee reporting line',
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
    },
    ms:{
  "fieldEmail": "E-mel",
  "emailPlaceholder": "nama@syarikat.com",
  "fieldRole": "Peranan",
  "emailRequired": "Masukkan alamat e-mel yang sah",
  "roleRequired": "Pilih peranan",
  "inviteSent": "Jemputan dihantar kepada {email}",
  "inviteError": "Jemputan tidak dapat dihantar",
  "enable": "Aktifkan",
  "disable": "Lumpuhkan",
  "you": "anda",
  "manageRoles": "Urus peranan",
  "saveRoles": "Simpan peranan",
  "rolesUpdated": "Peranan dikemas kini",
  "rolesUpdateError": "Peranan tidak dapat dikemas kini",
  "managedRole": "Diurus secara automatik daripada garis pelaporan pekerja",
  "toggleEnabled": "{email} diaktifkan",
  "toggleDisabled": "{email} dilumpuhkan",
  "toggleError": "Pengguna ini tidak dapat dikemas kini",
  "cannotDisableSelf": "Anda tidak boleh melumpuhkan akaun sendiri",
  "invitedRow": "Jemputan belum diterima",
  "addRole": "Tambah peranan",
  "roleNameLabel": "Nama peranan",
  "roleNamePlaceholder": "cth. Ketua Gudang",
  "roleNameRequired": "Nama peranan diperlukan",
  "roleCreated": "Peranan \"{name}\" dicipta",
  "roleCreateError": "Peranan tidak dapat dicipta",
  "permMatrixTitle": "Akses modul → kebenaran mengikut peranan. Klik sel untuk togol dibenarkan / tidak dibenarkan.",
  "permAllowed": "Dibenarkan",
  "permDenied": "Tidak dibenarkan",
  "superadminNote": "Superadmin sentiasa mempunyai akses penuh dan tidak boleh diubah.",
  "permUpdated": "Kebenaran dikemas kini",
  "permUpdateError": "Kebenaran tidak dapat dikemas kini",
  "grpDashboard": "Papan Pemuka",
  "grpInventory": "Inventori",
  "grpSales": "Jualan",
  "grpFinance": "Kewangan",
  "grpPurchasing": "Perolehan",
  "grpCrm": "CRM",
  "grpManufacturing": "Pembuatan",
  "grpQuality": "Kualiti",
  "grpAsset": "Aset Tetap",
  "grpAdmin": "Pentadbiran",
  "grpSession": "Sesi",
  "auditFilterAllUsers": "Semua pengguna",
  "auditFilterAllEntities": "Semua jenis rekod",
  "auditColTime": "Masa",
  "auditColUser": "Pengguna",
  "auditColAction": "Tindakan",
  "auditColRecord": "Rekod",
  "auditTitle": "Jejak Audit",
  "auditMeta": "{count} peristiwa · log sistem tidak boleh diubah{truncated}",
  "auditTruncated": " · memaparkan 100 terkini",
  "auditNoEvents": "Belum ada aktiviti direkodkan — tindakan anda akan dilog di sini secara masa nyata.",
  "auditSystem": "Sistem"
},
    zh:{
  "fieldEmail": "邮箱",
  "emailPlaceholder": "姓名@company.com",
  "fieldRole": "角色",
  "emailRequired": "请输入有效的邮箱地址",
  "roleRequired": "请选择角色",
  "inviteSent": "邀请已发送至 {email}",
  "inviteError": "邀请发送失败",
  "enable": "启用",
  "disable": "停用",
  "you": "您",
  "manageRoles": "管理角色",
  "saveRoles": "保存角色",
  "rolesUpdated": "角色已更新",
  "rolesUpdateError": "无法更新角色",
  "managedRole": "由员工汇报关系自动管理",
  "toggleEnabled": "{email} 已启用",
  "toggleDisabled": "{email} 已停用",
  "toggleError": "无法更新该用户",
  "cannotDisableSelf": "无法停用自己的账户",
  "invitedRow": "邀请待接受",
  "addRole": "新增角色",
  "roleNameLabel": "角色名称",
  "roleNamePlaceholder": "例如:仓库主管",
  "roleNameRequired": "请填写角色名称",
  "roleCreated": "角色「{name}」已创建",
  "roleCreateError": "角色创建失败",
  "permMatrixTitle": "各角色的模块权限。点击单元格切换允许 / 不允许。",
  "permAllowed": "允许",
  "permDenied": "不允许",
  "superadminNote": "超级管理员始终拥有完全权限,不可编辑。",
  "permUpdated": "权限已更新",
  "permUpdateError": "权限更新失败",
  "grpDashboard": "仪表盘",
  "grpInventory": "库存",
  "grpSales": "销售",
  "grpFinance": "财务",
  "grpPurchasing": "采购",
  "grpCrm": "客户关系",
  "grpManufacturing": "生产",
  "grpQuality": "质量",
  "grpAsset": "固定资产",
  "grpAdmin": "管理",
  "grpSession": "会话",
  "auditFilterAllUsers": "所有用户",
  "auditFilterAllEntities": "所有记录类型",
  "auditColTime": "时间",
  "auditColUser": "用户",
  "auditColAction": "操作",
  "auditColRecord": "记录",
  "auditTitle": "审计日志",
  "auditMeta": "{count} 条事件 · 不可篡改的系统日志{truncated}",
  "auditTruncated": " · 显示最近 100 条",
  "auditNoEvents": "暂无活动记录 — 您执行的操作会实时记录在此处。",
  "auditSystem": "系统"
},
    ja:{
  "fieldEmail": "メール",
  "emailPlaceholder": "名前@company.com",
  "fieldRole": "役割",
  "emailRequired": "有効なメールアドレスを入力してください",
  "roleRequired": "役割を選択してください",
  "inviteSent": "{email} に招待を送信しました",
  "inviteError": "招待を送信できませんでした",
  "enable": "有効化",
  "disable": "無効化",
  "you": "あなた",
  "manageRoles": "役割を管理",
  "saveRoles": "役割を保存",
  "rolesUpdated": "役割を更新しました",
  "rolesUpdateError": "役割を更新できませんでした",
  "managedRole": "従業員の直属関係から自動的に管理されます",
  "toggleEnabled": "{email} を有効化しました",
  "toggleDisabled": "{email} を無効化しました",
  "toggleError": "このユーザーを更新できませんでした",
  "cannotDisableSelf": "自分自身のアカウントは無効化できません",
  "invitedRow": "招待は保留中です",
  "addRole": "役割を追加",
  "roleNameLabel": "役割名",
  "roleNamePlaceholder": "例:倉庫リーダー",
  "roleNameRequired": "役割名を入力してください",
  "roleCreated": "役割「{name}」を作成しました",
  "roleCreateError": "役割を作成できませんでした",
  "permMatrixTitle": "役割ごとのモジュール権限。セルをクリックして許可/不許可を切り替えます。",
  "permAllowed": "許可",
  "permDenied": "不許可",
  "superadminNote": "スーパー管理者は常にフルアクセス権を持ち、編集できません。",
  "permUpdated": "権限を更新しました",
  "permUpdateError": "権限を更新できませんでした",
  "grpDashboard": "ダッシュボード",
  "grpInventory": "在庫",
  "grpSales": "販売",
  "grpFinance": "財務",
  "grpPurchasing": "購買",
  "grpCrm": "CRM",
  "grpManufacturing": "製造",
  "grpQuality": "品質",
  "grpAsset": "固定資産",
  "grpAdmin": "管理",
  "grpSession": "セッション",
  "auditFilterAllUsers": "すべてのユーザー",
  "auditFilterAllEntities": "すべての記録種別",
  "auditColTime": "日時",
  "auditColUser": "ユーザー",
  "auditColAction": "操作",
  "auditColRecord": "記録",
  "auditTitle": "監査証跡",
  "auditMeta": "{count} 件のイベント · 改ざん不可のシステムログ{truncated}",
  "auditTruncated": " · 最新100件を表示",
  "auditNoEvents": "まだ活動記録がありません — 実行した操作はここにリアルタイムで記録されます。",
  "auditSystem": "システム"
},
    vi:{
  "fieldEmail": "E-mail",
  "emailPlaceholder": "ten@congty.com",
  "fieldRole": "Vai trò",
  "emailRequired": "Vui lòng nhập địa chỉ email hợp lệ",
  "roleRequired": "Vui lòng chọn vai trò",
  "inviteSent": "Đã gửi lời mời đến {email}",
  "inviteError": "Không thể gửi lời mời",
  "enable": "Kích hoạt",
  "disable": "Vô hiệu hóa",
  "you": "bạn",
  "manageRoles": "Quản lý vai trò",
  "saveRoles": "Lưu vai trò",
  "rolesUpdated": "Đã cập nhật vai trò",
  "rolesUpdateError": "Không thể cập nhật vai trò",
  "managedRole": "Được tự động quản lý từ tuyến báo cáo của nhân viên",
  "toggleEnabled": "Đã kích hoạt {email}",
  "toggleDisabled": "Đã vô hiệu hóa {email}",
  "toggleError": "Không thể cập nhật người dùng này",
  "cannotDisableSelf": "Bạn không thể vô hiệu hóa tài khoản của chính mình",
  "invitedRow": "Lời mời đang chờ",
  "addRole": "Thêm vai trò",
  "roleNameLabel": "Tên vai trò",
  "roleNamePlaceholder": "vd: Trưởng kho",
  "roleNameRequired": "Vui lòng nhập tên vai trò",
  "roleCreated": "Đã tạo vai trò \"{name}\"",
  "roleCreateError": "Không thể tạo vai trò",
  "permMatrixTitle": "Quyền truy cập theo mô-đun cho từng vai trò. Nhấp vào ô để chuyển đổi cho phép / không cho phép.",
  "permAllowed": "Cho phép",
  "permDenied": "Không cho phép",
  "superadminNote": "Superadmin luôn có toàn quyền truy cập và không thể chỉnh sửa.",
  "permUpdated": "Đã cập nhật quyền",
  "permUpdateError": "Không thể cập nhật quyền",
  "grpDashboard": "Bảng điều khiển",
  "grpInventory": "Tồn kho",
  "grpSales": "Bán hàng",
  "grpFinance": "Tài chính",
  "grpPurchasing": "Mua hàng",
  "grpCrm": "CRM",
  "grpManufacturing": "Sản xuất",
  "grpQuality": "Chất lượng",
  "grpAsset": "Tài sản cố định",
  "grpAdmin": "Quản trị",
  "grpSession": "Phiên đăng nhập",
  "auditFilterAllUsers": "Tất cả người dùng",
  "auditFilterAllEntities": "Tất cả loại bản ghi",
  "auditColTime": "Thời gian",
  "auditColUser": "Người dùng",
  "auditColAction": "Hành động",
  "auditColRecord": "Bản ghi",
  "auditTitle": "Nhật ký kiểm toán",
  "auditMeta": "{count} sự kiện · nhật ký hệ thống không thể sửa đổi{truncated}",
  "auditTruncated": " · hiển thị 100 gần nhất",
  "auditNoEvents": "Chưa có hoạt động nào được ghi nhận — các hành động của bạn sẽ được ghi lại tại đây theo thời gian thực.",
  "auditSystem": "Hệ thống"
},
  };
  const pack=i18nLegacy(packs);
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
  const [usersResult,rolesResult]=await Promise.all([
    listPage('admin/users'),
    listPage('admin/roles'),
  ]);
  const usersPage=usersResult.data;
  const availableRoles=(rolesResult.data||[]).filter(role=>!role.isSuperadmin);
  const rows=[...usersPage.users, ...usersPage.invitations];
  const roleNames=[...new Set(usersPage.users.flatMap(u=>
    Array.isArray(u.roles)&&u.roles.length?u.roles.map(role=>role.roleName):[u.roleName]).filter(Boolean))];
  const chips=[['all',t('common.all')]].concat(roleNames.map(r=>[r,r]));
  async function render(){
    const active=usersPage.users.filter(u=>u.status==='Active').length;
    const invited=usersPage.invitations.length;
    transactionListPage(root,{
      module:'admin',route:'user-mgmt',title:t('usr.title'),
      rows,rowId:u=>u.kind+'-'+u.id,
      filters:chips,filterFn:(user,role)=>Array.isArray(user.roles)
        ? user.roles.some(grant=>grant.roleName===role)
        : user.roleName===role,
      kpis:[
        {label:t('usr.t.total'),value:usersPage.users.length},
        {label:t('usr.t.active'),value:active},
        {label:t('usr.t.invites'),value:invited,negative:invited>0},
      ],
      primaryAction:{label:t('usr.invite'),icon:'plus',onClick:openInviteModal},
      toolbarActions:[
        {label:t('pal.newEmployee'),icon:'people',onClick:()=>navigate('new-employee')},
        {label:t('usr.roles'),icon:'shield',onClick:()=>navigate('role-permission')},
        {label:t('usr.audit'),icon:'history',onClick:()=>navigate('audit-log')},
      ],
      columns:[
        {label:t('usr.col.user'),render:u=>`<div style="display:flex;align-items:center;gap:11px">${profileAvatar({name:u.fullName||u.email||u.username,src:u.avatarUrl||u.imageUrl||u.photoUrl,size:30})}<div class="cellsub"><b>${esc(u.fullName||u.email||u.username)}</b><small>${esc((u.username?'@'+u.username:'')+(u.email?' · '+u.email:''))}</small></div></div>`},
        {label:t('hr.col.role'),align:'l',render:u=>esc(u.roleName)},
        {label:t('usr.col.lastactive'),align:'l',render:u=>u.lastActiveAt?esc(dateTimeValue(u.lastActiveAt)):'—'},
        {label:t('col.status'),align:'l',render:u=>cap(ts(u.status),userStatusTone(u.status))},
        {label:'',align:'c',render:u=>u.kind==='user'
          ?`<span class="rowact"><button aria-label="${esc(s('manageRoles'))}: ${esc(u.fullName||u.email||u.username)}" data-tip="${esc(s('manageRoles'))}" data-act="roles" data-id="${u.id}">${ic('shield')}</button>${u.email!==(DB.user&&DB.user.email)
            ?`<button aria-label="${esc(u.status==='Active'?s('disable'):s('enable'))}: ${esc(u.fullName||u.email||u.username)}" data-tip="${esc(u.status==='Active'?s('disable'):s('enable'))}" data-act="toggle" data-id="${u.id}" data-active="${u.status==='Active'}">${ic(u.status==='Active'?'x':'check')}</button>`
            :`<button aria-label="${esc(s('you'))}: ${esc(u.fullName||u.email||u.username)}" data-tip="${esc(s('you'))}" disabled>${ic('user')}</button>`}</span>`
          :''},
      ],
      rowAction:null,
      empty:{icon:'people',title:'No users'},
      afterRender:({root:pageRoot})=>{
        pageRoot.querySelectorAll('[data-act="toggle"]').forEach(b=>b.addEventListener('click',async e=>{
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
        pageRoot.querySelectorAll('[data-act="roles"]').forEach(b=>b.addEventListener('click',async e=>{
          e.stopPropagation();
          const user=usersPage.users.find(row=>row.id===Number(b.dataset.id));
          if(user) await openUserRolesModal(user);
        }));
      },
    });
  }
  async function openUserRolesModal(user){
    const roles=(await listPage('admin/roles')).data;
    const selected=new Set((user.roles||[]).map(grant=>Number(grant.roleId)));
    const managed=new Set((user.roles||[])
      .filter(grant=>grant.managedBySystem)
      .map(grant=>Number(grant.roleId)));
    appModal({
      icon:'shield',
      title:s('manageRoles'),
      body:`<div class="panel-body" style="display:grid;gap:10px">${roles.map(role=>{
        const roleId=Number(role.roleId);
        const isManaged=managed.has(roleId);
        return `<label style="display:flex;align-items:center;gap:9px"><input type="checkbox" data-role-id="${role.roleId}" ${selected.has(roleId)?'checked':''} ${isManaged?'disabled':''}> <span>${esc(role.name)}</span>${isManaged?`<small class="muted" title="${esc(s('managedRole'))}">${ic('link')} ${esc(s('managedRole'))}</small>`:''}</label>`;
      }).join('')}</div>`,
      actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('saveRoles'),{icon:'check',cls:'primary',attrs:'data-save="1"'})}`,
    });
    const saveBtn=$('#modalEl').querySelector('[data-save]');
    saveBtn.addEventListener('click',async()=>{
      const roleIds=[...$('#modalEl').querySelectorAll('[data-role-id]:checked')].map(input=>Number(input.dataset.roleId));
      if(!roleIds.length){ toast(s('roleRequired'),'danger'); return; }
      saveBtn.disabled=true;
      try{
        await window.ErpSystemData.action('admin/users',user.id,'set-roles',{roleIds});
        closeModal();
        toast(s('rolesUpdated'),'ok');
        const refreshed=(await listPage('admin/users')).data;
        usersPage.users=refreshed.users; usersPage.invitations=refreshed.invitations;
        rows.length=0; rows.push(...usersPage.users,...usersPage.invitations);
        await render();
      }catch(error){
        saveBtn.disabled=false;
        toast(error&&error.message?error.message:s('rolesUpdateError'),'danger');
      }
    });
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
    return availableRoles.map(role=>`<option value="${role.roleId}">${esc(role.name)}</option>`).join('');
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
        <div class="dt-c l mono" style="color:var(--muted);font-size:12px">${esc(dateTimeValue(e.occurredAt))}</div>
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

/* ---------------- COMPANY ONBOARDING (tenant setup; no module authority) ---------------- */
SCREENS['company-onboarding'] = async function(root){
  if(!userHasAnyPermission('admin.roles.write')){
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,'Admin',t('onboard.title')])}
        <div class="h1row"><h1>${esc(t('onboard.title'))}</h1>${cap('Permission required','warn')}</div>
      </div>
      ${statePanel({icon:'lock',title:t('access.routeDenied'),body:t('access.routeBody',{company:DB.company.name})})}
    </section></div>`;
    return;
  }

  let onboarding=null;
  try{ onboarding=window.ErpSystemData.onboardingStatus?(await window.ErpSystemData.onboardingStatus()).data:null; }catch{}
  function captureScroll(){
    const surface=root.querySelector('.scrollarea');
    return surface?{top:surface.scrollTop,left:surface.scrollLeft}:null;
  }
  function restoreScroll(state){
    if(!state) return;
    const apply=()=>{
      const surface=root.querySelector('.scrollarea');
      if(!surface) return;
      surface.scrollTop=state.top;
      surface.scrollLeft=state.left;
    };
    apply();
    requestAnimationFrame(()=>{
      apply();
      requestAnimationFrame(apply);
    });
    setTimeout(apply,0);
    setTimeout(apply,50);
  }
  function render(preserveScroll=captureScroll()){
    const onboardingStatus=onboarding&&(onboarding.status||'setup');
    const onboardingStage=onboarding&&(onboarding.currentStage||onboarding.current_stage||'company');
    const onboardingVersion=onboarding&&Number(onboarding.version||1);
    const stages=['company','fiscal','warehouse','roles','staff','import','opening_balance','uat'];
    const completed=onboarding&&(onboarding.completedSteps||onboarding.completed_steps)||[];
    const onboardingPanel=onboarding?`<div class="panel" style="margin:0 24px 24px">
      <div class="panel-h"><h3>${esc(t('onboard.title'))}</h3>${cap(t('onboard.status.'+onboardingStatus),onboardingStatus==='live'?'ok':'warn')}</div>
      <div class="panel-body"><div class="stepper">${stages.map((name,index)=>`<div class="step ${completed.includes(name)?'done':onboardingStage===name?'active':''}"><span>${index+1}</span><b>${esc(t('onboard.stage.'+name))}</b></div>`).join('')}</div>
      ${onboardingStatus==='live'?`<div class="callout info">${esc(t('onboard.liveHint'))}</div>`:`<div class="callout warn">${esc(t('onboard.setupHint'))}</div>
      ${['import','opening_balance'].includes(onboardingStage)?`<div class="fldrow c3" style="margin-top:12px"><div class="fld"><span>${esc(t('onboard.importTarget'))}</span><select id="obTarget">${['employee','customer','supplier','product','account','warehouse','inventory','ar','ap','gl'].map(item=>`<option value="${item}">${esc(t('onboard.target.'+item))}</option>`).join('')}</select></div><div class="fld"><span>${esc(t('onboard.file'))}</span><input id="obFile" type="file" accept=".csv,.xlsx"></div><div class="fld"><span>${esc(t('onboard.atomicImport'))}</span>${btn(t('onboard.preflightCommit'),{icon:'upload',cls:'soft',attrs:'data-onboarding="import"'})}</div></div>`:''}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">${onboardingStage==='live'?btn(t('onboard.goLive'),{icon:'check',cls:'primary',attrs:'data-onboarding="go-live"'}):btn(t('onboard.completeStage'),{icon:'check',cls:'primary',attrs:'data-onboarding="complete"'})}</div>`}</div>
    </div>`:'';
    root.innerHTML=`<div class="content full"><section class="master"><div class="scrollarea">
      <div class="pagehead">
        ${crumbs([DB.company.name,'Admin',t('onboard.title')])}
        <div class="h1row"><h1>${esc(t('onboard.title'))}</h1><span class="acct-role" style="font-size:11px">${ic('shield')}${esc(DB.user.role)}</span></div>
        <div class="h1sub">${esc(t('onboard.setupHint'))}</div>
      </div>
      ${onboardingPanel}
    </div></section></div>`;
    restoreScroll(preserveScroll);

    root.querySelector('[data-onboarding="complete"]')?.addEventListener('click',async()=>{
      try{ onboarding=(await window.ErpSystemData.completeOnboardingStage(onboardingStage,onboardingVersion)).data; toast(t('onboard.stageDone'),'ok'); render(); }
      catch(error){ toast(error&&error.message?error.message:t('onboard.stageFailed'),'danger'); }
    });
    root.querySelector('[data-onboarding="import"]')?.addEventListener('click',async()=>{
      const file=$('#obFile').files[0]; if(!file){ toast(t('onboard.chooseFile'),'danger'); return; }
      try{ const checked=await window.ErpSystemData.preflightOnboardingImport(file,$('#obTarget').value); const job=checked.data; if(job.errorRows){ toast(t('onboard.rowsError',{count:job.errorRows}),'danger'); return; } await window.ErpSystemData.commitOnboardingImport(job.id,job.version,job.warningRows>0); toast(t('onboard.rowsImported',{count:job.totalRows}),'ok'); }
      catch(error){ toast(error&&error.message?error.message:t('onboard.importFailed'),'danger'); }
    });
    root.querySelector('[data-onboarding="go-live"]')?.addEventListener('click',async()=>{
      try{ onboarding=(await window.ErpSystemData.goLiveCompany(onboardingVersion)).data; toast(t('onboard.companyLive'),'ok'); render(); }
      catch(error){ toast(error&&error.message?error.message:t('onboard.goLiveFailed'),'danger'); }
    });
  }
  render();
};
