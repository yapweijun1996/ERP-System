/* ============================================================
   ARIA ERP — screens: HR (Employee Directory, Employee Profile)
   Payroll Run and Payslip remain sample data — see docs/EPICS.md
   EPIC-020 for the deliberate scope boundary (no payroll schema).
   ============================================================ */

const HR_AVATAR_COLORS=['#0a84ff','#1f9d57','#FF9500','#ff375f','#bf5af2','#0B6E7C','#9A6712','#3457D5'];
function hrInitials(name){
  const parts=(name||'').trim().split(/\s+/);
  return ((parts[0]||'')[0]||'')+((parts[1]||'')[0]||'');
}
function hrAvatarColor(name){
  const n=name||'x'; let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))>>>0;
  return HR_AVATAR_COLORS[h%HR_AVATAR_COLORS.length];
}
function hrCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{
      statusActive:'Active',statusOnLeave:'On leave',statusInactive:'Inactive',
      typeParttime:'Part-time',typeIntern:'Intern',
      personalContact:'Personal & contact',fieldEmail:'Email',fieldPhone:'Phone',noPhone:'Not on file',
      fieldDept:'Department',fieldEmployment:'Employment',fieldJoined:'Joined',fieldManager:'Reports to',
      noManager:'— (top of reporting line)',
      leaveBalanceTitle:'Leave balance',annualLeaveLabel:'Annual leave',
      annualLeaveUsed:'{used} of {total} days used this year',
      recentLeaveTitle:'Leave requests',noLeaveRequests:'No leave requests yet.',
      backToDirectory:'Back to directory',reviewLeave:'Review leave',
      newEmployeeTitle:'Add employee',fieldFullName:'Full name',fullNamePlaceholder:'e.g. Nadia Hassan',
      emailPlaceholder:'name@company.com',phonePlaceholder:'+60 12-345 6789',
      fieldJobTitle:'Job title',jobTitlePlaceholder:'e.g. Account Executive',
      fieldEmploymentType:'Employment type',fieldStartDate:'Start date',fieldAnnualDays:'Annual leave (days)',
      noManagerOption:'No manager',
      fullNameRequired:'Full name is required',emailRequired:'Enter a valid email address',
      deptRequired:'Department is required',jobTitleRequired:'Job title is required',
      createEmployee:'Add employee',employeeCreated:'{name} added to the directory',
      createError:'Employee could not be created',
      leaveApprovalTitle:'Leave Approval',colDates:'Dates',
      filterAllStatus:'All',statusPending:'Pending',statusApproved:'Approved',statusRejected:'Rejected',
      approve:'Approve',reject:'Reject',cancel:'Cancel',rejectTitle:'Reject leave — {name}',
      rejectReasonLabel:'Reason',rejectReasonPlaceholder:'Shared with the employee.',
      rejectReasonRequired:'A reason is required to reject.',
      approvedToast:'{name}’s leave approved',rejectedToast:'{name}’s leave rejected',
      actionError:'Could not update this leave request',
    },
    ms:{
      statusActive:'Aktif',statusOnLeave:'Bercuti',statusInactive:'Tidak aktif',
      typeParttime:'Sambilan',typeIntern:'Intern',
      personalContact:'Peribadi & hubungan',fieldEmail:'E-mel',fieldPhone:'Telefon',noPhone:'Tiada rekod',
      fieldDept:'Jabatan',fieldEmployment:'Pekerjaan',fieldJoined:'Tarikh sertai',fieldManager:'Melapor kepada',
      noManager:'— (paling atas dalam struktur)',
      leaveBalanceTitle:'Baki cuti',annualLeaveLabel:'Cuti tahunan',
      annualLeaveUsed:'{used} daripada {total} hari digunakan tahun ini',
      recentLeaveTitle:'Permohonan cuti',noLeaveRequests:'Belum ada permohonan cuti.',
      backToDirectory:'Kembali ke direktori',reviewLeave:'Semak cuti',
      newEmployeeTitle:'Tambah pekerja',fieldFullName:'Nama penuh',fullNamePlaceholder:'cth. Nadia Hassan',
      emailPlaceholder:'nama@syarikat.com',phonePlaceholder:'+60 12-345 6789',
      fieldJobTitle:'Jawatan',jobTitlePlaceholder:'cth. Eksekutif Akaun',
      fieldEmploymentType:'Jenis pekerjaan',fieldStartDate:'Tarikh mula',fieldAnnualDays:'Cuti tahunan (hari)',
      noManagerOption:'Tiada penyelia',
      fullNameRequired:'Nama penuh diperlukan',emailRequired:'Masukkan alamat e-mel yang sah',
      deptRequired:'Jabatan diperlukan',jobTitleRequired:'Jawatan diperlukan',
      createEmployee:'Tambah pekerja',employeeCreated:'{name} ditambah ke direktori',
      createError:'Pekerja tidak dapat ditambah',
      leaveApprovalTitle:'Kelulusan Cuti',colDates:'Tarikh',
      filterAllStatus:'Semua',statusPending:'Belum diputuskan',statusApproved:'Diluluskan',statusRejected:'Ditolak',
      approve:'Luluskan',reject:'Tolak',cancel:'Batal',rejectTitle:'Tolak cuti — {name}',
      rejectReasonLabel:'Sebab',rejectReasonPlaceholder:'Dikongsi dengan pekerja.',
      rejectReasonRequired:'Sebab diperlukan untuk menolak.',
      approvedToast:'Cuti {name} diluluskan',rejectedToast:'Cuti {name} ditolak',
      actionError:'Permohonan cuti ini tidak dapat dikemas kini',
    },
    zh:{
      statusActive:'在职',statusOnLeave:'休假中',statusInactive:'已离职',
      typeParttime:'兼职',typeIntern:'实习',
      personalContact:'个人与联系方式',fieldEmail:'邮箱',fieldPhone:'电话',noPhone:'未登记',
      fieldDept:'部门',fieldEmployment:'雇佣类型',fieldJoined:'入职日期',fieldManager:'汇报对象',
      noManager:'—(汇报链顶端)',
      leaveBalanceTitle:'假期余额',annualLeaveLabel:'年假',
      annualLeaveUsed:'今年已使用 {used}/{total} 天',
      recentLeaveTitle:'请假记录',noLeaveRequests:'暂无请假记录。',
      backToDirectory:'返回通讯录',reviewLeave:'审批请假',
      newEmployeeTitle:'新增员工',fieldFullName:'姓名',fullNamePlaceholder:'例如:Nadia Hassan',
      emailPlaceholder:'name@company.com',phonePlaceholder:'+60 12-345 6789',
      fieldJobTitle:'职位',jobTitlePlaceholder:'例如:客户经理',
      fieldEmploymentType:'雇佣类型',fieldStartDate:'入职日期',fieldAnnualDays:'年假天数',
      noManagerOption:'无上级',
      fullNameRequired:'请填写姓名',emailRequired:'请输入有效的邮箱地址',
      deptRequired:'请填写部门',jobTitleRequired:'请填写职位',
      createEmployee:'新增员工',employeeCreated:'{name} 已加入通讯录',
      createError:'员工创建失败',
      leaveApprovalTitle:'请假审批',colDates:'日期',
      filterAllStatus:'全部',statusPending:'待审批',statusApproved:'已批准',statusRejected:'已拒绝',
      approve:'批准',reject:'拒绝',cancel:'取消',rejectTitle:'拒绝请假 — {name}',
      rejectReasonLabel:'原因',rejectReasonPlaceholder:'将告知员工。',
      rejectReasonRequired:'拒绝时必须填写原因。',
      approvedToast:'已批准 {name} 的请假',rejectedToast:'已拒绝 {name} 的请假',
      actionError:'无法更新此请假申请',
    },
    ja:{
      statusActive:'在籍',statusOnLeave:'休暇中',statusInactive:'退職',
      typeParttime:'パートタイム',typeIntern:'インターン',
      personalContact:'個人情報・連絡先',fieldEmail:'メール',fieldPhone:'電話',noPhone:'未登録',
      fieldDept:'部署',fieldEmployment:'雇用形態',fieldJoined:'入社日',fieldManager:'上長',
      noManager:'—(組織の最上位)',
      leaveBalanceTitle:'休暇残日数',annualLeaveLabel:'年次有給休暇',
      annualLeaveUsed:'今年 {total} 日中 {used} 日使用済み',
      recentLeaveTitle:'休暇申請',noLeaveRequests:'休暇申請はまだありません。',
      backToDirectory:'ディレクトリに戻る',reviewLeave:'休暇を確認',
      newEmployeeTitle:'従業員を追加',fieldFullName:'氏名',fullNamePlaceholder:'例:Nadia Hassan',
      emailPlaceholder:'name@company.com',phonePlaceholder:'+60 12-345 6789',
      fieldJobTitle:'役職',jobTitlePlaceholder:'例:営業担当',
      fieldEmploymentType:'雇用形態',fieldStartDate:'入社日',fieldAnnualDays:'年次有給休暇(日数)',
      noManagerOption:'上長なし',
      fullNameRequired:'氏名を入力してください',emailRequired:'有効なメールアドレスを入力してください',
      deptRequired:'部署を入力してください',jobTitleRequired:'役職を入力してください',
      createEmployee:'従業員を追加',employeeCreated:'{name} をディレクトリに追加しました',
      createError:'従業員を作成できませんでした',
      leaveApprovalTitle:'休暇承認',colDates:'日付',
      filterAllStatus:'すべて',statusPending:'承認待ち',statusApproved:'承認済み',statusRejected:'却下',
      approve:'承認',reject:'却下',cancel:'キャンセル',rejectTitle:'休暇を却下 — {name}',
      rejectReasonLabel:'理由',rejectReasonPlaceholder:'従業員に共有されます。',
      rejectReasonRequired:'却下するには理由が必要です。',
      approvedToast:'{name} の休暇を承認しました',rejectedToast:'{name} の休暇を却下しました',
      actionError:'この休暇申請を更新できませんでした',
    },
    vi:{
      statusActive:'Đang làm việc',statusOnLeave:'Đang nghỉ phép',statusInactive:'Đã nghỉ việc',
      typeParttime:'Bán thời gian',typeIntern:'Thực tập',
      personalContact:'Thông tin cá nhân & liên hệ',fieldEmail:'Email',fieldPhone:'Điện thoại',noPhone:'Chưa có',
      fieldDept:'Phòng ban',fieldEmployment:'Loại hình làm việc',fieldJoined:'Ngày vào làm',fieldManager:'Báo cáo cho',
      noManager:'— (cấp cao nhất)',
      leaveBalanceTitle:'Số ngày phép còn lại',annualLeaveLabel:'Phép năm',
      annualLeaveUsed:'Đã dùng {used}/{total} ngày trong năm nay',
      recentLeaveTitle:'Đơn xin nghỉ phép',noLeaveRequests:'Chưa có đơn xin nghỉ phép nào.',
      backToDirectory:'Quay lại danh bạ',reviewLeave:'Xem xét nghỉ phép',
      newEmployeeTitle:'Thêm nhân viên',fieldFullName:'Họ tên',fullNamePlaceholder:'vd: Nadia Hassan',
      emailPlaceholder:'ten@congty.com',phonePlaceholder:'+60 12-345 6789',
      fieldJobTitle:'Chức danh',jobTitlePlaceholder:'vd: Chuyên viên kinh doanh',
      fieldEmploymentType:'Loại hình làm việc',fieldStartDate:'Ngày bắt đầu',fieldAnnualDays:'Phép năm (ngày)',
      noManagerOption:'Không có quản lý',
      fullNameRequired:'Vui lòng nhập họ tên',emailRequired:'Vui lòng nhập địa chỉ email hợp lệ',
      deptRequired:'Vui lòng nhập phòng ban',jobTitleRequired:'Vui lòng nhập chức danh',
      createEmployee:'Thêm nhân viên',employeeCreated:'Đã thêm {name} vào danh bạ',
      createError:'Không thể tạo nhân viên',
      leaveApprovalTitle:'Phê duyệt nghỉ phép',colDates:'Ngày',
      filterAllStatus:'Tất cả',statusPending:'Chờ duyệt',statusApproved:'Đã duyệt',statusRejected:'Đã từ chối',
      approve:'Duyệt',reject:'Từ chối',cancel:'Hủy',rejectTitle:'Từ chối nghỉ phép — {name}',
      rejectReasonLabel:'Lý do',rejectReasonPlaceholder:'Sẽ được chia sẻ với nhân viên.',
      rejectReasonRequired:'Cần nhập lý do để từ chối.',
      approvedToast:'Đã duyệt đơn nghỉ phép của {name}',rejectedToast:'Đã từ chối đơn nghỉ phép của {name}',
      actionError:'Không thể cập nhật đơn nghỉ phép này',
    },
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

/* ---- shared data prep (directory, profile and leave-approval all need employees +
   leave requests; one fetch point avoids three near-identical Promise.all blocks) ---- */
async function prepareHrData(){
  const pages=await Promise.all([
    listPage('hr/employees'),
    listPage('hr/leave-requests'),
  ]);
  const [employees,leaveRequests]=pages.map(p=>p.data);
  return {employees,leaveRequests};
}
function hrToday(){ return new Date().toISOString().slice(0,10); }
function hrIsOnLeaveToday(employeeId,leaveRequests){
  const today=hrToday();
  return leaveRequests.some(lv=>lv.employeeId===employeeId&&lv.status==='approved'&&lv.startDate<=today&&lv.endDate>=today);
}
function hrAnnualLeaveUsed(employeeId,leaveRequests){
  return leaveRequests.filter(lv=>lv.employeeId===employeeId&&lv.status==='approved'&&lv.leaveType==='Annual')
    .reduce((sum,lv)=>sum+lv.days,0);
}
function hrEmploymentTypeLabel(s,type){
  return {'Full-time':t('hr.emp.fulltime'),'Contract':t('hr.emp.contract'),'Part-time':s('typeParttime'),'Intern':s('typeIntern')}[type]||type;
}
function hrStatusOf(emp,leaveRequests){
  if(!emp.isActive) return 'inactive';
  if(hrIsOnLeaveToday(emp.id,leaveRequests)) return 'onleave';
  return 'active';
}
function hrStatusLabel(s,status){
  return {active:s('statusActive'),onleave:s('statusOnLeave'),inactive:s('statusInactive')}[status]||status;
}
function hrStatusTone(status){ return {active:'ok',onleave:'info',inactive:'neutral'}[status]||'neutral'; }

/* ---------------- EMPLOYEE DIRECTORY (listing — module landing) ---------------- */
SCREENS['hr-directory'] = async function(root){
  const s=hrCopy();
  const {employees,leaveRequests}=await prepareHrData();
  let filter='all';
  const depts=[...new Set(employees.map(e=>e.department))];
  const chips=[['all',t('common.all')]].concat(depts.map(d=>[d,d]));
  function rows(){ return filter==='all'?employees:employees.filter(e=>e.department===filter); }
  function table(){
    return buildTable({
      rowId:e=>e.id,
      columns:[
        {label:t('hr.col.employee'),render:e=>`<div style="display:flex;align-items:center;gap:11px"><span class="kc-av" style="background:${hrAvatarColor(e.fullName)};width:30px;height:30px;font-size:11px">${esc(hrInitials(e.fullName))}</span><div class="cellsub"><b>${esc(e.fullName)}</b><small>${esc(e.employeeNo)}</small></div></div>`},
        {label:t('hr.col.dept'),align:'l',render:e=>esc(e.department)},
        {label:t('hr.col.role'),align:'l',render:e=>esc(e.jobTitle)},
        {label:t('qc.col.type'),align:'l',render:e=>e.employmentType==='Contract'?cap(t('hr.emp.contract'),'violet'):cap(hrEmploymentTypeLabel(s,e.employmentType),'neutral')},
        {label:t('hr.col.joined'),align:'l',render:e=>esc(e.startDate)},
        {label:t('col.status'),align:'l',render:e=>{ const st=hrStatusOf(e,leaveRequests); return cap(hrStatusLabel(s,st),hrStatusTone(st)); }},
        {label:'',align:'c',render:e=>`<span class="rowact"><button data-tip="${esc(t('common.open'))}" data-act="open">${ic('ext')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  const onLeave=employees.filter(e=>hrIsOnLeaveToday(e.id,leaveRequests)).length;
  const pending=leaveRequests.filter(l=>l.status==='pending').length;
  function statTile(label,value,sub,tone){
    return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
      <b class="tnum" style="font-size:23px;font-weight:600;letter-spacing:-.02em;color:${tone||'var(--fg)'}">${value}</b>
      <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.hr'),t('hr.crumb')])}
      <div class="h1row"><h1>${esc(t('hr.title'))}</h1><span class="countchip" id="hrCount"></span></div>
    </div>
    <div class="statwrap"><div class="statcards">
      ${statTile(t('hr.t.headcount'),employees.length,t('hr.acrossdepts').replaceAll('{n}',depts.length))}
      ${statTile(t('hr.t.onleave'),onLeave,t('hr.t.onleavesub'),'var(--accent)')}
      ${statTile(t('hr.t.pending'),pending,t('hr.t.pendingsub'),'var(--warn)')}
    </div></div>
    <div class="toolbar">
      <div class="filterchips" id="hrChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${esc(c[0])}">${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('hr.leavetip'))}" onclick="navigate('leave-approval')">${ic('calendar')}${esc(t('hr.leave'))}</button>
      ${btn(t('hr.add'),{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-employee\')"'})}
    </div>
    <div class="tablewrap" id="hrTable">${table()}</div>
  </section></div>`;
  $('#hrCount').textContent=rows().length+' '+t('hr.employees');
  function openEmployee(id){ navigate('employee',{employeeId:Number(id)}); }
  function rewire(){
    wireTable($('#hrTable'),{ onRow:openEmployee });
    $('#hrTable').querySelectorAll('[data-act="open"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openEmployee(b.closest('.dt-r').dataset.row);}));
  }
  rewire();
  $('#hrChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ $('#hrChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f; $('#hrTable').innerHTML=table(); $('#hrCount').textContent=rows().length+' '+t('hr.employees'); rewire(); }));
};

/* ---------------- EMPLOYEE PROFILE (master) ---------------- */
SCREENS['employee'] = async function(root, params){
  const s=hrCopy();
  const {employees,leaveRequests}=await prepareHrData();
  const requestedId=params&&params.employeeId?Number(params.employeeId):null;
  const e=requestedId?employees.find(row=>row.id===requestedId):employees[0];
  if(!e){ root.innerHTML=statePanel({icon:'people',title:'No employee found',body:'No employee exists for the active company yet.'}); return; }
  const manager=e.managerId?employees.find(m=>m.id===e.managerId):null;
  const status=hrStatusOf(e,leaveRequests);
  const used=hrAnnualLeaveUsed(e.id,leaveRequests);
  const total=e.annualLeaveDays;
  const pct=total>0?Math.max(0,Math.min(100,Math.round((total-used)/total*100))):0;
  const myLeave=leaveRequests.filter(lv=>lv.employeeId===e.id).sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate)));
  const leaveStatusTone={pending:'warn',approved:'ok',rejected:'danger'};
  const leaveRows=myLeave.length?myLeave.map(lv=>`<tr>
      <td class="l li-name"><b>${esc(lv.leaveType)}</b><small>${esc(lv.startDate)} → ${esc(lv.endDate)}</small></td>
      <td class="tnum">${lv.days}</td>
      <td class="l">${cap(lv.status,leaveStatusTone[lv.status]||'neutral')}</td>
    </tr>`).join('') : `<tr><td colspan="3" style="color:var(--muted);padding:14px 0">${esc(s('noLeaveRequests'))}</td></tr>`;
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:980px">
    ${crumbs([DB.company.name,t('nav.hr'),{label:t('hr.crumb'),route:'hr-directory'},{cur:e.employeeNo}])}
    <div class="dochead">
      <div class="dh-row1">
        <div style="display:flex;gap:14px;align-items:center"><span class="kc-av" style="background:${hrAvatarColor(e.fullName)};width:48px;height:48px;font-size:17px;border-radius:13px">${esc(hrInitials(e.fullName))}</span>
          <div><div class="dt">${esc(e.fullName)} <span class="dnum">${esc(e.employeeNo)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(e.jobTitle)} · ${esc(e.department)}${manager?' · '+esc(s('fieldManager')).toLowerCase()+' '+esc(manager.fullName):''}</div></div></div>
        <div class="dactions">${cap(hrStatusLabel(s,status),hrStatusTone(status))}</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>${esc(s('fieldDept'))}</small><b>${esc(e.department)}</b></div>
        <div class="dm"><small>${esc(s('fieldEmployment'))}</small><b>${esc(hrEmploymentTypeLabel(s,e.employmentType))}</b></div>
        <div class="dm"><small>${esc(s('fieldJoined'))}</small><b>${esc(e.startDate)}</b></div>
        <div class="dm"><small>${esc(s('fieldManager'))}</small><b>${manager?esc(manager.fullName):esc(s('noManager'))}</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>${esc(s('personalContact'))}</h3></div><div class="panel-body">
          <div class="fldrow c2">
            <div class="fld"><span>${esc(s('fieldEmail'))}</span><input value="${esc(e.email)}" readonly></div>
            <div class="fld"><span>${esc(s('fieldPhone'))}</span><input value="${e.phone?esc(e.phone):esc(s('noPhone'))}" readonly></div>
          </div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('leaveBalanceTitle'))}</h3></div><div class="panel-body" style="padding-top:12px">
          <div class="indicator ok"><div class="ind-top">${ic('calendar')}<span>${esc(s('annualLeaveLabel'))}</span><span class="ind-r">${Math.max(0,total-used)} / ${total} days</span></div><div class="track"><i style="width:${pct}%"></i></div><small>${esc(s('annualLeaveUsed').replace('{used}',used).replace('{total}',total))}</small></div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('recentLeaveTitle'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${myLeave.length}</span></div>
          <table class="lines"><tbody>${leaveRows}</tbody></table>
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('fieldEmployment'))}</div>
          <div class="field"><span class="k">${esc(t('col.status'))}</span><span class="v">${esc(hrStatusLabel(s,status))}</span></div>
          <div class="field"><span class="k">${esc(s('fieldJoined'))}</span><span class="v">${esc(e.startDate)}</span></div>
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div class="grow"></div>
      ${btn(s('backToDirectory'),{icon:'chevL',cls:'soft',attrs:'onclick="navigate(\'hr-directory\')"'})}
      ${btn(s('reviewLeave'),{icon:'check',cls:'primary',sm:false,attrs:'onclick="navigate(\'leave-approval\')"'})}
    </div>
  </div></div></section></div>`;
};

/* ---------------- PAYROLL RUN (report, still sample data — see EPIC-020) ---------------- */
SCREENS['payroll-run'] = function(root){
  const p=DB.payrollRun;
  const gross=p.rows.reduce((s,r)=>s+r.gross,0);
  const epf=p.rows.reduce((s,r)=>s+r.epf,0);
  const tax=p.rows.reduce((s,r)=>s+r.tax,0);
  const net=gross-epf-tax;
  const rowHtml=p.rows.map((r,i)=>`<tr class="payrow" data-emp="${esc(r.name)}">
    <td class="lineno">${i+1}</td>
    <td class="l li-name"><div style="display:flex;align-items:center;gap:10px"><span class="kc-av" style="background:${r.clr};width:26px;height:26px;font-size:10px">${esc(r.av)}</span><div><b>${esc(r.name)}</b><small>${esc(r.dept)}</small></div></div></td>
    <td class="tnum">${money0(r.gross)}</td>
    <td class="tnum" style="color:var(--muted)">${money0(r.epf)}</td>
    <td class="tnum" style="color:var(--muted)">${money0(r.tax)}</td>
    <td class="tnum"><b>${money0(r.gross-r.epf-r.tax)}</b></td></tr>`).join('');
  function statTile(label,value,sub,tone){
    return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
      <b class="tnum" style="font-size:22px;font-weight:600;letter-spacing:-.02em;color:${tone||'var(--fg)'}">${value}</b>
      <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">${crumbs([DB.company.name,'HR','Payroll',{cur:p.period}])}
      <div class="h1row"><h1>Payroll Run</h1><span class="countchip">${cap(p.status,'warn')}</span></div>
    </div>
    <div class="statwrap"><div class="statcards">
      ${statTile('Headcount',p.rows.length,'salaried staff · '+p.period)}
      ${statTile('Gross pay',money0(gross),'before deductions')}
      ${statTile('EPF + tax',money0(epf+tax),'statutory & PCB','var(--warn)')}
      ${statTile('Net pay',money0(net),'pay date '+p.payDate,'var(--ok)')}
    </div></div>
    <div class="toolbar">
      <button class="viewsel" data-tip="Period">${ic('calendar')}${esc(p.period)}${ic('chevD')}</button>
      <div class="grow"></div>
      ${btn('Export bank file',{icon:'download',cls:'soft',attrs:'onclick="toast(\'Bank giro file generated · '+p.rows.length+' credits\',\'ok\')"'})}
      ${btn('Approve & lock run',{icon:'check',cls:'primary',attrs:'data-act="lock"'})}
    </div>
    <div class="docpage" style="max-width:none;margin:0;padding:0 24px 24px;border:none;background:transparent">
      <div class="panel">
        <div class="panel-h"><h3>Employees</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">click a row for the payslip</span></div>
        <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Employee</th><th>Gross</th><th>EPF</th><th>Tax (PCB)</th><th>Net pay</th></tr></thead>
          <tbody>${rowHtml}</tbody>
          <tfoot><tr><td></td><td class="l" style="font-weight:600">Totals · ${p.rows.length} staff</td><td class="tnum"><b>${money0(gross)}</b></td><td class="tnum">${money0(epf)}</td><td class="tnum">${money0(tax)}</td><td class="tnum"><b>${money0(net)}</b></td></tr></tfoot>
        </table>
      </div>
      <div style="height:30px"></div>
    </div>
  </section></div>`;
  root.querySelectorAll('.payrow').forEach(r=>r.style.cursor='pointer');
  root.querySelectorAll('.payrow').forEach(r=>r.addEventListener('click',()=>{ r.dataset.emp==='Marcus Silva'?navigate('payslip'):toast('Payslip · '+r.dataset.emp,'info'); }));
  root.querySelector('[data-act="lock"]').addEventListener('click',()=>{
    appModal({ icon:'lock', title:'Approve & lock June payroll?',
      body:`<p style="color:var(--muted);font-size:13.5px">Locking posts the payroll journal (salary expense, EPF & tax payable) and releases <b>${money0(net)}</b> in net pay across ${p.rows.length} employees on ${esc(p.payDate)}.</p>`,
      actions:`${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Approve & post',{icon:'check',cls:'primary',attrs:'onclick="closeModal();toast(\'June payroll approved & posted to GL\',\'ok\')"'})}` });
  });
};

/* ---------------- PAYSLIP (document, still sample data — see EPIC-020) ---------------- */
SCREENS['payslip'] = function(root){
  const s=DB.payslip1042;
  const earn=s.earnings.reduce((a,x)=>a+x.v,0);
  const ded=s.deductions.reduce((a,x)=>a+x.v,0);
  const net=earn-ded;
  const empCont=s.employer.reduce((a,x)=>a+x.v,0);
  const rows=(arr)=>arr.map(x=>`<tr><td class="l li-name"><b>${esc(x.k)}</b></td><td class="tnum">${money(x.v)}</td></tr>`).join('');
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:920px">
    ${crumbs([DB.company.name,'HR','Payslips',{cur:s.id}])}
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('receipt')}Payslip <span class="dnum">${esc(s.id)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(s.emp)} · ${esc(s.role)} · ${esc(s.period)}</div></div>
        <div class="dactions">${cap('Posted','teal')}${btn('Download PDF',{icon:'filepdf',cls:'soft'})}</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Employee</small><b>${esc(s.emp)} · ${esc(s.empId)}</b></div>
        <div class="dm"><small>Period</small><b>${esc(s.period)}</b></div>
        <div class="dm"><small>Pay date</small><b>${esc(s.payDate)}</b></div>
        <div class="dm"><small>Bank</small><b>${esc(s.bank)}</b></div>
        <div class="dm"><small>Days paid</small><b>${s.days}</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>Earnings</h3></div>
          <table class="lines"><tbody>${rows(s.earnings)}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">Gross earnings</td><td class="tnum"><b>${money(earn)}</b></td></tr></tfoot></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Deductions</h3></div>
          <table class="lines"><tbody>${rows(s.deductions)}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">Total deductions</td><td class="tnum"><b>${money(ded)}</b></td></tr></tfoot></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Employer contributions</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">not deducted from pay</span></div>
          <table class="lines"><tbody>${rows(s.employer)}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">Total employer cost</td><td class="tnum"><b>${money(empCont)}</b></td></tr></tfoot></table>
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Net pay</div>
          <div class="sumrow"><span class="sk2">Gross</span><span class="sv tnum">${money(earn)}</span></div>
          <div class="sumrow disc"><span class="sk2">Deductions</span><span class="sv tnum">−${money(ded)}</span></div>
          <div class="sumrow total"><span class="sk2">Net pay</span><span class="sv tnum">${money(net)}</span></div>
          <div class="indicator ok" style="margin-top:12px"><div class="ind-top">${ic('coins')}<span>Paid to ${esc(s.bank)}</span><span class="ind-r">${money0(net)}</span></div><small>Credited on ${esc(s.payDate)}.</small></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Year to date</div>
          <div class="sumrow"><span class="sk2">Gross YTD</span><span class="sv tnum">${money0(earn*6)}</span></div>
          <div class="sumrow"><span class="sk2">EPF YTD</span><span class="sv tnum">${money0(s.deductions[0].v*6)}</span></div>
          <div class="sumrow"><span class="sk2">Tax YTD</span><span class="sv tnum">${money0(s.deductions[1].v*6)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:s.empId,label:esc(s.emp),meta:'Employee profile',status:'Active'},
            {no:'June 2026',label:'Payroll run',meta:'8 staff',status:'Pending Approval'},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Net pay <b style="color:var(--fg)">${money(net)}</b> · ${esc(s.payDate)}.</div>
      <div class="grow"></div>
      ${btn('Email payslip',{icon:'send',cls:'soft',attrs:'onclick="toast(\'Payslip emailed to '+esc(s.emp)+'\',\'ok\')"'})}
      ${btn('Back to payroll',{icon:'coins',cls:'primary',sm:false,attrs:'onclick="navigate(\'payroll-run\')"'})}
    </div>
  </div></div></section></div>`;
};
