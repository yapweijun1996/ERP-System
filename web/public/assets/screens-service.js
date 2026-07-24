/* ============================================================
   ARIA ERP — screens: Service (tickets, service order, contracts)
   Wired to real service_ticket/service_contract data (EPIC-022). Spare-parts
   consumption and labour costing have no schema and stay out of scope —
   see EPIC-022's notes.
   ============================================================ */

const SERVICE_COVERAGE_LABEL = { in_warranty: 'In warranty', contract: 'Contract', out_of_warranty: 'Out of warranty' };
const SERVICE_TICKET_STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' };
const SERVICE_TICKET_STATUS_TONE = { open: 'warn', in_progress: 'info', closed: 'ok' };

function svcPriorityTone(p){ return {Critical:'danger',High:'warn',Medium:'info',Low:'neutral'}[p]||'neutral'; }
function coverTone(c){ return {'In warranty':'ok','Out of warranty':'neutral','Contract':'violet'}[c]||'neutral'; }
function svcTicketStatusBadge(status){
  return cap(ts(SERVICE_TICKET_STATUS_LABEL[status]||status), SERVICE_TICKET_STATUS_TONE[status]||'neutral');
}

function serviceCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{
      contractExpiring:'Expiring',contractExpired:'Expired',
      serviceOrderTitle:'Service Order',
      serviceOrderDescription:'Review the issue, service context and lifecycle of the selected ticket.',
      serviceContext:'Service context',lifecycleLabel:'Ticket lifecycle',
      fieldOpened:'Opened',fieldResolved:'Resolved',
      noServiceOrder:'No service order found',
      noServiceOrderBody:'No service ticket is available for the current company.',
      kpiOverdue:'Overdue',overdueAlert:'{n} ticket(s) are past their SLA response window.',
      fieldTicketNo:'Ticket no.',systemNumbered:'System-numbered',fieldCustomer:'Customer',
      fieldAssetDescription:'Asset',assetPlaceholder:'e.g. Conveyor Drive Unit',fieldSerialNo:'Serial no. (optional)',
      fieldIssue:'Issue',issuePlaceholder:'e.g. Drive unit overheating, intermittent stop',
      fieldPriority:'Priority',fieldCoverage:'Coverage',fieldContract:'Contract (optional)',noContract:'No contract',
      nameRequired:'Asset is required',issueRequired:'Issue is required',customerRequired:'Customer is required',
      ticketCreated:'Ticket {no} logged',ticketSaveError:'Ticket could not be logged',createTicket:'Log ticket',
      unassigned:'Unassigned',technician:'Technician',fieldTechnician:'Technician name',
      technicianPlaceholder:'e.g. Kwame Mensah',technicianRequired:'Technician name is required',
      assign:'Assign',assignTitle:'Assign technician',ticketAssigned:'{no} assigned to {tech}',
      ticketAssignError:'Ticket could not be assigned',
      resolveClose:'Resolve & close',resolveTitle:'Resolve & close ticket',fieldDiagnosis:'Diagnosis',
      diagnosisPlaceholder:'e.g. Replaced worn bearing set; tested through 3 cycles, running normally.',
      diagnosisRequired:'Diagnosis is required',ticketResolved:'{no} resolved and closed',
      ticketResolveError:'Ticket could not be resolved',
      slaTitle:'SLA',responseDue:'Response due',overdueBy:'Overdue by {t}',timeLeft:'{t} left',
      noSla:'No SLA on this ticket',noSlaSub:'This ticket has no linked contract with a response-time commitment.',
      openedOn:'opened {d}',dueOn:'due {d}',coverageLabel:'Coverage',billable:'Billable',
      billableYes:'Yes',billableNo:'No — under warranty',customer360:'Customer 360',
      contractsPanel:'Related contract',noContractLinked:'No contract linked to this ticket.',
      diagnosisPanel:'Diagnosis',reportedIssue:'Reported issue',technicianDiagnosis:'Technician diagnosis',
      noDiagnosisYet:'No diagnosis recorded yet — resolve the ticket to add one.',
      fieldContractNo:'Contract no.',fieldPlan:'Plan',fieldSlaHours:'SLA response (hours, optional)',
      fieldAssetsCovered:'Assets covered',fieldStartDate:'Start date',fieldExpiryDate:'Expiry date',
      fieldAnnualValue:'Annual value',contractCreated:'Contract {no} registered',
      contractSaveError:'Contract could not be registered',createContract:'Register contract',
      activeContracts:'Active',annualValueKpi:'Annual value',expiringSoon:'{n} renewal(s) due within 60 days.',
      serviceContractTitle:'Service contract',serviceContractDescription:'Review the customer, coverage and renewal facts for the selected contract.',
      noServiceContract:'No service contract found',noServiceContractBody:'Choose a contract from the Contracts register to view its details.',
      commercialTerms:'Commercial terms',contractTerm:'Contract term',renewalContext:'Renewal context',
      renewalDue:'Renewal is due in {n} days.',renewalExpired:'This contract expired {n} days ago.',
      renewalHealthy:'The contract has {n} days remaining.',days:'days',customerUnavailable:'Customer unavailable',
      contractsEmpty:'No service contracts',
    },
    ms:{
      contractExpiring:'Akan tamat',contractExpired:'Tamat tempoh',
      serviceOrderTitle:'Pesanan Servis',
      serviceOrderDescription:'Semak isu, konteks servis dan kitaran hayat tiket yang dipilih.',
      serviceContext:'Konteks servis',lifecycleLabel:'Kitaran hayat tiket',
      fieldOpened:'Dibuka',fieldResolved:'Diselesaikan',
      noServiceOrder:'Pesanan servis tidak ditemui',
      noServiceOrderBody:'Tiada tiket servis tersedia untuk syarikat semasa.',
      kpiOverdue:'Tertunggak',overdueAlert:'{n} tiket telah melepasi tempoh respons SLA.',
      fieldTicketNo:'No. tiket',systemNumbered:'Bernombor sistem',fieldCustomer:'Pelanggan',
      fieldAssetDescription:'Aset',assetPlaceholder:'cth. Unit Pemacu Konveyor',fieldSerialNo:'No. siri (pilihan)',
      fieldIssue:'Isu',issuePlaceholder:'cth. Unit pemacu terlalu panas, terhenti sekejap-sekejap',
      fieldPriority:'Keutamaan',fieldCoverage:'Liputan',fieldContract:'Kontrak (pilihan)',noContract:'Tiada kontrak',
      nameRequired:'Aset diperlukan',issueRequired:'Isu diperlukan',customerRequired:'Pelanggan diperlukan',
      ticketCreated:'Tiket {no} dicatat',ticketSaveError:'Tiket tidak dapat dicatat',createTicket:'Catat tiket',
      unassigned:'Belum ditugaskan',technician:'Juruteknik',fieldTechnician:'Nama juruteknik',
      technicianPlaceholder:'cth. Kwame Mensah',technicianRequired:'Nama juruteknik diperlukan',
      assign:'Tugaskan',assignTitle:'Tugaskan juruteknik',ticketAssigned:'{no} ditugaskan kepada {tech}',
      ticketAssignError:'Tiket tidak dapat ditugaskan',
      resolveClose:'Selesai & tutup',resolveTitle:'Selesaikan & tutup tiket',fieldDiagnosis:'Diagnosis',
      diagnosisPlaceholder:'cth. Set galas haus digantikan; diuji melalui 3 kitaran, berfungsi normal.',
      diagnosisRequired:'Diagnosis diperlukan',ticketResolved:'{no} diselesaikan dan ditutup',
      ticketResolveError:'Tiket tidak dapat diselesaikan',
      slaTitle:'SLA',responseDue:'Respons perlu',overdueBy:'Tertunggak selama {t}',timeLeft:'{t} berbaki',
      noSla:'Tiada SLA pada tiket ini',noSlaSub:'Tiket ini tiada kontrak berkaitan dengan komitmen masa respons.',
      openedOn:'dibuka {d}',dueOn:'perlu {d}',coverageLabel:'Liputan',billable:'Boleh dibil',
      billableYes:'Ya',billableNo:'Tidak — dalam waranti',customer360:'Pelanggan 360',
      contractsPanel:'Kontrak berkaitan',noContractLinked:'Tiada kontrak dikaitkan dengan tiket ini.',
      diagnosisPanel:'Diagnosis',reportedIssue:'Isu dilaporkan',technicianDiagnosis:'Diagnosis juruteknik',
      noDiagnosisYet:'Belum ada diagnosis dicatat — selesaikan tiket untuk menambah satu.',
      fieldContractNo:'No. kontrak',fieldPlan:'Pelan',fieldSlaHours:'Respons SLA (jam, pilihan)',
      fieldAssetsCovered:'Aset dilindungi',fieldStartDate:'Tarikh mula',fieldExpiryDate:'Tarikh tamat',
      fieldAnnualValue:'Nilai tahunan',contractCreated:'Kontrak {no} didaftarkan',
      contractSaveError:'Kontrak tidak dapat didaftarkan',createContract:'Daftar kontrak',
      activeContracts:'Aktif',annualValueKpi:'Nilai tahunan',expiringSoon:'{n} pembaharuan perlu dalam 60 hari.',
      serviceContractTitle:'Kontrak servis',serviceContractDescription:'Semak pelanggan, liputan dan fakta pembaharuan untuk kontrak yang dipilih.',
      noServiceContract:'Kontrak servis tidak ditemui',noServiceContractBody:'Pilih kontrak daripada daftar Kontrak untuk melihat butirannya.',
      commercialTerms:'Terma komersial',contractTerm:'Tempoh kontrak',renewalContext:'Konteks pembaharuan',
      renewalDue:'Pembaharuan perlu dalam {n} hari.',renewalExpired:'Kontrak ini tamat {n} hari lalu.',
      renewalHealthy:'Kontrak mempunyai baki {n} hari.',days:'hari',customerUnavailable:'Pelanggan tidak tersedia',
      contractsEmpty:'Tiada kontrak servis',
    },
    zh:{
      contractExpiring:'即将到期',contractExpired:'已过期',
      serviceOrderTitle:'服务工单',
      serviceOrderDescription:'查看所选工单的问题、服务背景和生命周期。',
      serviceContext:'服务背景',lifecycleLabel:'工单生命周期',
      fieldOpened:'开单时间',fieldResolved:'解决时间',
      noServiceOrder:'未找到服务工单',
      noServiceOrderBody:'当前公司没有可用的服务工单。',
      kpiOverdue:'已逾期',overdueAlert:'{n} 张工单已超出 SLA 响应时限。',
      fieldTicketNo:'工单编号',systemNumbered:'系统编号',fieldCustomer:'客户',
      fieldAssetDescription:'设备',assetPlaceholder:'例如:输送驱动装置',fieldSerialNo:'序列号(可选)',
      fieldIssue:'问题描述',issuePlaceholder:'例如:驱动装置过热,间歇性停机',
      fieldPriority:'优先级',fieldCoverage:'保修类型',fieldContract:'合约(可选)',noContract:'无合约',
      nameRequired:'请填写设备',issueRequired:'请填写问题描述',customerRequired:'请选择客户',
      ticketCreated:'工单 {no} 已登记',ticketSaveError:'工单登记失败',createTicket:'登记工单',
      unassigned:'未指派',technician:'技术员',fieldTechnician:'技术员姓名',
      technicianPlaceholder:'例如:Kwame Mensah',technicianRequired:'请填写技术员姓名',
      assign:'指派',assignTitle:'指派技术员',ticketAssigned:'{no} 已指派给 {tech}',
      ticketAssignError:'工单指派失败',
      resolveClose:'解决并关闭',resolveTitle:'解决并关闭工单',fieldDiagnosis:'诊断结果',
      diagnosisPlaceholder:'例如:更换磨损轴承组;测试3个周期后运行正常。',
      diagnosisRequired:'请填写诊断结果',ticketResolved:'{no} 已解决并关闭',
      ticketResolveError:'工单处理失败',
      slaTitle:'SLA',responseDue:'响应期限',overdueBy:'已逾期 {t}',timeLeft:'剩余 {t}',
      noSla:'此工单无 SLA',noSlaSub:'此工单未关联具有响应时限承诺的合约。',
      openedOn:'开单于 {d}',dueOn:'期限 {d}',coverageLabel:'保修类型',billable:'可计费',
      billableYes:'是',billableNo:'否 — 保修期内',customer360:'客户 360',
      contractsPanel:'关联合约',noContractLinked:'此工单未关联任何合约。',
      diagnosisPanel:'诊断',reportedIssue:'报告问题',technicianDiagnosis:'技术员诊断',
      noDiagnosisYet:'尚未记录诊断 — 解决工单后可添加。',
      fieldContractNo:'合约编号',fieldPlan:'服务计划',fieldSlaHours:'SLA 响应时间(小时,可选)',
      fieldAssetsCovered:'覆盖设备数',fieldStartDate:'开始日期',fieldExpiryDate:'到期日期',
      fieldAnnualValue:'年度价值',contractCreated:'合约 {no} 已登记',
      contractSaveError:'合约登记失败',createContract:'登记合约',
      activeContracts:'生效中',annualValueKpi:'年度价值',expiringSoon:'{n} 份合约将于60天内需要续约。',
      serviceContractTitle:'服务合约',serviceContractDescription:'查看所选合约的客户、覆盖范围与续约信息。',
      noServiceContract:'未找到服务合约',noServiceContractBody:'请从合约列表选择一份合约以查看详情。',
      commercialTerms:'商业条款',contractTerm:'合约期限',renewalContext:'续约信息',
      renewalDue:'距离续约还有 {n} 天。',renewalExpired:'此合约已过期 {n} 天。',
      renewalHealthy:'此合约剩余 {n} 天。',days:'天',customerUnavailable:'客户资料不可用',
      contractsEmpty:'暂无服务合约',
    },
    ja:{
      contractExpiring:'まもなく期限切れ',contractExpired:'期限切れ',
      serviceOrderTitle:'サービスオーダー',
      serviceOrderDescription:'選択したチケットの問題、サービス状況、ライフサイクルを確認します。',
      serviceContext:'サービス状況',lifecycleLabel:'チケットのライフサイクル',
      fieldOpened:'受付日時',fieldResolved:'解決日時',
      noServiceOrder:'サービスオーダーが見つかりません',
      noServiceOrderBody:'現在の会社に利用可能なサービスチケットはありません。',
      kpiOverdue:'期限超過',overdueAlert:'{n} 件のチケットがSLA対応時間を超過しています。',
      fieldTicketNo:'チケット番号',systemNumbered:'システム採番',fieldCustomer:'顧客',
      fieldAssetDescription:'設備',assetPlaceholder:'例:コンベアドライブユニット',fieldSerialNo:'シリアル番号(任意)',
      fieldIssue:'症状',issuePlaceholder:'例:ドライブユニットが過熱し、断続的に停止する',
      fieldPriority:'優先度',fieldCoverage:'保証区分',fieldContract:'契約(任意)',noContract:'契約なし',
      nameRequired:'設備を入力してください',issueRequired:'症状を入力してください',customerRequired:'顧客を選択してください',
      ticketCreated:'チケット {no} を登録しました',ticketSaveError:'チケットを登録できませんでした',createTicket:'チケットを登録',
      unassigned:'未割当',technician:'担当技術者',fieldTechnician:'技術者名',
      technicianPlaceholder:'例:Kwame Mensah',technicianRequired:'技術者名を入力してください',
      assign:'割当',assignTitle:'技術者を割り当てる',ticketAssigned:'{no} を {tech} に割り当てました',
      ticketAssignError:'チケットを割り当てできませんでした',
      resolveClose:'解決してクローズ',resolveTitle:'チケットを解決してクローズ',fieldDiagnosis:'診断内容',
      diagnosisPlaceholder:'例:摩耗したベアリングセットを交換し、3サイクル動作確認済み。',
      diagnosisRequired:'診断内容を入力してください',ticketResolved:'{no} を解決してクローズしました',
      ticketResolveError:'チケットを解決できませんでした',
      slaTitle:'SLA',responseDue:'対応期限',overdueBy:'{t} 超過',timeLeft:'残り {t}',
      noSla:'このチケットにSLAはありません',noSlaSub:'このチケットには対応時間の取り決めがある契約が紐づいていません。',
      openedOn:'受付 {d}',dueOn:'期限 {d}',coverageLabel:'保証区分',billable:'請求対象',
      billableYes:'はい',billableNo:'いいえ — 保証期間内',customer360:'顧客360',
      contractsPanel:'関連契約',noContractLinked:'このチケットに紐づく契約はありません。',
      diagnosisPanel:'診断',reportedIssue:'報告された症状',technicianDiagnosis:'技術者による診断',
      noDiagnosisYet:'まだ診断が記録されていません — チケットを解決すると追加できます。',
      fieldContractNo:'契約番号',fieldPlan:'プラン',fieldSlaHours:'SLA対応時間(時間、任意)',
      fieldAssetsCovered:'対象設備数',fieldStartDate:'開始日',fieldExpiryDate:'満了日',
      fieldAnnualValue:'年間契約額',contractCreated:'契約 {no} を登録しました',
      contractSaveError:'契約を登録できませんでした',createContract:'契約を登録',
      activeContracts:'有効',annualValueKpi:'年間契約額',expiringSoon:'{n} 件の契約が60日以内に更新期限を迎えます。',
      serviceContractTitle:'サービス契約',serviceContractDescription:'選択した契約の顧客、対象範囲、更新情報を確認します。',
      noServiceContract:'サービス契約が見つかりません',noServiceContractBody:'契約一覧から契約を選択して詳細を表示してください。',
      commercialTerms:'契約条件',contractTerm:'契約期間',renewalContext:'更新情報',
      renewalDue:'更新まであと {n} 日です。',renewalExpired:'この契約は {n} 日前に期限切れとなりました。',
      renewalHealthy:'契約の残存期間は {n} 日です。',days:'日',customerUnavailable:'顧客情報なし',
      contractsEmpty:'サービス契約はありません',
    },
    vi:{
      contractExpiring:'Sắp hết hạn',contractExpired:'Đã hết hạn',
      serviceOrderTitle:'Lệnh dịch vụ',
      serviceOrderDescription:'Xem sự cố, bối cảnh dịch vụ và vòng đời của phiếu đã chọn.',
      serviceContext:'Bối cảnh dịch vụ',lifecycleLabel:'Vòng đời phiếu',
      fieldOpened:'Đã mở',fieldResolved:'Đã xử lý',
      noServiceOrder:'Không tìm thấy lệnh dịch vụ',
      noServiceOrderBody:'Không có phiếu dịch vụ cho công ty hiện tại.',
      kpiOverdue:'Quá hạn',overdueAlert:'{n} phiếu đã quá thời gian phản hồi SLA.',
      fieldTicketNo:'Số phiếu',systemNumbered:'Đánh số tự động',fieldCustomer:'Khách hàng',
      fieldAssetDescription:'Thiết bị',assetPlaceholder:'vd: Cụm truyền động băng tải',fieldSerialNo:'Số serial (tùy chọn)',
      fieldIssue:'Sự cố',issuePlaceholder:'vd: Cụm truyền động quá nhiệt, dừng gián đoạn',
      fieldPriority:'Mức độ ưu tiên',fieldCoverage:'Loại bảo hành',fieldContract:'Hợp đồng (tùy chọn)',noContract:'Không có hợp đồng',
      nameRequired:'Vui lòng nhập thiết bị',issueRequired:'Vui lòng nhập sự cố',customerRequired:'Vui lòng chọn khách hàng',
      ticketCreated:'Đã ghi nhận phiếu {no}',ticketSaveError:'Không thể ghi nhận phiếu',createTicket:'Ghi nhận phiếu',
      unassigned:'Chưa phân công',technician:'Kỹ thuật viên',fieldTechnician:'Tên kỹ thuật viên',
      technicianPlaceholder:'vd: Kwame Mensah',technicianRequired:'Vui lòng nhập tên kỹ thuật viên',
      assign:'Phân công',assignTitle:'Phân công kỹ thuật viên',ticketAssigned:'Đã phân công {no} cho {tech}',
      ticketAssignError:'Không thể phân công phiếu',
      resolveClose:'Xử lý & đóng',resolveTitle:'Xử lý & đóng phiếu',fieldDiagnosis:'Chẩn đoán',
      diagnosisPlaceholder:'vd: Đã thay bộ vòng bi mòn; đã kiểm tra qua 3 chu kỳ, hoạt động bình thường.',
      diagnosisRequired:'Vui lòng nhập chẩn đoán',ticketResolved:'Đã xử lý và đóng {no}',
      ticketResolveError:'Không thể xử lý phiếu',
      slaTitle:'SLA',responseDue:'Hạn phản hồi',overdueBy:'Quá hạn {t}',timeLeft:'Còn {t}',
      noSla:'Phiếu này không có SLA',noSlaSub:'Phiếu này không liên kết với hợp đồng có cam kết thời gian phản hồi.',
      openedOn:'mở lúc {d}',dueOn:'hạn {d}',coverageLabel:'Loại bảo hành',billable:'Tính phí',
      billableYes:'Có',billableNo:'Không — còn bảo hành',customer360:'Khách hàng 360',
      contractsPanel:'Hợp đồng liên quan',noContractLinked:'Phiếu này chưa liên kết hợp đồng nào.',
      diagnosisPanel:'Chẩn đoán',reportedIssue:'Sự cố báo cáo',technicianDiagnosis:'Chẩn đoán của kỹ thuật viên',
      noDiagnosisYet:'Chưa có chẩn đoán nào — xử lý phiếu để thêm.',
      fieldContractNo:'Số hợp đồng',fieldPlan:'Gói dịch vụ',fieldSlaHours:'Thời gian phản hồi SLA (giờ, tùy chọn)',
      fieldAssetsCovered:'Số thiết bị được bảo hành',fieldStartDate:'Ngày bắt đầu',fieldExpiryDate:'Ngày hết hạn',
      fieldAnnualValue:'Giá trị hàng năm',contractCreated:'Đã đăng ký hợp đồng {no}',
      contractSaveError:'Không thể đăng ký hợp đồng',createContract:'Đăng ký hợp đồng',
      activeContracts:'Đang hiệu lực',annualValueKpi:'Giá trị hàng năm',expiringSoon:'{n} hợp đồng cần gia hạn trong 60 ngày tới.',
      serviceContractTitle:'Hợp đồng dịch vụ',serviceContractDescription:'Xem khách hàng, phạm vi và thông tin gia hạn của hợp đồng đã chọn.',
      noServiceContract:'Không tìm thấy hợp đồng dịch vụ',noServiceContractBody:'Chọn một hợp đồng từ danh sách Hợp đồng để xem chi tiết.',
      commercialTerms:'Điều khoản thương mại',contractTerm:'Thời hạn hợp đồng',renewalContext:'Thông tin gia hạn',
      renewalDue:'Cần gia hạn trong {n} ngày.',renewalExpired:'Hợp đồng đã hết hạn {n} ngày trước.',
      renewalHealthy:'Hợp đồng còn {n} ngày.',days:'ngày',customerUnavailable:'Không có thông tin khách hàng',
      contractsEmpty:'Chưa có hợp đồng dịch vụ',
    },
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

function serviceNumber(value){ const parsed=Number(value); return Number.isFinite(parsed)?parsed:0; }

function serviceToDate(value){
  return value instanceof Date?value:new Date(value);
}
function serviceContractStatus(expiryDate){
  const today=new Date();
  const expiry=new Date(dateValue(expiryDate)+'T00:00:00');
  const daysLeft=Math.ceil((expiry-today)/86400000);
  if(daysLeft<0) return 'expired';
  if(daysLeft<=60) return 'expiring';
  return 'active';
}
function formatDuration(ms){
  const abs=Math.abs(ms);
  const hours=abs/3600000;
  if(hours<24) return Math.max(1,Math.round(hours))+'h';
  return Math.round(hours/24)+'d';
}

/* Shared prep for all 3 Service screens — mirrors prepareCanonicalFinanceData's
   one-function-many-screens shape. */
async function prepareCanonicalServiceData(){
  const adapter=window.ErpSystemData;
  if(adapter&&adapter.mode==='fallback'){
    if(Array.isArray(DB.serviceTickets)&&Array.isArray(DB.serviceContracts)) return;
    throw new Error('The offline canonical service snapshot is unavailable.');
  }
  const pages=await Promise.all([
    listPage('service/tickets'),
    listPage('service/contracts'),
    listPage('sales/customers'),
  ]);
  const [tickets,contracts,customers]=pages.map(p=>p.data);
  const customerById=new Map(customers.map(c=>[c.id,c]));
  DB.customers=customers.map(row=>({
    id:row.id, code:row.code, name:row.name, terms:'—', limit:0, balance:0, overdue:0, status:'Active',
  }));
  const contractById=new Map(contracts.map(row=>[row.id,row]));
  DB.serviceContracts=contracts.map(row=>({
    id:row.id,
    no:row.contractNo,
    custId:row.customerId,
    cust:customerById.get(row.customerId)?.name||('Customer #'+row.customerId),
    plan:row.plan,
    slaResponseHours:row.slaResponseHours==null?null:serviceNumber(row.slaResponseHours),
    assets:serviceNumber(row.assetsCovered),
    start:dateValue(row.startDate),
    expiry:dateValue(row.expiryDate),
    value:serviceNumber(row.annualValue),
    computedStatus:serviceContractStatus(row.expiryDate),
  }));
  DB.serviceTickets=tickets.map(row=>{
    const contract=row.contractId!=null?contractById.get(row.contractId):null;
    const opened=serviceToDate(row.openedAt);
    const dueAt=(row.status!=='closed'&&contract&&contract.slaResponseHours!=null)
      ?new Date(opened.getTime()+serviceNumber(contract.slaResponseHours)*3600000)
      :null;
    const overdue=!!(dueAt&&dueAt.getTime()<Date.now());
    return {
      id:row.id,
      no:row.ticketNo,
      custId:row.customerId,
      cust:customerById.get(row.customerId)?.name||('Customer #'+row.customerId),
      contractId:row.contractId,
      asset:row.assetDescription,
      sn:row.serialNo,
      issue:row.issue,
      diagnosis:row.diagnosis,
      priority:row.priority,
      coverage:row.coverage,
      status:row.status,
      tech:row.technicianName,
      openedAt:row.openedAt,
      resolvedAt:row.resolvedAt,
      dueAt,
      overdue,
    };
  });
  DB.serviceReadMeta={ truncated:pages.some(p=>Boolean(p.nextCursor)) };
}

function nextTicketNo(tickets){
  let max=0;
  (tickets||[]).forEach(t=>{ const m=/(\d+)\s*$/.exec(t.no||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'SVC-'+new Date().getFullYear()+'-'+String(max+1).padStart(4,'0');
}
function nextContractNo(contracts){
  let max=0;
  (contracts||[]).forEach(c=>{ const m=/(\d+)\s*$/.exec(c.no||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'SC-'+new Date().getFullYear()+'-'+String(max+1).padStart(4,'0');
}

/* ---------------- SERVICE TICKETS (listing) ---------------- */
SCREENS['service-ticket'] = async function(root){
  await prepareCanonicalServiceData();
  const s=serviceCopy();
  const chips=[['all',t('common.all'),null],['open',ts('Open'),'warn'],['in_progress',ts('In Progress'),'info'],['closed',ts('Closed'),'ok']];
  const activeN=DB.serviceTickets.filter(x=>x.status==='open'||x.status==='in_progress').length;
  const overdueN=DB.serviceTickets.filter(x=>x.overdue).length;
  transactionListPage(root,{
    module:'service',route:'service-ticket',title:t('svc.title'),
    rows:DB.serviceTickets,rowId:x=>x.id,
    filters:chips.map(([key,label])=>[key,label]),filterFn:(ticket,status)=>ticket.status===status,
    kpis:[
      {label:t('svc.kpi.open'),value:activeN,filter:'open'},
      {label:s('kpiOverdue'),value:overdueN,negative:overdueN>0},
    ],
    primaryAction:{label:t('svc.new'),icon:'plus',onClick:()=>serviceTicketForm(s)},
    toolbarActions:[{label:t('svc.contracts'),icon:'receipt',onClick:()=>navigate('service-contracts')}],
    columns:[
      {label:t('svc.col.ticket'),sticky:true,render:x=>`<div class="cellsub"><b class="docnum">${esc(x.no)}</b><small>${esc(x.cust)}</small></div>`},
      {label:t('svc.col.asset'),align:'l',render:x=>`<div class="cellsub"><b>${esc(x.asset)}</b>${x.sn?`<small>SN ${esc(x.sn)}</small>`:''}</div>`},
      {label:t('svc.col.issue'),align:'l',render:x=>`<span style="color:var(--muted)">${esc(x.issue)}</span>`},
      {label:t('svc.col.priority'),align:'l',render:x=>cap(ts(x.priority),svcPriorityTone(x.priority))},
      {label:t('svc.col.cover'),align:'l',render:x=>cap(ts(SERVICE_COVERAGE_LABEL[x.coverage]),coverTone(SERVICE_COVERAGE_LABEL[x.coverage]))},
      {label:t('svc.col.tech'),align:'l',render:x=>x.tech?esc(x.tech):`<span style="color:var(--warn)">${esc(s('unassigned'))}</span>`},
      {label:'SLA',align:'l',render:x=>x.dueAt?(x.overdue?`<span style="color:var(--danger)">${esc(s('overdueBy').replace('{t}',formatDuration(Date.now()-x.dueAt.getTime())))}</span>`:`<span class="tnum">${esc(s('timeLeft').replace('{t}',formatDuration(x.dueAt.getTime()-Date.now())))}</span>`):'—'},
      {label:t('col.status'),align:'l',render:x=>svcTicketStatusBadge(x.status)},
    ],
    rowAction:{
      label:x=>`${t('common.open')} ${x.no}`,
      run:x=>navigate('service-order',{ticketId:Number(x.id)}),
    },
    empty:{icon:'wrench',title:'No service tickets'},
  });
};

function serviceTicketForm(s){
  const ticketNo=nextTicketNo(DB.serviceTickets);
  const customers=(DB.customers||[]).slice();
  const contracts=(DB.serviceContracts||[]).slice();
  appModal({
    icon:'plus',
    title:t('svc.new'),
    body:`<div class="set-grid">
      <div class="fld"><span>${esc(s('fieldCustomer'))} <span class="req">*</span></span><select id="tfCustomer"><option value="">—</option>${customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="fld"><span>${esc(s('fieldTicketNo'))}</span><input value="${esc(ticketNo)}" readonly><span class="locked">${ic('lock')} ${esc(s('systemNumbered'))}</span></div>
      <div class="fld"><span>${esc(s('fieldAssetDescription'))} <span class="req">*</span></span><input id="tfAsset" placeholder="${esc(s('assetPlaceholder'))}"></div>
      <div class="fld"><span>${esc(s('fieldSerialNo'))}</span><input id="tfSerial"></div>
      <div class="fld" style="grid-column:1/-1"><span>${esc(s('fieldIssue'))} <span class="req">*</span></span><input id="tfIssue" placeholder="${esc(s('issuePlaceholder'))}"></div>
      <div class="fld"><span>${esc(s('fieldPriority'))}</span><select id="tfPriority"><option>Critical</option><option selected>Medium</option><option>High</option><option>Low</option></select></div>
      <div class="fld"><span>${esc(s('fieldCoverage'))}</span><select id="tfCoverage">
        <option value="out_of_warranty" selected>${esc(ts('Out of warranty'))}</option>
        <option value="in_warranty">${esc(ts('In warranty'))}</option>
        <option value="contract">${esc(ts('Contract'))}</option>
      </select></div>
      <div class="fld" style="grid-column:1/-1"><span>${esc(s('fieldContract'))}</span><select id="tfContract"><option value="">${esc(s('noContract'))}</option>${contracts.map(c=>`<option value="${c.id}">${esc(c.no)} · ${esc(c.cust)} · ${esc(c.plan)}</option>`).join('')}</select></div>
    </div>`,
    actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('createTicket'),{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`,
  });
  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const customerId=$('#tfCustomer').value?Number($('#tfCustomer').value):null;
    if(!requireField(customerId, s('customerRequired'), '#tfCustomer')) return;
    const assetDescription=$('#tfAsset').value.trim();
    if(!requireField(assetDescription, s('nameRequired'), '#tfAsset')) return;
    const issue=$('#tfIssue').value.trim();
    if(!requireField(issue, s('issueRequired'), '#tfIssue')) return;
    const payload={
      ticketNo, customerId, assetDescription,
      serialNo:$('#tfSerial').value.trim()||null,
      issue, priority:$('#tfPriority').value, coverage:$('#tfCoverage').value,
      contractId:$('#tfContract').value?Number($('#tfContract').value):null,
    };
    saveBtn.disabled=true;
    try{
      await window.ErpSystemData.create('service/tickets',payload);
      closeModal();
      toast(s('ticketCreated').replace('{no}',ticketNo),'ok');
      navigate('service-ticket');
    }catch(error){
      saveBtn.disabled=false;
      toast(error&&error.message?error.message:s('ticketSaveError'),'danger');
    }
  });
}

/* ---------------- SERVICE ORDER (per-ticket detail) ---------------- */
async function prepareServiceTicketDetail(ticketId){
  await prepareCanonicalServiceData();
  const ticket=ticketId?DB.serviceTickets.find(x=>x.id===ticketId):DB.serviceTickets[0];
  if(!ticket) return {ticket:null,contract:null,customerRow:null};
  const contract=ticket.contractId!=null?DB.serviceContracts.find(c=>c.id===ticket.contractId):null;
  const customerRow=(DB.customers||[]).find(c=>c.id===ticket.custId);
  return {ticket,contract,customerRow};
}

SCREENS['service-order'] = async function(root, params){
  const s=serviceCopy();
  const requestedId=params&&params.ticketId?Number(params.ticketId):null;
  const detail=await prepareServiceTicketDetail(requestedId);
  const {ticket:d,contract}=detail;
  const baseCrumb=[
    DB.company.name,
    {label:t('nav.service'),route:'service-ticket'},
    {label:t('svc.crumb'),route:'service-ticket'},
  ];
  if(!d){
    caseDetailPage(root,{
      module:'service',
      route:'service-order',
      title:s('serviceOrderTitle'),
      description:s('serviceOrderDescription'),
      crumb:[...baseCrumb,{cur:s('serviceOrderTitle')}],
      empty:{icon:'wrench',title:s('noServiceOrder'),description:s('noServiceOrderBody')},
      afterRender:({caseRoot})=>{
        caseRoot?.setAttribute('data-canonical-service-order','true');
      },
    });
    return;
  }

  function slaPanel(){
    if(!d.dueAt){
      return `<div class="service-order-context-section" data-service-sla>
        <div class="sectitle">${esc(s('slaTitle'))}</div>
        <div class="service-order-context-empty">
          <span>${esc(s('noSla'))}</span>
          <small>${esc(s('noSlaSub'))}</small>
        </div>
      </div>`;
    }
    const tone=d.overdue?'danger':'ok';
    const label=d.overdue?s('overdueBy').replace('{t}',formatDuration(Date.now()-d.dueAt.getTime())):s('timeLeft').replace('{t}',formatDuration(d.dueAt.getTime()-Date.now()));
    return `<div class="service-order-context-section" data-service-sla>
      <div class="sectitle">${esc(s('slaTitle'))}</div>
      <div class="indicator ${tone}">
        <div class="ind-top">${ic('clock')}<span>${esc(s('responseDue'))}</span><span class="ind-r">${esc(label)}</span></div>
        <small>${esc(contract?contract.plan+' SLA · ':'')}${esc(s('openedOn').replace('{d}',dateTimeValue(d.openedAt)))} · ${esc(s('dueOn').replace('{d}',dateTimeValue(d.dueAt)))}</small>
      </div>
      <div class="service-order-sla-facts">
        <div class="sumrow"><span class="sk2">${esc(s('coverageLabel'))}</span><span class="sv">${cap(ts(SERVICE_COVERAGE_LABEL[d.coverage]),coverTone(SERVICE_COVERAGE_LABEL[d.coverage]))}</span></div>
        <div class="sumrow"><span class="sk2">${esc(s('billable'))}</span><span class="sv">${d.coverage==='in_warranty'?esc(s('billableNo')):esc(s('billableYes'))}</span></div>
      </div>
    </div>`;
  }

  const contractStatus=contract
    ? {active:s('activeContracts'),expiring:s('contractExpiring'),expired:s('contractExpired')}[contract.computedStatus]
      || s('activeContracts')
    : '';
  const relatedContract=`<div class="service-order-context-section" data-service-contract>
    <div class="sectitle">${esc(s('contractsPanel'))}</div>
    ${contract
      ?relatedDocs([{no:contract.no,label:contract.plan+' SLA',meta:contract.cust,status:contractStatus}])
      :`<div class="service-order-context-empty"><span>${esc(s('noContractLinked'))}</span></div>`}
  </div>`;
  const actions=d.status!=='closed'?`
    <div class="grow"></div>
    ${d.status==='open'?btn(s('assign'),{icon:'people',cls:'soft',attrs:'data-act="assign"'}):''}
    ${btn(s('resolveClose'),{icon:'check',cls:'primary',sm:false,attrs:'data-act="resolve"'})}`:'';

  caseDetailPage(root,{
    module:'service',
    route:'service-order',
    title:s('serviceOrderTitle'),
    description:s('serviceOrderDescription'),
    crumb:[...baseCrumb,{cur:d.no}],
    identity:{
      title:d.asset,
      code:d.no,
      meta:`${d.sn?`SN ${d.sn} · `:''}${d.cust}`,
      related:btn(s('customer360'),{
        icon:'user',
        cls:'soft',
        attrs:`data-service-customer="${d.custId}"`,
      }),
    },
    statuses:[
      {label:ts(d.priority),tone:svcPriorityTone(d.priority)},
      {label:ts(SERVICE_TICKET_STATUS_LABEL[d.status]||d.status),tone:SERVICE_TICKET_STATUS_TONE[d.status]||'neutral'},
    ],
    lifecycle:{
      label:s('lifecycleLabel'),
      current:d.status,
      steps:[
        {key:'open',label:ts('Open')},
        {key:'in_progress',label:ts('In Progress')},
        {key:'closed',label:ts('Closed')},
      ],
    },
    facts:[
      {label:s('technician'),value:d.tech||s('unassigned')},
      {label:s('coverageLabel'),value:ts(SERVICE_COVERAGE_LABEL[d.coverage])},
      {label:s('fieldOpened'),value:dateTimeValue(d.openedAt)},
      {label:s('fieldResolved'),value:d.resolvedAt?dateTimeValue(d.resolvedAt):'—'},
    ],
    main:`<div class="panel service-order-diagnosis" data-service-diagnosis>
      <div class="panel-h"><h3>${esc(s('diagnosisPanel'))}</h3></div>
      <div class="panel-body">
        <div class="risk warn">${ic('info')}<div><b>${esc(s('reportedIssue'))}</b><small>${esc(d.issue)}</small></div></div>
        ${d.diagnosis
          ?`<div class="risk ok">${ic('checkc')}<div><b>${esc(s('technicianDiagnosis'))}</b><small>${esc(d.diagnosis)}</small></div></div>`
          :`<div class="case-detail-inline-empty" data-service-diagnosis-empty>${ic('wrench')}<span>${esc(s('noDiagnosisYet'))}</span></div>`}
      </div>
    </div>`,
    context:{
      title:s('serviceContext'),
      body:`${slaPanel()}${relatedContract}`,
    },
    actions,
    afterRender:({caseRoot})=>{
      caseRoot?.setAttribute('data-canonical-service-order','true');
      root.querySelector('[data-service-customer]')?.addEventListener('click',event=>{
        navigate('crm-customer',{customerId:Number(event.currentTarget.dataset.serviceCustomer)});
      });
      root.querySelector('[data-act="assign"]')?.addEventListener('click',()=>assignTicketForm(s,d,async()=>{
        navigate('service-order',{ticketId:d.id});
      }));
      root.querySelector('[data-act="resolve"]')?.addEventListener('click',()=>resolveTicketForm(s,d,async()=>{
        navigate('service-order',{ticketId:d.id});
      }));
    },
  });
};

function assignTicketForm(s,ticket,onSaved){
  appModal({
    icon:'people',
    title:s('assignTitle')+' — '+ticket.no,
    body:`<div class="fld"><span>${esc(s('fieldTechnician'))} <span class="req">*</span></span><input id="afTech" placeholder="${esc(s('technicianPlaceholder'))}"></div>`,
    actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('assign'),{icon:'check',cls:'primary',attrs:'data-save="1"'})}`,
  });
  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const technicianName=$('#afTech').value.trim();
    if(!requireField(technicianName, s('technicianRequired'), '#afTech')) return;
    saveBtn.disabled=true;
    try{
      await window.ErpSystemData.action('service/tickets',ticket.id,'assign',{technicianName},`assign-service-ticket-${ticket.id}`);
      closeModal();
      toast(s('ticketAssigned').replace('{no}',ticket.no).replace('{tech}',technicianName),'ok');
      await onSaved();
    }catch(error){
      saveBtn.disabled=false;
      toast(error&&error.message?error.message:s('ticketAssignError'),'danger');
    }
  });
}

function resolveTicketForm(s,ticket,onSaved){
  appModal({
    icon:'check',
    title:s('resolveTitle')+' — '+ticket.no,
    body:`<div class="fld"><span>${esc(s('fieldDiagnosis'))} <span class="req">*</span></span><input id="rfDiagnosis" placeholder="${esc(s('diagnosisPlaceholder'))}"></div>`,
    actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('resolveClose'),{icon:'check',cls:'primary',attrs:'data-save="1"'})}`,
  });
  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const diagnosis=$('#rfDiagnosis').value.trim();
    if(!requireField(diagnosis, s('diagnosisRequired'), '#rfDiagnosis')) return;
    saveBtn.disabled=true;
    try{
      await window.ErpSystemData.action('service/tickets',ticket.id,'resolve',{diagnosis},`resolve-service-ticket-${ticket.id}`);
      closeModal();
      toast(s('ticketResolved').replace('{no}',ticket.no),'ok');
      await onSaved();
    }catch(error){
      saveBtn.disabled=false;
      toast(error&&error.message?error.message:s('ticketResolveError'),'danger');
    }
  });
}

/* ---------------- SERVICE CONTRACTS (master list) ---------------- */
function planTone(p){ return {Gold:'violet',Silver:'slate',Bronze:'neutral'}[p]||'neutral'; }
const SERVICE_CONTRACT_STATUS_LABEL={active:'Active',expiring:'Expiring',expired:'Expired'};
const SERVICE_CONTRACT_STATUS_TONE={active:'ok',expiring:'warn',expired:'neutral'};

SCREENS['service-contracts'] = async function(root){
  await prepareCanonicalServiceData();
  const s=serviceCopy();
  const activeN=DB.serviceContracts.filter(c=>c.computedStatus==='active').length;
  const expiringN=DB.serviceContracts.filter(c=>c.computedStatus==='expiring').length;
  const arr=DB.serviceContracts.reduce((sum,c)=>sum+c.value,0);
  transactionListPage(root,{
    module:'service',route:'service-contracts',title:t('svc.contracts'),
    description:expiringN?s('expiringSoon').replace('{n}',expiringN):'',
    rows:DB.serviceContracts,rowId:c=>c.id,
    kpis:[
      {label:s('activeContracts'),value:activeN},
      {label:s('annualValueKpi'),value:money0(arr)},
      {label:s('expiringSoon').replace('{n}',expiringN),value:expiringN,negative:expiringN>0},
    ],
    primaryAction:{label:s('createContract'),icon:'plus',onClick:()=>serviceContractForm(s)},
    toolbarActions:[{label:t('svc.title'),icon:'wrench',onClick:()=>navigate('service-ticket')}],
    columns:[
      {label:'Contract',sticky:true,render:c=>`<div class="cellsub"><b class="docnum">${esc(c.no)}</b><small>${esc(c.cust)}</small></div>`},
      {label:'Plan',align:'l',render:c=>cap(c.plan,planTone(c.plan))},
      {label:'SLA',align:'l',render:c=>c.slaResponseHours!=null?`${c.slaResponseHours}h`:'—'},
      {label:'Assets',align:'r',render:c=>`<span class="tnum">${c.assets}</span>`},
      {label:'Start',align:'l',render:c=>esc(c.start)},
      {label:'Expiry',align:'l',render:c=>c.computedStatus==='expiring'?`<span style="color:var(--warn)">${esc(c.expiry)}</span>`:esc(c.expiry)},
      {label:'Annual value',align:'r',sortable:true,render:c=>`<b class="tnum">${money(c.value)}</b>`},
      {label:'Status',align:'l',render:c=>cap(ts(SERVICE_CONTRACT_STATUS_LABEL[c.computedStatus]),SERVICE_CONTRACT_STATUS_TONE[c.computedStatus])},
    ],
    rowAction:{
      label:c=>`${t('common.open')} ${c.no}`,
      run:c=>navigate('service-contract',{contractId:Number(c.id)}),
    },
    empty:{icon:'receipt',title:s('contractsEmpty')},
  });
};

function serviceContractNotFound(error){
  const message=String(error&&error.message||'');
  return error&&(error.code==='record_not_found'||Number(error.status)===404||/resource not found/i.test(message));
}

function serviceContractRenewalText(s,status,daysRemaining){
  const days=Math.abs(daysRemaining);
  if(status==='expired') return s('renewalExpired').replace('{n}',days);
  if(status==='expiring') return s('renewalDue').replace('{n}',days);
  return s('renewalHealthy').replace('{n}',days);
}

function renderEmptyServiceContract(root,s){
  masterDetailEditorPage(root,{
    module:'service',route:'service-contract',active:'service-contracts',
    title:s('serviceContractTitle'),description:s('serviceContractDescription'),
    crumb:[DB.company.name,{label:t('nav.service'),route:'service-ticket'},{label:t('svc.contracts'),route:'service-contracts'},{cur:s('serviceContractTitle')}],
    empty:{icon:'receipt',title:s('noServiceContract'),description:s('noServiceContractBody')},
    afterRender:({editor})=>editor?.setAttribute('data-canonical-service-contract','true'),
  });
}

SCREENS['service-contract'] = async function(root,params){
  const s=serviceCopy();
  const contractId=Number(params&&params.contractId);
  if(!Number.isSafeInteger(contractId)||contractId<=0){
    await Promise.resolve();
    renderEmptyServiceContract(root,s);
    return;
  }
  let contract;
  try{
    contract=(await window.ErpSystemData.get('service/contracts',contractId)).data;
  }catch(error){
    if(serviceContractNotFound(error)){
      renderEmptyServiceContract(root,s);
      return;
    }
    throw error;
  }
  let customer=null;
  try{
    customer=(await window.ErpSystemData.get('sales/customers',Number(contract.customerId))).data;
  }catch(error){
    if(!serviceContractNotFound(error)) throw error;
  }
  const customerName=customer&&customer.name
    ? customer.name
    : `${s('customerUnavailable')} · #${contract.customerId}`;
  const status=serviceContractStatus(contract.expiryDate);
  const start=dateValue(contract.startDate);
  const expiry=dateValue(contract.expiryDate);
  const today=new Date();
  today.setHours(0,0,0,0);
  const expiryDate=new Date(`${expiry}T00:00:00`);
  const daysRemaining=Math.ceil((expiryDate.getTime()-today.getTime())/86400000);
  const termDays=Math.max(0,Math.ceil((new Date(`${expiry}T00:00:00`)-new Date(`${start}T00:00:00`))/86400000));
  const currency=DB.company&&DB.company.currency||'SGD';
  const sla=contract.slaResponseHours==null?'—':`${serviceNumber(contract.slaResponseHours)}h`;
  const assets=serviceNumber(contract.assetsCovered);
  masterDetailEditorPage(root,{
    module:'service',route:'service-contract',active:'service-contracts',
    title:s('serviceContractTitle'),description:s('serviceContractDescription'),
    crumb:[DB.company.name,{label:t('nav.service'),route:'service-ticket'},{label:t('svc.contracts'),route:'service-contracts'},{cur:contract.contractNo}],
    status:{
      label:ts(SERVICE_CONTRACT_STATUS_LABEL[status]),
      tone:SERVICE_CONTRACT_STATUS_TONE[status],
    },
    headerActions:btn(s('customer360'),{
      icon:'user',cls:'soft',sm:false,
      attrs:`data-service-contract-customer="${Number(contract.customerId)}"`,
    }),
    overview:{
      title:customerName,
      code:contract.contractNo,
      meta:contract.plan,
      facts:[
        {label:s('fieldStartDate'),value:start},
        {label:s('fieldExpiryDate'),value:expiry},
        {label:s('fieldSlaHours'),value:sla},
        {label:s('fieldAssetsCovered'),value:assets,numeric:true},
      ],
    },
    main:`
      <div class="panel" data-service-contract-commercial>
        <div class="panel-h"><h3>${esc(s('commercialTerms'))}</h3></div>
        <div class="master-detail-editor-facts">
          <div class="master-detail-editor-fact">
            <small>${esc(s('fieldAnnualValue'))}</small>
            <b class="tnum">${esc(money(serviceNumber(contract.annualValue),currency))}</b>
          </div>
          <div class="master-detail-editor-fact">
            <small>${esc(s('contractTerm'))}</small>
            <b class="tnum">${termDays} ${esc(s('days'))}</b>
          </div>
          <div class="master-detail-editor-fact">
            <small>${esc(s('fieldPlan'))}</small>
            <b>${esc(contract.plan)}</b>
          </div>
        </div>
      </div>`,
    context:{
      title:s('renewalContext'),
      body:`<div class="indicator ${status==='active'?'ok':status==='expiring'?'warn':'neutral'}" data-service-contract-renewal>
        <div class="ind-top">${ic('calendar')}<span>${esc(ts(SERVICE_CONTRACT_STATUS_LABEL[status]))}</span>
          <span class="ind-r tnum">${Math.abs(daysRemaining)} ${esc(s('days'))}</span></div>
        <small>${esc(serviceContractRenewalText(s,status,daysRemaining))}</small>
      </div>`,
    },
    afterRender:({editor})=>{
      editor?.setAttribute('data-canonical-service-contract','true');
      root.querySelector('[data-service-contract-customer]')?.addEventListener('click',event=>{
        navigate('crm-customer',{customerId:Number(event.currentTarget.dataset.serviceContractCustomer)});
      });
    },
  });
};

function serviceContractForm(s){
  const contractNo=nextContractNo(DB.serviceContracts);
  const today=new Date().toISOString().slice(0,10);
  const customers=(DB.customers||[]).slice();
  appModal({
    icon:'plus',
    title:s('createContract'),
    body:`<div class="set-grid">
      <div class="fld"><span>${esc(s('fieldCustomer'))} <span class="req">*</span></span><select id="cfCustomer"><option value="">—</option>${customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="fld"><span>${esc(s('fieldContractNo'))}</span><input value="${esc(contractNo)}" readonly><span class="locked">${ic('lock')} ${esc(s('systemNumbered'))}</span></div>
      <div class="fld"><span>${esc(s('fieldPlan'))}</span><select id="cfPlan"><option>Gold</option><option>Silver</option><option>Bronze</option></select></div>
      <div class="fld"><span>${esc(s('fieldSlaHours'))}</span><input id="cfSla" type="number" min="1" class="tnum"></div>
      <div class="fld"><span>${esc(s('fieldAssetsCovered'))}</span><input id="cfAssets" type="number" min="0" class="tnum" value="1"></div>
      <div class="fld"><span>${esc(s('fieldAnnualValue'))}</span><input id="cfValue" type="number" min="0" step="0.01" class="tnum" value="0"></div>
      <div class="fld"><span>${esc(s('fieldStartDate'))}</span><input id="cfStart" type="date" value="${today}"></div>
      <div class="fld"><span>${esc(s('fieldExpiryDate'))}</span><input id="cfExpiry" type="date"></div>
    </div>`,
    actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('createContract'),{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`,
  });
  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const customerId=$('#cfCustomer').value?Number($('#cfCustomer').value):null;
    if(!requireField(customerId, s('customerRequired'), '#cfCustomer')) return;
    const expiryDate=$('#cfExpiry').value;
    if(!requireField(expiryDate, s('fieldExpiryDate'), '#cfExpiry')) return;
    const payload={
      contractNo, customerId, plan:$('#cfPlan').value,
      slaResponseHours:$('#cfSla').value?Number($('#cfSla').value):null,
      assetsCovered:Math.max(0,+$('#cfAssets').value||0),
      startDate:$('#cfStart').value, expiryDate,
      annualValue:Math.max(0,+$('#cfValue').value||0),
    };
    saveBtn.disabled=true;
    try{
      await window.ErpSystemData.create('service/contracts',payload);
      closeModal();
      toast(s('contractCreated').replace('{no}',contractNo),'ok');
      navigate('service-contracts');
    }catch(error){
      saveBtn.disabled=false;
      toast(error&&error.message?error.message:s('contractSaveError'),'danger');
    }
  });
}
