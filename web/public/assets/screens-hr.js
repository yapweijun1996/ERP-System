/* ============================================================
   ARIA ERP — screens: HR (Employee Directory, Employee Profile,
   canonical Payroll Run and Payslip)
   ============================================================ */

function hrCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{
      statusActive:'Active',statusOnLeave:'On leave',statusInactive:'Inactive',
      employeeProfileTitle:'Employee profile',
      employeeProfileDescription:'Review current employment, contact and leave facts for the selected employee.',
      typeParttime:'Part-time',typeIntern:'Intern',
      personalContact:'Personal & contact',fieldEmail:'Email',fieldPhone:'Phone',noPhone:'Not on file',
      fieldDept:'Department',fieldEmployment:'Employment',fieldJoined:'Joined',fieldManager:'Reports to',
      noManager:'— (top of reporting line)',
      leaveBalanceTitle:'Leave balance',annualLeaveLabel:'Annual leave',
      annualLeaveUsed:'{used} of {total} days used this year',
      annualLeaveRemaining:'{remaining} of {total} days remaining',
      recentLeaveTitle:'Leave requests',noLeaveRequests:'No leave requests yet.',
      noEmployeeFound:'No employee found',noEmployeeBody:'No employee exists for the active company yet.',
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
      leaveApprovalTitle:'Leave Approval',leaveApprovalDescription:'Review and decide leave requests for the active company.',
      kpiPendingRequests:'Pending requests',kpiPendingDays:'Pending days',
      kpiApprovedRequests:'Approved',kpiRejectedRequests:'Rejected',
      colDates:'Dates',colLeaveType:'Leave type',colDays:'Days',
      requestedDays:'Requested',fromDate:'From',toDate:'To',decidedAt:'Decided',
      employeeReason:'Employee reason',hrDecisionReason:'HR decision reason',
      selectLeaveRequest:'Select a leave request',
      selectLeaveRequestBody:'Choose a request from the queue to review its details.',
      noLeaveRequestsBody:'No requests match the selected status.',
      unknownEmployee:'Unknown employee',daysValue:'{count} days',
      filterAllStatus:'All',statusPending:'Pending',statusApproved:'Approved',statusRejected:'Rejected',
      approve:'Approve',reject:'Reject',cancel:'Cancel',rejectTitle:'Reject leave — {name}',
      rejectReasonLabel:'Reason',rejectReasonPlaceholder:'Shared with the employee.',
      rejectReasonRequired:'A reason is required to reject.',
      approvedToast:'{name}’s leave approved',rejectedToast:'{name}’s leave rejected',
      actionError:'Could not update this leave request',
      fieldBaseSalary:'Base salary (monthly)',baseSalaryRequired:'Base salary must be greater than 0',
      payrollRunTitle:'Payroll Run',payrollCrumb:'Payroll',
      payrollRunDescription:'Create, review and post payroll runs for the active company.',
      kpiTotalRuns:'Total runs',kpiDraftRuns:'Draft runs',kpiPostedRuns:'Posted runs',kpiLatestNet:'Latest net payroll',
      filterAllRuns:'All',statusDraft:'Draft',statusPosted:'Posted',
      colRun:'Run',colPeriod:'Payroll period',colPayDate:'Pay date',colHeadcount:'Headcount',colStatus:'Status',
      selectPayrollRun:'Select a payroll run',selectPayrollRunBody:'Choose a payroll run from the register to review its details.',
      noPayrollLines:'No payroll lines',noPayrollLinesBody:'This payroll run does not contain any employee payroll lines.',
      employeePayrollLines:'Employee payroll lines',
      newRunDescription:'Set the payroll period and pay date. Active employees are calculated by the canonical payroll command.',
      createRun:'Create payroll run',creatingRun:'Creating…',
      dateRequired:'Complete every payroll date.',invalidPayrollPeriod:'Period end cannot be earlier than period start.',
      fieldPeriodStart:'Period start',fieldPeriodEnd:'Period end',fieldPayDate:'Pay date',
      selectRun:'Payroll run',newRunButton:'New payroll run',postButton:'Approve & lock run',
      noRunYet:'No payroll run yet',noRunBody:'Create a payroll run to compute pay for every active employee.',
      runCreated:'Payroll run created',runError:'Payroll run could not be created',
      postConfirmTitle:'Approve & lock this payroll run?',
      postConfirmBody:'Locking posts the payroll journal (salary expense, statutory contributions & tax payable) and releases {amount} in net pay across {count} employees on {date}.',
      postSuccess:'Payroll run approved & posted to the GL',postError:'Payroll run could not be posted',
      colGross:'Gross',colStatutory:'Statutory',colTax:'Tax',colNet:'Net pay',
      statHeadcount:'Headcount',statGross:'Gross pay',statStatutoryTax:'Statutory & tax',statNet:'Net pay',
      clickForPayslip:'click a row for the payslip',totalsLabel:'Totals · {n} staff',
      payslipTitle:'Payslip',payslipCrumb:'Payslips',
      earningsTitle:'Earnings',deductionsTitle:'Deductions',employerContribTitle:'Employer contributions',
      notDeducted:'not deducted from pay',grossEarnings:'Gross earnings',totalDeductions:'Total deductions',
      totalEmployerCost:'Total employer cost',netPayTitle:'Net pay',grossLabel:'Gross',
      deductionsLabel:'Deductions',netPayLabel:'Net pay',netPayDisbursed:'Net pay disbursed',
      creditedOn:'Credited on {date}.',ytdTitle:'Year to date',grossYtd:'Gross YTD',
      statutoryYtd:'Statutory YTD',taxYtd:'Tax YTD',relatedEmployee:'Employee profile',relatedRun:'Payroll run',
      backToPayroll:'Back to payroll',noPayslipYet:'No payslip found',
      noPayslipBody:'No posted payroll line exists for this employee yet.',
      statutoryEmployeeLabelSG:'CPF — employee',statutoryEmployeeLabelMY:'EPF — employee',
      statutoryEmployerLabelSG:'CPF — employer',statutoryEmployerLabelMY:'EPF — employer',
      additionalLabelSG:'SDL',additionalLabelMY:'SOCSO + EIS',incomeTaxLabel:'PCB income tax',
      baseSalaryLabel:'Base salary',fieldRunNo:'Run no.',
      encashmentButton:'Approve leave encashment',encashmentTitle:'Leave encashment approval',
      encashmentDescription:'Convert approved, available paid leave into an immutable Payroll earning.',
      encashmentEmployee:'Employee',encashmentLeaveType:'Paid leave type',encashmentDays:'Days',
      encashmentDate:'Effective date',encashmentNote:'Approval note',encashmentNotePlaceholder:'Optional audit note',
      encashmentApprove:'Approve encashment',encashmentCreated:'Leave encashment approved for Payroll',
      encashmentError:'Leave encashment could not be approved',selectRequired:'Select an employee and leave type.',
      leaveEarningsLabel:'Leave earnings',unpaidLeaveDeductionLabel:'Unpaid leave deduction',
      leaveTraceTitle:'Leave-to-payroll trace',leaveSourceCount:'{count} immutable source(s)',
    },
    ms:{
      statusActive:'Aktif',statusOnLeave:'Bercuti',statusInactive:'Tidak aktif',
      employeeProfileTitle:'Profil pekerja',
      employeeProfileDescription:'Semak fakta pekerjaan, hubungan dan cuti semasa untuk pekerja yang dipilih.',
      typeParttime:'Sambilan',typeIntern:'Intern',
      personalContact:'Peribadi & hubungan',fieldEmail:'E-mel',fieldPhone:'Telefon',noPhone:'Tiada rekod',
      fieldDept:'Jabatan',fieldEmployment:'Pekerjaan',fieldJoined:'Tarikh sertai',fieldManager:'Melapor kepada',
      noManager:'— (paling atas dalam struktur)',
      leaveBalanceTitle:'Baki cuti',annualLeaveLabel:'Cuti tahunan',
      annualLeaveUsed:'{used} daripada {total} hari digunakan tahun ini',
      annualLeaveRemaining:'{remaining} daripada {total} hari berbaki',
      recentLeaveTitle:'Permohonan cuti',noLeaveRequests:'Belum ada permohonan cuti.',
      noEmployeeFound:'Pekerja tidak ditemui',noEmployeeBody:'Belum ada pekerja untuk syarikat aktif.',
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
      leaveApprovalTitle:'Kelulusan Cuti',leaveApprovalDescription:'Semak dan putuskan permohonan cuti untuk syarikat aktif.',
      kpiPendingRequests:'Permohonan tertunda',kpiPendingDays:'Hari tertunda',
      kpiApprovedRequests:'Diluluskan',kpiRejectedRequests:'Ditolak',
      colDates:'Tarikh',colLeaveType:'Jenis cuti',colDays:'Hari',
      requestedDays:'Dimohon',fromDate:'Dari',toDate:'Hingga',decidedAt:'Diputuskan',
      employeeReason:'Sebab pekerja',hrDecisionReason:'Sebab keputusan HR',
      selectLeaveRequest:'Pilih permohonan cuti',
      selectLeaveRequestBody:'Pilih permohonan daripada senarai untuk menyemak butirannya.',
      noLeaveRequestsBody:'Tiada permohonan sepadan dengan status yang dipilih.',
      unknownEmployee:'Pekerja tidak diketahui',daysValue:'{count} hari',
      filterAllStatus:'Semua',statusPending:'Belum diputuskan',statusApproved:'Diluluskan',statusRejected:'Ditolak',
      approve:'Luluskan',reject:'Tolak',cancel:'Batal',rejectTitle:'Tolak cuti — {name}',
      rejectReasonLabel:'Sebab',rejectReasonPlaceholder:'Dikongsi dengan pekerja.',
      rejectReasonRequired:'Sebab diperlukan untuk menolak.',
      approvedToast:'Cuti {name} diluluskan',rejectedToast:'Cuti {name} ditolak',
      actionError:'Permohonan cuti ini tidak dapat dikemas kini',
      fieldBaseSalary:'Gaji asas (bulanan)',baseSalaryRequired:'Gaji asas mesti lebih daripada 0',
      payrollRunTitle:'Larian Gaji',payrollCrumb:'Gaji',
      payrollRunDescription:'Cipta, semak dan pos larian gaji untuk syarikat aktif.',
      kpiTotalRuns:'Jumlah larian',kpiDraftRuns:'Larian draf',kpiPostedRuns:'Larian dipos',kpiLatestNet:'Gaji bersih terkini',
      filterAllRuns:'Semua',statusDraft:'Draf',statusPosted:'Dipos',
      colRun:'Larian',colPeriod:'Tempoh gaji',colPayDate:'Tarikh bayaran',colHeadcount:'Bilangan pekerja',colStatus:'Status',
      selectPayrollRun:'Pilih larian gaji',selectPayrollRunBody:'Pilih larian daripada daftar untuk menyemak butirannya.',
      noPayrollLines:'Tiada baris gaji',noPayrollLinesBody:'Larian gaji ini tidak mempunyai baris gaji pekerja.',
      employeePayrollLines:'Baris gaji pekerja',
      newRunDescription:'Tetapkan tempoh gaji dan tarikh bayaran. Pekerja aktif dikira oleh arahan gaji kanonik.',
      createRun:'Cipta larian gaji',creatingRun:'Mencipta…',
      dateRequired:'Lengkapkan semua tarikh gaji.',invalidPayrollPeriod:'Akhir tempoh tidak boleh lebih awal daripada mula tempoh.',
      fieldPeriodStart:'Mula tempoh',fieldPeriodEnd:'Akhir tempoh',fieldPayDate:'Tarikh bayaran',
      selectRun:'Larian gaji',newRunButton:'Larian gaji baharu',postButton:'Luluskan & kunci larian',
      noRunYet:'Belum ada larian gaji',noRunBody:'Cipta larian gaji untuk mengira gaji setiap pekerja aktif.',
      runCreated:'Larian gaji dicipta',runError:'Larian gaji tidak dapat dicipta',
      postConfirmTitle:'Luluskan & kunci larian gaji ini?',
      postConfirmBody:'Mengunci akan menyiarkan jurnal gaji (perbelanjaan gaji, caruman statutori & cukai) dan melepaskan {amount} gaji bersih kepada {count} pekerja pada {date}.',
      postSuccess:'Larian gaji diluluskan & disiarkan ke GL',postError:'Larian gaji tidak dapat disiarkan',
      colGross:'Kasar',colStatutory:'Statutori',colTax:'Cukai',colNet:'Gaji bersih',
      statHeadcount:'Bilangan pekerja',statGross:'Gaji kasar',statStatutoryTax:'Statutori & cukai',statNet:'Gaji bersih',
      clickForPayslip:'klik baris untuk slip gaji',totalsLabel:'Jumlah · {n} pekerja',
      payslipTitle:'Slip Gaji',payslipCrumb:'Slip gaji',
      earningsTitle:'Pendapatan',deductionsTitle:'Potongan',employerContribTitle:'Caruman majikan',
      notDeducted:'tidak dipotong daripada gaji',grossEarnings:'Jumlah pendapatan',totalDeductions:'Jumlah potongan',
      totalEmployerCost:'Jumlah kos majikan',netPayTitle:'Gaji bersih',grossLabel:'Kasar',
      deductionsLabel:'Potongan',netPayLabel:'Gaji bersih',netPayDisbursed:'Gaji bersih dibayar',
      creditedOn:'Dikreditkan pada {date}.',ytdTitle:'Tahun setakat ini',grossYtd:'Kasar YTD',
      statutoryYtd:'Statutori YTD',taxYtd:'Cukai YTD',relatedEmployee:'Profil pekerja',relatedRun:'Larian gaji',
      backToPayroll:'Kembali ke gaji',noPayslipYet:'Slip gaji tidak dijumpai',
      noPayslipBody:'Belum ada baris gaji yang disiarkan untuk pekerja ini.',
      statutoryEmployeeLabelSG:'CPF — pekerja',statutoryEmployeeLabelMY:'KWSP — pekerja',
      statutoryEmployerLabelSG:'CPF — majikan',statutoryEmployerLabelMY:'KWSP — majikan',
      additionalLabelSG:'SDL',additionalLabelMY:'PERKESO + SIP',incomeTaxLabel:'Cukai pendapatan PCB',
      baseSalaryLabel:'Gaji asas',fieldRunNo:'No. larian',
      encashmentButton:'Luluskan penunaian cuti',encashmentTitle:'Kelulusan penunaian cuti',
      encashmentDescription:'Tukar cuti berbayar yang diluluskan dan tersedia kepada pendapatan Gaji yang kekal.',
      encashmentEmployee:'Pekerja',encashmentLeaveType:'Jenis cuti berbayar',encashmentDays:'Hari',
      encashmentDate:'Tarikh berkuat kuasa',encashmentNote:'Nota kelulusan',encashmentNotePlaceholder:'Nota audit pilihan',
      encashmentApprove:'Luluskan penunaian',encashmentCreated:'Penunaian cuti diluluskan untuk Gaji',
      encashmentError:'Penunaian cuti tidak dapat diluluskan',selectRequired:'Pilih pekerja dan jenis cuti.',
      leaveEarningsLabel:'Pendapatan cuti',unpaidLeaveDeductionLabel:'Potongan cuti tanpa gaji',
      leaveTraceTitle:'Jejak cuti ke gaji',leaveSourceCount:'{count} sumber kekal',
    },
    zh:{
      statusActive:'在职',statusOnLeave:'休假中',statusInactive:'已离职',
      employeeProfileTitle:'员工档案',
      employeeProfileDescription:'查看所选员工当前的雇佣、联系方式和请假资料。',
      typeParttime:'兼职',typeIntern:'实习',
      personalContact:'个人与联系方式',fieldEmail:'邮箱',fieldPhone:'电话',noPhone:'未登记',
      fieldDept:'部门',fieldEmployment:'雇佣类型',fieldJoined:'入职日期',fieldManager:'汇报对象',
      noManager:'—(汇报链顶端)',
      leaveBalanceTitle:'假期余额',annualLeaveLabel:'年假',
      annualLeaveUsed:'今年已使用 {used}/{total} 天',
      annualLeaveRemaining:'剩余 {remaining}/{total} 天',
      recentLeaveTitle:'请假记录',noLeaveRequests:'暂无请假记录。',
      noEmployeeFound:'未找到员工',noEmployeeBody:'当前公司尚无员工。',
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
      leaveApprovalTitle:'请假审批',leaveApprovalDescription:'查看并处理当前公司的员工请假申请。',
      kpiPendingRequests:'待审批申请',kpiPendingDays:'待审批天数',
      kpiApprovedRequests:'已批准',kpiRejectedRequests:'已拒绝',
      colDates:'日期',colLeaveType:'假期类型',colDays:'天数',
      requestedDays:'申请天数',fromDate:'开始日期',toDate:'结束日期',decidedAt:'决定日期',
      employeeReason:'员工申请原因',hrDecisionReason:'HR 决定原因',
      selectLeaveRequest:'选择请假申请',
      selectLeaveRequestBody:'请从审批队列中选择一项申请以查看详情。',
      noLeaveRequestsBody:'没有符合所选状态的请假申请。',
      unknownEmployee:'未知员工',daysValue:'{count} 天',
      filterAllStatus:'全部',statusPending:'待审批',statusApproved:'已批准',statusRejected:'已拒绝',
      approve:'批准',reject:'拒绝',cancel:'取消',rejectTitle:'拒绝请假 — {name}',
      rejectReasonLabel:'原因',rejectReasonPlaceholder:'将告知员工。',
      rejectReasonRequired:'拒绝时必须填写原因。',
      approvedToast:'已批准 {name} 的请假',rejectedToast:'已拒绝 {name} 的请假',
      actionError:'无法更新此请假申请',
      fieldBaseSalary:'底薪(每月)',baseSalaryRequired:'底薪必须大于 0',
      payrollRunTitle:'薪资运行',payrollCrumb:'薪资',
      payrollRunDescription:'创建、检查并过账当前公司的薪资批次。',
      kpiTotalRuns:'批次总数',kpiDraftRuns:'草稿批次',kpiPostedRuns:'已过账批次',kpiLatestNet:'最新实发工资',
      filterAllRuns:'全部',statusDraft:'草稿',statusPosted:'已过账',
      colRun:'批次',colPeriod:'薪资周期',colPayDate:'发薪日期',colHeadcount:'员工人数',colStatus:'状态',
      selectPayrollRun:'选择薪资批次',selectPayrollRunBody:'请从批次列表选择一项以查看详情。',
      noPayrollLines:'暂无薪资明细',noPayrollLinesBody:'此薪资批次没有员工薪资明细。',
      employeePayrollLines:'员工薪资明细',
      newRunDescription:'设置薪资周期和发薪日期；系统将通过正式薪资命令计算所有在职员工。',
      createRun:'创建薪资批次',creatingRun:'创建中…',
      dateRequired:'请填写全部薪资日期。',invalidPayrollPeriod:'周期结束日期不得早于开始日期。',
      fieldPeriodStart:'周期开始',fieldPeriodEnd:'周期结束',fieldPayDate:'发薪日期',
      selectRun:'薪资批次',newRunButton:'新建薪资批次',postButton:'批准并锁定',
      noRunYet:'暂无薪资批次',noRunBody:'创建一个薪资批次,为每位在职员工计算薪资。',
      runCreated:'薪资批次已创建',runError:'薪资批次创建失败',
      postConfirmTitle:'批准并锁定此薪资批次?',
      postConfirmBody:'锁定后将过账薪资凭证(薪资费用、法定公积金/税金应付),并在 {date} 向 {count} 名员工发放共 {amount} 的实发工资。',
      postSuccess:'薪资批次已批准并过账至总账',postError:'薪资批次过账失败',
      colGross:'应发',colStatutory:'公积金',colTax:'税金',colNet:'实发',
      statHeadcount:'在职人数',statGross:'应发工资',statStatutoryTax:'公积金及税金',statNet:'实发工资',
      clickForPayslip:'点击行查看工资单',totalsLabel:'合计 · {n} 名员工',
      payslipTitle:'工资单',payslipCrumb:'工资单',
      earningsTitle:'收入',deductionsTitle:'扣除项',employerContribTitle:'雇主缴款',
      notDeducted:'不从工资中扣除',grossEarnings:'应发合计',totalDeductions:'扣除合计',
      totalEmployerCost:'雇主成本合计',netPayTitle:'实发工资',grossLabel:'应发',
      deductionsLabel:'扣除项',netPayLabel:'实发工资',netPayDisbursed:'实发工资已发放',
      creditedOn:'{date} 到账。',ytdTitle:'年初至今',grossYtd:'应发(年累计)',
      statutoryYtd:'公积金(年累计)',taxYtd:'税金(年累计)',relatedEmployee:'员工档案',relatedRun:'薪资批次',
      backToPayroll:'返回薪资',noPayslipYet:'未找到工资单',
      noPayslipBody:'该员工尚无已过账的薪资记录。',
      statutoryEmployeeLabelSG:'CPF — 员工部分',statutoryEmployeeLabelMY:'EPF — 员工部分',
      statutoryEmployerLabelSG:'CPF — 雇主部分',statutoryEmployerLabelMY:'EPF — 雇主部分',
      additionalLabelSG:'技能发展税(SDL)',additionalLabelMY:'社险 + 就业保险(SOCSO+EIS)',incomeTaxLabel:'PCB 预扣所得税',
      baseSalaryLabel:'底薪',fieldRunNo:'运算编号',
      encashmentButton:'批准假期折现',encashmentTitle:'假期折现审批',
      encashmentDescription:'把已获准且可用的带薪假期转换为不可篡改的薪资收入。',
      encashmentEmployee:'员工',encashmentLeaveType:'带薪假期类型',encashmentDays:'天数',
      encashmentDate:'生效日期',encashmentNote:'审批备注',encashmentNotePlaceholder:'可选审计备注',
      encashmentApprove:'批准折现',encashmentCreated:'假期折现已批准并送入薪资',
      encashmentError:'无法批准假期折现',selectRequired:'请选择员工与假期类型。',
      leaveEarningsLabel:'假期收入',unpaidLeaveDeductionLabel:'无薪假扣款',
      leaveTraceTitle:'假期至薪资追踪',leaveSourceCount:'{count} 个不可变来源',
    },
    ja:{
      statusActive:'在籍',statusOnLeave:'休暇中',statusInactive:'退職',
      employeeProfileTitle:'従業員プロフィール',
      employeeProfileDescription:'選択した従業員の現在の雇用、連絡先、休暇情報を確認します。',
      typeParttime:'パートタイム',typeIntern:'インターン',
      personalContact:'個人情報・連絡先',fieldEmail:'メール',fieldPhone:'電話',noPhone:'未登録',
      fieldDept:'部署',fieldEmployment:'雇用形態',fieldJoined:'入社日',fieldManager:'上長',
      noManager:'—(組織の最上位)',
      leaveBalanceTitle:'休暇残日数',annualLeaveLabel:'年次有給休暇',
      annualLeaveUsed:'今年 {total} 日中 {used} 日使用済み',
      annualLeaveRemaining:'{total} 日中 {remaining} 日残り',
      recentLeaveTitle:'休暇申請',noLeaveRequests:'休暇申請はまだありません。',
      noEmployeeFound:'従業員が見つかりません',noEmployeeBody:'現在の会社には従業員がまだいません。',
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
      leaveApprovalTitle:'休暇承認',leaveApprovalDescription:'現在の会社の休暇申請を確認して処理します。',
      kpiPendingRequests:'承認待ち申請',kpiPendingDays:'承認待ち日数',
      kpiApprovedRequests:'承認済み',kpiRejectedRequests:'却下',
      colDates:'日付',colLeaveType:'休暇種別',colDays:'日数',
      requestedDays:'申請日数',fromDate:'開始日',toDate:'終了日',decidedAt:'決定日',
      employeeReason:'従業員の理由',hrDecisionReason:'HR の決定理由',
      selectLeaveRequest:'休暇申請を選択',
      selectLeaveRequestBody:'キューから申請を選択して詳細を確認してください。',
      noLeaveRequestsBody:'選択したステータスに一致する申請はありません。',
      unknownEmployee:'不明な従業員',daysValue:'{count} 日',
      filterAllStatus:'すべて',statusPending:'承認待ち',statusApproved:'承認済み',statusRejected:'却下',
      approve:'承認',reject:'却下',cancel:'キャンセル',rejectTitle:'休暇を却下 — {name}',
      rejectReasonLabel:'理由',rejectReasonPlaceholder:'従業員に共有されます。',
      rejectReasonRequired:'却下するには理由が必要です。',
      approvedToast:'{name} の休暇を承認しました',rejectedToast:'{name} の休暇を却下しました',
      actionError:'この休暇申請を更新できませんでした',
      fieldBaseSalary:'基本給(月額)',baseSalaryRequired:'基本給は0より大きい必要があります',
      payrollRunTitle:'給与計算',payrollCrumb:'給与',
      payrollRunDescription:'現在の会社の給与計算バッチを作成、確認、転記します。',
      kpiTotalRuns:'バッチ総数',kpiDraftRuns:'下書きバッチ',kpiPostedRuns:'転記済みバッチ',kpiLatestNet:'最新手取り額',
      filterAllRuns:'すべて',statusDraft:'下書き',statusPosted:'転記済み',
      colRun:'バッチ',colPeriod:'給与期間',colPayDate:'支給日',colHeadcount:'在籍人数',colStatus:'ステータス',
      selectPayrollRun:'給与計算バッチを選択',selectPayrollRunBody:'台帳からバッチを選択して詳細を確認してください。',
      noPayrollLines:'給与明細行がありません',noPayrollLinesBody:'この給与計算バッチには従業員の給与明細行がありません。',
      employeePayrollLines:'従業員給与明細',
      newRunDescription:'給与期間と支給日を設定します。在籍従業員は標準給与コマンドで計算されます。',
      createRun:'給与計算バッチを作成',creatingRun:'作成中…',
      dateRequired:'すべての給与日付を入力してください。',invalidPayrollPeriod:'期間終了日は期間開始日より前にできません。',
      fieldPeriodStart:'期間開始',fieldPeriodEnd:'期間終了',fieldPayDate:'支給日',
      selectRun:'給与計算バッチ',newRunButton:'新規給与計算',postButton:'承認してロック',
      noRunYet:'給与計算バッチはまだありません',noRunBody:'在籍中の全従業員の給与を計算するバッチを作成します。',
      runCreated:'給与計算バッチを作成しました',runError:'給与計算バッチを作成できませんでした',
      postConfirmTitle:'この給与計算バッチを承認してロックしますか?',
      postConfirmBody:'ロックすると給与仕訳(給与費用、法定拠出金・税金の未払金)が計上され、{date} に {count} 名の従業員へ合計 {amount} の手取り額が支給されます。',
      postSuccess:'給与計算バッチを承認し総勘定元帳に計上しました',postError:'給与計算バッチを計上できませんでした',
      colGross:'総支給額',colStatutory:'法定拠出金',colTax:'税金',colNet:'手取り額',
      statHeadcount:'在籍人数',statGross:'総支給額',statStatutoryTax:'法定拠出金・税金',statNet:'手取り額',
      clickForPayslip:'行をクリックすると給与明細を表示',totalsLabel:'合計 · {n} 名',
      payslipTitle:'給与明細',payslipCrumb:'給与明細',
      earningsTitle:'支給項目',deductionsTitle:'控除項目',employerContribTitle:'雇用主負担分',
      notDeducted:'給与から控除されません',grossEarnings:'総支給額',totalDeductions:'控除合計',
      totalEmployerCost:'雇用主負担合計',netPayTitle:'手取り額',grossLabel:'総支給額',
      deductionsLabel:'控除',netPayLabel:'手取り額',netPayDisbursed:'手取り額を支給済み',
      creditedOn:'{date} に入金。',ytdTitle:'年初来累計',grossYtd:'総支給額(累計)',
      statutoryYtd:'法定拠出金(累計)',taxYtd:'税金(累計)',relatedEmployee:'従業員プロフィール',relatedRun:'給与計算バッチ',
      backToPayroll:'給与計算に戻る',noPayslipYet:'給与明細が見つかりません',
      noPayslipBody:'この従業員の計上済み給与明細はまだありません。',
      statutoryEmployeeLabelSG:'CPF(従業員負担分)',statutoryEmployeeLabelMY:'EPF(従業員負担分)',
      statutoryEmployerLabelSG:'CPF(雇用主負担分)',statutoryEmployerLabelMY:'EPF(雇用主負担分)',
      additionalLabelSG:'技能開発税(SDL)',additionalLabelMY:'社会保障 + 雇用保険(SOCSO+EIS)',incomeTaxLabel:'PCB源泉徴収税',
      baseSalaryLabel:'基本給',fieldRunNo:'実行番号',
      encashmentButton:'休暇換金を承認',encashmentTitle:'休暇換金の承認',
      encashmentDescription:'承認済みの利用可能な有給休暇を変更不可の給与収入へ変換します。',
      encashmentEmployee:'従業員',encashmentLeaveType:'有給休暇種別',encashmentDays:'日数',
      encashmentDate:'適用日',encashmentNote:'承認メモ',encashmentNotePlaceholder:'任意の監査メモ',
      encashmentApprove:'換金を承認',encashmentCreated:'休暇換金を給与へ承認しました',
      encashmentError:'休暇換金を承認できませんでした',selectRequired:'従業員と休暇種別を選択してください。',
      leaveEarningsLabel:'休暇収入',unpaidLeaveDeductionLabel:'無給休暇控除',
      leaveTraceTitle:'休暇から給与への追跡',leaveSourceCount:'変更不可のソース {count} 件',
    },
    vi:{
      statusActive:'Đang làm việc',statusOnLeave:'Đang nghỉ phép',statusInactive:'Đã nghỉ việc',
      employeeProfileTitle:'Hồ sơ nhân viên',
      employeeProfileDescription:'Xem thông tin việc làm, liên hệ và nghỉ phép hiện tại của nhân viên đã chọn.',
      typeParttime:'Bán thời gian',typeIntern:'Thực tập',
      personalContact:'Thông tin cá nhân & liên hệ',fieldEmail:'Email',fieldPhone:'Điện thoại',noPhone:'Chưa có',
      fieldDept:'Phòng ban',fieldEmployment:'Loại hình làm việc',fieldJoined:'Ngày vào làm',fieldManager:'Báo cáo cho',
      noManager:'— (cấp cao nhất)',
      leaveBalanceTitle:'Số ngày phép còn lại',annualLeaveLabel:'Phép năm',
      annualLeaveUsed:'Đã dùng {used}/{total} ngày trong năm nay',
      annualLeaveRemaining:'Còn {remaining}/{total} ngày',
      recentLeaveTitle:'Đơn xin nghỉ phép',noLeaveRequests:'Chưa có đơn xin nghỉ phép nào.',
      noEmployeeFound:'Không tìm thấy nhân viên',noEmployeeBody:'Công ty hiện tại chưa có nhân viên.',
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
      leaveApprovalTitle:'Phê duyệt nghỉ phép',leaveApprovalDescription:'Xem xét và quyết định đơn nghỉ phép của công ty hiện tại.',
      kpiPendingRequests:'Đơn chờ duyệt',kpiPendingDays:'Ngày chờ duyệt',
      kpiApprovedRequests:'Đã duyệt',kpiRejectedRequests:'Đã từ chối',
      colDates:'Ngày',colLeaveType:'Loại nghỉ phép',colDays:'Số ngày',
      requestedDays:'Đã yêu cầu',fromDate:'Từ ngày',toDate:'Đến ngày',decidedAt:'Ngày quyết định',
      employeeReason:'Lý do của nhân viên',hrDecisionReason:'Lý do quyết định của HR',
      selectLeaveRequest:'Chọn đơn nghỉ phép',
      selectLeaveRequestBody:'Chọn một đơn trong hàng đợi để xem chi tiết.',
      noLeaveRequestsBody:'Không có đơn nào khớp với trạng thái đã chọn.',
      unknownEmployee:'Nhân viên không xác định',daysValue:'{count} ngày',
      filterAllStatus:'Tất cả',statusPending:'Chờ duyệt',statusApproved:'Đã duyệt',statusRejected:'Đã từ chối',
      approve:'Duyệt',reject:'Từ chối',cancel:'Hủy',rejectTitle:'Từ chối nghỉ phép — {name}',
      rejectReasonLabel:'Lý do',rejectReasonPlaceholder:'Sẽ được chia sẻ với nhân viên.',
      rejectReasonRequired:'Cần nhập lý do để từ chối.',
      approvedToast:'Đã duyệt đơn nghỉ phép của {name}',rejectedToast:'Đã từ chối đơn nghỉ phép của {name}',
      actionError:'Không thể cập nhật đơn nghỉ phép này',
      fieldBaseSalary:'Lương cơ bản (hàng tháng)',baseSalaryRequired:'Lương cơ bản phải lớn hơn 0',
      payrollRunTitle:'Đợt Tính Lương',payrollCrumb:'Lương',
      payrollRunDescription:'Tạo, xem xét và ghi sổ các đợt tính lương cho công ty hiện tại.',
      kpiTotalRuns:'Tổng số đợt',kpiDraftRuns:'Đợt nháp',kpiPostedRuns:'Đợt đã ghi sổ',kpiLatestNet:'Lương thực nhận mới nhất',
      filterAllRuns:'Tất cả',statusDraft:'Nháp',statusPosted:'Đã ghi sổ',
      colRun:'Đợt',colPeriod:'Kỳ lương',colPayDate:'Ngày trả lương',colHeadcount:'Số nhân viên',colStatus:'Trạng thái',
      selectPayrollRun:'Chọn đợt tính lương',selectPayrollRunBody:'Chọn một đợt trong sổ đăng ký để xem chi tiết.',
      noPayrollLines:'Không có dòng lương',noPayrollLinesBody:'Đợt tính lương này không có dòng lương nhân viên.',
      employeePayrollLines:'Dòng lương nhân viên',
      newRunDescription:'Đặt kỳ lương và ngày trả lương. Nhân viên đang làm việc được tính bởi lệnh tính lương chuẩn.',
      createRun:'Tạo đợt tính lương',creatingRun:'Đang tạo…',
      dateRequired:'Hãy nhập đầy đủ các ngày tính lương.',invalidPayrollPeriod:'Ngày kết thúc kỳ không được trước ngày bắt đầu.',
      fieldPeriodStart:'Bắt đầu kỳ',fieldPeriodEnd:'Kết thúc kỳ',fieldPayDate:'Ngày trả lương',
      selectRun:'Đợt tính lương',newRunButton:'Đợt tính lương mới',postButton:'Duyệt & khóa đợt',
      noRunYet:'Chưa có đợt tính lương',noRunBody:'Tạo một đợt tính lương để tính lương cho mọi nhân viên đang làm việc.',
      runCreated:'Đã tạo đợt tính lương',runError:'Không thể tạo đợt tính lương',
      postConfirmTitle:'Duyệt & khóa đợt tính lương này?',
      postConfirmBody:'Khóa sẽ hạch toán bút toán lương (chi phí lương, các khoản đóng góp bắt buộc & thuế phải trả) và giải ngân {amount} lương thực nhận cho {count} nhân viên vào ngày {date}.',
      postSuccess:'Đợt tính lương đã được duyệt & hạch toán vào sổ cái',postError:'Không thể hạch toán đợt tính lương',
      colGross:'Tổng lương',colStatutory:'Bảo hiểm/Quỹ',colTax:'Thuế',colNet:'Thực nhận',
      statHeadcount:'Số nhân viên',statGross:'Tổng lương',statStatutoryTax:'Bảo hiểm & thuế',statNet:'Lương thực nhận',
      clickForPayslip:'nhấp vào dòng để xem phiếu lương',totalsLabel:'Tổng cộng · {n} nhân viên',
      payslipTitle:'Phiếu Lương',payslipCrumb:'Phiếu lương',
      earningsTitle:'Thu nhập',deductionsTitle:'Khoản khấu trừ',employerContribTitle:'Đóng góp của công ty',
      notDeducted:'không khấu trừ vào lương',grossEarnings:'Tổng thu nhập',totalDeductions:'Tổng khấu trừ',
      totalEmployerCost:'Tổng chi phí công ty',netPayTitle:'Lương thực nhận',grossLabel:'Tổng lương',
      deductionsLabel:'Khấu trừ',netPayLabel:'Lương thực nhận',netPayDisbursed:'Đã giải ngân lương thực nhận',
      creditedOn:'Đã chuyển khoản ngày {date}.',ytdTitle:'Lũy kế từ đầu năm',grossYtd:'Tổng lương lũy kế',
      statutoryYtd:'Bảo hiểm/Quỹ lũy kế',taxYtd:'Thuế lũy kế',relatedEmployee:'Hồ sơ nhân viên',relatedRun:'Đợt tính lương',
      backToPayroll:'Quay lại trang lương',noPayslipYet:'Không tìm thấy phiếu lương',
      noPayslipBody:'Nhân viên này chưa có dòng lương nào được hạch toán.',
      statutoryEmployeeLabelSG:'CPF — phần nhân viên',statutoryEmployeeLabelMY:'EPF — phần nhân viên',
      statutoryEmployerLabelSG:'CPF — phần công ty',statutoryEmployerLabelMY:'EPF — phần công ty',
      additionalLabelSG:'SDL',additionalLabelMY:'SOCSO + EIS',incomeTaxLabel:'Thuế thu nhập PCB',
      baseSalaryLabel:'Lương cơ bản',fieldRunNo:'Số đợt',
      encashmentButton:'Duyệt quy đổi phép',encashmentTitle:'Phê duyệt quy đổi phép',
      encashmentDescription:'Chuyển phép có lương đã duyệt và còn khả dụng thành khoản thu nhập lương bất biến.',
      encashmentEmployee:'Nhân viên',encashmentLeaveType:'Loại phép có lương',encashmentDays:'Số ngày',
      encashmentDate:'Ngày hiệu lực',encashmentNote:'Ghi chú phê duyệt',encashmentNotePlaceholder:'Ghi chú kiểm toán tùy chọn',
      encashmentApprove:'Duyệt quy đổi',encashmentCreated:'Đã duyệt quy đổi phép vào bảng lương',
      encashmentError:'Không thể duyệt quy đổi phép',selectRequired:'Chọn nhân viên và loại phép.',
      leaveEarningsLabel:'Thu nhập từ phép',unpaidLeaveDeductionLabel:'Khấu trừ nghỉ không lương',
      leaveTraceTitle:'Dấu vết phép đến lương',leaveSourceCount:'{count} nguồn bất biến',
    },
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

function employeeAccountCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{title:'Employee account',none:'No login account',preactivated:'Awaiting activation',active:'Active account',offboarded:'Offboarded',create:'Create account',username:'Username',createHint:'A one-time password will be encrypted and can be revealed until activation.',reveal:'Reveal one-time password',temporary:'One-time password',expires:'Expires',reset:'Reset password',resetConfirm:'Reset this employee to a new one-time password?',offboard:'Offboard',offboardTitle:'Offboard employee',handoff:'Transfer current work to',reason:'Reason',confirmOffboard:'Void access & transfer work',copy:'Copy password',copied:'Password copied',created:'Employee account created',resetDone:'New one-time password created',offboardedDone:'Access revoked and current work transferred',error:'Employee account action failed'},
    ms:{title:'Akaun pekerja',none:'Tiada akaun log masuk',preactivated:'Menunggu pengaktifan',active:'Akaun aktif',offboarded:'Telah ditamatkan',create:'Cipta akaun',username:'Nama pengguna',createHint:'Kata laluan sekali akan disulitkan dan boleh dilihat sehingga pengaktifan.',reveal:'Lihat kata laluan sekali',temporary:'Kata laluan sekali',expires:'Tamat tempoh',reset:'Tetapkan semula kata laluan',resetConfirm:'Tetapkan kata laluan sekali baharu untuk pekerja ini?',offboard:'Tamatkan pekerja',offboardTitle:'Tamatkan akses pekerja',handoff:'Pindahkan kerja semasa kepada',reason:'Sebab',confirmOffboard:'Void akses & pindahkan kerja',copy:'Salin kata laluan',copied:'Kata laluan disalin',created:'Akaun pekerja dicipta',resetDone:'Kata laluan sekali baharu dicipta',offboardedDone:'Akses dibatalkan dan kerja semasa dipindahkan',error:'Tindakan akaun pekerja gagal'},
    zh:{title:'员工账号',none:'尚未建立登录账号',preactivated:'等待首次激活',active:'账号有效',offboarded:'已离职停用',create:'建立账号',username:'用户名',createHint:'一次性密码会加密保存，并只可在激活前揭示。',reveal:'揭示一次性密码',temporary:'一次性密码',expires:'有效期至',reset:'重置密码',resetConfirm:'为此员工生成新的一次性密码？',offboard:'办理离职',offboardTitle:'员工离职与工作交接',handoff:'将当前工作转交给',reason:'离职／交接原因',confirmOffboard:'Void 访问权并转交工作',copy:'复制密码',copied:'密码已复制',created:'员工账号已建立',resetDone:'新一次性密码已生成',offboardedDone:'访问权已撤销，当前工作已完成交接',error:'员工账号操作失败'},
    ja:{title:'従業員アカウント',none:'ログインアカウントなし',preactivated:'有効化待ち',active:'有効なアカウント',offboarded:'退職済み',create:'アカウント作成',username:'ユーザー名',createHint:'ワンタイムパスワードは暗号化され、有効化まで表示できます。',reveal:'ワンタイムパスワードを表示',temporary:'ワンタイムパスワード',expires:'有効期限',reset:'パスワードをリセット',resetConfirm:'新しいワンタイムパスワードを発行しますか？',offboard:'退職処理',offboardTitle:'従業員の退職処理',handoff:'現在の業務を引き継ぐ従業員',reason:'理由',confirmOffboard:'アクセスを Void し業務を移管',copy:'パスワードをコピー',copied:'コピーしました',created:'アカウントを作成しました',resetDone:'新しいワンタイムパスワードを作成しました',offboardedDone:'アクセスを無効化し業務を移管しました',error:'アカウント操作に失敗しました'},
    vi:{title:'Tài khoản nhân viên',none:'Chưa có tài khoản đăng nhập',preactivated:'Chờ kích hoạt',active:'Tài khoản đang hoạt động',offboarded:'Đã nghỉ việc',create:'Tạo tài khoản',username:'Tên đăng nhập',createHint:'Mật khẩu dùng một lần được mã hóa và chỉ có thể xem trước khi kích hoạt.',reveal:'Xem mật khẩu một lần',temporary:'Mật khẩu một lần',expires:'Hết hạn',reset:'Đặt lại mật khẩu',resetConfirm:'Tạo mật khẩu dùng một lần mới cho nhân viên này?',offboard:'Cho nghỉ việc',offboardTitle:'Cho nhân viên nghỉ việc',handoff:'Chuyển công việc hiện tại cho',reason:'Lý do',confirmOffboard:'Void quyền truy cập & chuyển việc',copy:'Sao chép mật khẩu',copied:'Đã sao chép',created:'Đã tạo tài khoản nhân viên',resetDone:'Đã tạo mật khẩu dùng một lần mới',offboardedDone:'Đã thu hồi truy cập và chuyển công việc',error:'Thao tác tài khoản thất bại'},
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

function myWorkCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{module:'My Work',leaveTitle:'My Leave',leaveDescription:'Review leave requests owned by your signed-in employee profile.',claimsTitle:'My Claims',claimsDescription:'Expense claims will appear here after the governed claim domain is delivered.',receiptsTitle:'My Receipts',receiptsDescription:'Expense evidence will appear here after secure document processing is delivered.',teamTitle:'Team Calendar',teamDescription:'Review privacy-redacted leave facts for your permitted reporting scope.',approvalsTitle:'My Approvals',approvalsDescription:'Review pending team leave. Decision actions arrive with the complete leave workflow.',noIdentity:'Employee self service is unavailable',noIdentityBody:'This account is not linked to an active employee in the current company.',noLeave:'No leave requests',noLeaveBody:'Your employee profile has no leave requests yet.',claimsUnavailable:'Claims are not modelled yet',claimsUnavailableBody:'EPIC-055 will add claim creation, approval and accounting. No sample claims are shown.',receiptsUnavailable:'Receipts are not modelled yet',receiptsUnavailableBody:'EPIC-054 will add secure upload, quarantine and extraction. No sample receipts are shown.',teamUnavailable:'Team access is unavailable',teamUnavailableBody:'Team Calendar and Approvals appear only with an authorised manager scope.',noTeamLeave:'No team leave',noTeamLeaveBody:'No leave requests exist in your permitted reporting scope.',noApprovals:'No pending approvals',noApprovalsBody:'No team leave request is waiting for review.',allowance:'Annual allowance',pending:'Pending',approvedDays:'Approved days',employee:'Employee',department:'Department',dates:'Dates',leaveType:'Leave type',days:'Days',status:'Status',reason:'Reason',privateReason:'Visible only to you',managerPrivacy:'Employee reasons and evidence are hidden in this manager view.',calendarPreview:'Calendar layout arrives with TASK-115; this preview uses the real privacy-redacted team list.',approvalPreview:'Read-only shell: approval commands arrive with TASK-113/114.'},
    ms:{module:'Kerja Saya',leaveTitle:'Cuti Saya',leaveDescription:'Semak permohonan cuti milik profil pekerja yang sedang log masuk.',claimsTitle:'Tuntutan Saya',claimsDescription:'Tuntutan perbelanjaan akan dipaparkan selepas domain tuntutan terkawal siap.',receiptsTitle:'Resit Saya',receiptsDescription:'Bukti perbelanjaan akan dipaparkan selepas pemprosesan dokumen selamat siap.',teamTitle:'Kalendar Pasukan',teamDescription:'Semak fakta cuti yang disunting privasi dalam skop pelaporan dibenarkan.',approvalsTitle:'Kelulusan Saya',approvalsDescription:'Semak cuti pasukan tertunda. Tindakan keputusan hadir bersama aliran cuti lengkap.',noIdentity:'Layan diri pekerja tidak tersedia',noIdentityBody:'Akaun ini tidak dipautkan kepada pekerja aktif dalam syarikat semasa.',noLeave:'Tiada permohonan cuti',noLeaveBody:'Profil pekerja anda belum mempunyai permohonan cuti.',claimsUnavailable:'Tuntutan belum dimodelkan',claimsUnavailableBody:'EPIC-055 akan menambah penciptaan, kelulusan dan perakaunan tuntutan. Tiada data contoh dipaparkan.',receiptsUnavailable:'Resit belum dimodelkan',receiptsUnavailableBody:'EPIC-054 akan menambah muat naik selamat, kuarantin dan pengekstrakan. Tiada data contoh dipaparkan.',teamUnavailable:'Akses pasukan tidak tersedia',teamUnavailableBody:'Kalendar Pasukan dan Kelulusan hanya muncul dengan skop pengurus yang sah.',noTeamLeave:'Tiada cuti pasukan',noTeamLeaveBody:'Tiada permohonan cuti dalam skop pelaporan anda.',noApprovals:'Tiada kelulusan tertunda',noApprovalsBody:'Tiada permohonan cuti pasukan menunggu semakan.',allowance:'Kelayakan tahunan',pending:'Tertunda',approvedDays:'Hari diluluskan',employee:'Pekerja',department:'Jabatan',dates:'Tarikh',leaveType:'Jenis cuti',days:'Hari',status:'Status',reason:'Sebab',privateReason:'Hanya anda boleh melihatnya',managerPrivacy:'Sebab dan bukti pekerja disembunyikan dalam paparan pengurus.',calendarPreview:'Susun atur kalendar hadir dalam TASK-115; pratonton ini menggunakan senarai pasukan sebenar yang disunting privasi.',approvalPreview:'Shell baca sahaja: arahan kelulusan hadir dalam TASK-113/114.'},
    zh:{module:'我的工作',leaveTitle:'我的请假',leaveDescription:'查看当前登录员工本人拥有的请假记录。',claimsTitle:'我的报销',claimsDescription:'受治理的费用申报领域完成后，报销单将在此显示。',receiptsTitle:'我的收据',receiptsDescription:'安全文件处理完成后，费用凭证将在此显示。',teamTitle:'团队日历',teamDescription:'查看授权汇报范围内、已按隐私规则脱敏的请假资料。',approvalsTitle:'我的审批',approvalsDescription:'查看待处理的团队请假；完整请假流程完成后才开放决定操作。',noIdentity:'员工自助不可用',noIdentityBody:'此登录账号未绑定当前公司内的在职员工。',noLeave:'暂无请假记录',noLeaveBody:'你的员工档案目前没有请假记录。',claimsUnavailable:'报销领域尚未建模',claimsUnavailableBody:'EPIC-055 将加入报销建立、审批与会计处理；这里不会显示虚构示例。',receiptsUnavailable:'收据领域尚未建模',receiptsUnavailableBody:'EPIC-054 将加入安全上传、隔离与识别；这里不会显示虚构示例。',teamUnavailable:'团队访问不可用',teamUnavailableBody:'只有具备授权管理范围时才显示团队日历和审批。',noTeamLeave:'暂无团队请假',noTeamLeaveBody:'你的授权汇报范围内没有请假记录。',noApprovals:'暂无待审批事项',noApprovalsBody:'目前没有等待处理的团队请假。',allowance:'年假额度',pending:'待审批',approvedDays:'已批准天数',employee:'员工',department:'部门',dates:'日期',leaveType:'假期类型',days:'天数',status:'状态',reason:'原因',privateReason:'仅你本人可见',managerPrivacy:'此主管视图不会显示员工原因及证明文件。',calendarPreview:'TASK-115 才会提供日历布局；本预览使用真实、已脱敏的团队列表。',approvalPreview:'只读入口：审批命令将在 TASK-113/114 提供。'},
    ja:{module:'マイワーク',leaveTitle:'自分の休暇',leaveDescription:'サインイン中の従業員プロフィールに属する休暇申請を確認します。',claimsTitle:'自分の経費申請',claimsDescription:'統制された経費申請ドメインの提供後、ここに表示されます。',receiptsTitle:'自分の領収書',receiptsDescription:'安全な文書処理の提供後、経費証憑がここに表示されます。',teamTitle:'チームカレンダー',teamDescription:'許可された報告範囲の、プライバシー編集済み休暇情報を確認します。',approvalsTitle:'自分の承認',approvalsDescription:'保留中のチーム休暇を確認します。決定操作は完全な休暇ワークフローで提供します。',noIdentity:'従業員セルフサービスを利用できません',noIdentityBody:'このアカウントは現在の会社の有効な従業員に紐付いていません。',noLeave:'休暇申請はありません',noLeaveBody:'従業員プロフィールにはまだ休暇申請がありません。',claimsUnavailable:'経費申請は未モデルです',claimsUnavailableBody:'EPIC-055 で作成・承認・会計を追加します。サンプル申請は表示しません。',receiptsUnavailable:'領収書は未モデルです',receiptsUnavailableBody:'EPIC-054 で安全なアップロード・隔離・抽出を追加します。サンプルは表示しません。',teamUnavailable:'チームアクセスを利用できません',teamUnavailableBody:'権限のある管理範囲がある場合のみチーム機能を表示します。',noTeamLeave:'チーム休暇はありません',noTeamLeaveBody:'許可された報告範囲に休暇申請はありません。',noApprovals:'保留中の承認はありません',noApprovalsBody:'確認待ちのチーム休暇申請はありません。',allowance:'年間付与',pending:'保留中',approvedDays:'承認済み日数',employee:'従業員',department:'部署',dates:'日付',leaveType:'休暇種別',days:'日数',status:'状態',reason:'理由',privateReason:'本人のみ表示',managerPrivacy:'管理者ビューでは従業員の理由と証憑を非表示にします。',calendarPreview:'カレンダーは TASK-115 で提供します。このプレビューは実データの匿名化済み一覧です。',approvalPreview:'読み取り専用：承認コマンドは TASK-113/114 で提供します。'},
    vi:{module:'Công việc của tôi',leaveTitle:'Nghỉ phép của tôi',leaveDescription:'Xem các đơn nghỉ phép thuộc hồ sơ nhân viên đang đăng nhập.',claimsTitle:'Yêu cầu chi phí của tôi',claimsDescription:'Yêu cầu chi phí sẽ xuất hiện sau khi miền nghiệp vụ được quản trị hoàn tất.',receiptsTitle:'Biên lai của tôi',receiptsDescription:'Chứng từ chi phí sẽ xuất hiện sau khi xử lý tài liệu an toàn hoàn tất.',teamTitle:'Lịch nhóm',teamDescription:'Xem dữ liệu nghỉ phép đã ẩn thông tin riêng tư trong phạm vi báo cáo được phép.',approvalsTitle:'Phê duyệt của tôi',approvalsDescription:'Xem đơn nghỉ phép nhóm đang chờ. Thao tác quyết định sẽ có trong quy trình nghỉ phép đầy đủ.',noIdentity:'Không thể dùng dịch vụ nhân viên',noIdentityBody:'Tài khoản này chưa liên kết với nhân viên đang hoạt động trong công ty hiện tại.',noLeave:'Không có đơn nghỉ phép',noLeaveBody:'Hồ sơ nhân viên của bạn chưa có đơn nghỉ phép.',claimsUnavailable:'Chưa mô hình hóa yêu cầu chi phí',claimsUnavailableBody:'EPIC-055 sẽ bổ sung tạo, phê duyệt và kế toán. Không hiển thị dữ liệu mẫu.',receiptsUnavailable:'Chưa mô hình hóa biên lai',receiptsUnavailableBody:'EPIC-054 sẽ bổ sung tải lên an toàn, cách ly và trích xuất. Không hiển thị dữ liệu mẫu.',teamUnavailable:'Không có quyền truy cập nhóm',teamUnavailableBody:'Lịch Nhóm và Phê duyệt chỉ hiện với phạm vi quản lý được ủy quyền.',noTeamLeave:'Không có nghỉ phép nhóm',noTeamLeaveBody:'Không có đơn nghỉ phép trong phạm vi báo cáo của bạn.',noApprovals:'Không có phê duyệt chờ xử lý',noApprovalsBody:'Không có đơn nghỉ phép nhóm nào đang chờ xem xét.',allowance:'Hạn mức năm',pending:'Đang chờ',approvedDays:'Ngày đã duyệt',employee:'Nhân viên',department:'Phòng ban',dates:'Ngày',leaveType:'Loại nghỉ',days:'Số ngày',status:'Trạng thái',reason:'Lý do',privateReason:'Chỉ bạn có thể xem',managerPrivacy:'Lý do và chứng từ của nhân viên bị ẩn trong chế độ quản lý.',calendarPreview:'Bố cục lịch sẽ có trong TASK-115; bản xem trước dùng danh sách nhóm thật đã ẩn dữ liệu riêng tư.',approvalPreview:'Chỉ đọc: lệnh phê duyệt sẽ có trong TASK-113/114.'},
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}
function myLeaveCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{
      newLeave:'New leave',applicationTitle:'Leave application',applicationDescription:'Maintain one governed leave application and its immutable history.',
      leaveType:'Leave type',startDate:'Start date',endDate:'End date',unit:'Duration',fullDay:'Full day',halfDay:'Half day',halfMorning:'Morning half-day',halfAfternoon:'Afternoon half-day',reason:'Private reason',changeReason:'Reason for change',
      saveDraft:'Save draft',amend:'Amend',submit:'Submit',withdraw:'Withdraw',voidDraft:'Void application',requestCancellation:'Request cancellation',cancel:'Cancel',confirm:'Confirm',
      submitTitle:'Submit leave application?',submitBody:'Submitting reserves paid leave balance and starts the approval workflow.',
      withdrawTitle:'Withdraw pending leave',voidTitle:'Void this application',cancelTitle:'Request cancellation of approved leave',
      reasonRequired:'Enter an auditable reason of at least 3 characters.',saveFailed:'The leave application could not be saved.',actionFailed:'The leave action could not be completed.',
      created:'Leave draft created',amended:'Leave application amended',submitted:'Leave application submitted',withdrawn:'Leave application withdrawn',voided:'Leave application Voided',cancellationRequested:'Cancellation requested',
      history:'Lifecycle history',revisions:'Versions',evidence:'Medical evidence',evidenceRequired:'Required before submission',evidenceNotRequired:'Not required',notUploaded:'No governed evidence received',revision:'Revision',changed:'Changed',event:'Event',occurred:'Occurred',
      status_draft:'Draft',status_pending:'Pending',status_approved:'Approved',status_rejected:'Rejected',status_withdrawn:'Withdrawn',status_voided:'Voided',status_cancelled:'Cancelled',
      missing:'Leave application unavailable',missingBody:'Select a governed application from My Leave.',legacy:'Legacy Policy',legacyBody:'Legacy leave remains visible in the list but is not rewritten by the governed workflow.',
    },
    ms:{
      newLeave:'Cuti baharu',applicationTitle:'Permohonan cuti',applicationDescription:'Urus satu permohonan cuti terkawal dan sejarah kekalnya.',
      leaveType:'Jenis cuti',startDate:'Tarikh mula',endDate:'Tarikh akhir',unit:'Tempoh',fullDay:'Hari penuh',halfDay:'Separuh hari',halfMorning:'Separuh hari pagi',halfAfternoon:'Separuh hari petang',reason:'Sebab peribadi',changeReason:'Sebab perubahan',
      saveDraft:'Simpan draf',amend:'Pinda',submit:'Hantar',withdraw:'Tarik balik',voidDraft:'Void permohonan',requestCancellation:'Mohon pembatalan',cancel:'Batal',confirm:'Sahkan',
      submitTitle:'Hantar permohonan cuti?',submitBody:'Penghantaran menempah baki cuti berbayar dan memulakan aliran kelulusan.',
      withdrawTitle:'Tarik balik cuti tertunda',voidTitle:'Void permohonan ini',cancelTitle:'Mohon pembatalan cuti diluluskan',
      reasonRequired:'Masukkan sebab boleh audit sekurang-kurangnya 3 aksara.',saveFailed:'Permohonan cuti tidak dapat disimpan.',actionFailed:'Tindakan cuti tidak dapat diselesaikan.',
      created:'Draf cuti dicipta',amended:'Permohonan dipinda',submitted:'Permohonan dihantar',withdrawn:'Permohonan ditarik balik',voided:'Permohonan telah di-Void',cancellationRequested:'Pembatalan diminta',
      history:'Sejarah kitar hayat',revisions:'Versi',evidence:'Bukti perubatan',evidenceRequired:'Diperlukan sebelum penghantaran',evidenceNotRequired:'Tidak diperlukan',notUploaded:'Tiada bukti terkawal diterima',revision:'Semakan',changed:'Diubah',event:'Peristiwa',occurred:'Masa',
      status_draft:'Draf',status_pending:'Tertunda',status_approved:'Diluluskan',status_rejected:'Ditolak',status_withdrawn:'Ditarik balik',status_voided:'Voided',status_cancelled:'Dibatalkan',
      missing:'Permohonan cuti tidak tersedia',missingBody:'Pilih permohonan terkawal daripada Cuti Saya.',legacy:'Polisi Legasi',legacyBody:'Cuti legasi kekal dalam senarai tetapi tidak ditulis semula oleh aliran terkawal.',
    },
    zh:{
      newLeave:'新建请假',applicationTitle:'请假申请',applicationDescription:'维护一项受治理的请假申请及其不可变历史。',
      leaveType:'假期类型',startDate:'开始日期',endDate:'结束日期',unit:'时长',fullDay:'整天',halfDay:'半天',halfMorning:'上午半天',halfAfternoon:'下午半天',reason:'私人原因',changeReason:'变更原因',
      saveDraft:'保存草稿',amend:'修改',submit:'提交',withdraw:'撤回',voidDraft:'Void 申请',requestCancellation:'申请取消',cancel:'取消',confirm:'确认',
      submitTitle:'提交请假申请？',submitBody:'提交后将预留有薪假余额，并进入审批流程。',
      withdrawTitle:'撤回待审批请假',voidTitle:'Void 这项申请',cancelTitle:'申请取消已批准请假',
      reasonRequired:'请输入至少 3 个字符、可审计的原因。',saveFailed:'无法保存请假申请。',actionFailed:'无法完成请假操作。',
      created:'请假草稿已建立',amended:'请假申请已修改',submitted:'请假申请已提交',withdrawn:'请假申请已撤回',voided:'请假申请已 Void',cancellationRequested:'取消申请已提交',
      history:'生命周期历史',revisions:'版本记录',evidence:'医疗证明',evidenceRequired:'提交前必须提供',evidenceNotRequired:'不需要',notUploaded:'尚未收到受治理证明',revision:'版本',changed:'变更说明',event:'事件',occurred:'发生时间',
      status_draft:'草稿',status_pending:'待审批',status_approved:'已批准',status_rejected:'已拒绝',status_withdrawn:'已撤回',status_voided:'已 Void',status_cancelled:'已取消',
      missing:'请假申请不可用',missingBody:'请从“我的请假”选择一项受治理申请。',legacy:'旧政策记录',legacyBody:'旧请假仍保留在列表，但不会由新流程重算或改写。',
    },
    ja:{
      newLeave:'休暇を申請',applicationTitle:'休暇申請',applicationDescription:'統制された休暇申請と不変の履歴を管理します。',
      leaveType:'休暇種別',startDate:'開始日',endDate:'終了日',unit:'期間',fullDay:'全日',halfDay:'半日',halfMorning:'午前半休',halfAfternoon:'午後半休',reason:'非公開の理由',changeReason:'変更理由',
      saveDraft:'ドラフト保存',amend:'変更',submit:'提出',withdraw:'取り下げ',voidDraft:'申請を Void',requestCancellation:'取消を申請',cancel:'キャンセル',confirm:'確認',
      submitTitle:'休暇申請を提出しますか？',submitBody:'提出すると有給残高を予約し、承認フローを開始します。',
      withdrawTitle:'保留中の休暇を取り下げ',voidTitle:'この申請を Void',cancelTitle:'承認済み休暇の取消を申請',
      reasonRequired:'監査可能な理由を3文字以上入力してください。',saveFailed:'休暇申請を保存できませんでした。',actionFailed:'休暇操作を完了できませんでした。',
      created:'休暇ドラフトを作成しました',amended:'休暇申請を変更しました',submitted:'休暇申請を提出しました',withdrawn:'休暇申請を取り下げました',voided:'休暇申請を Void しました',cancellationRequested:'取消を申請しました',
      history:'ライフサイクル履歴',revisions:'バージョン',evidence:'医療証明',evidenceRequired:'提出前に必要',evidenceNotRequired:'不要',notUploaded:'統制された証明は未受領です',revision:'改訂',changed:'変更',event:'イベント',occurred:'発生日時',
      status_draft:'ドラフト',status_pending:'保留中',status_approved:'承認済',status_rejected:'却下',status_withdrawn:'取り下げ済',status_voided:'Voided',status_cancelled:'取消済',
      missing:'休暇申請を利用できません',missingBody:'自分の休暇から統制対象の申請を選択してください。',legacy:'旧ポリシー',legacyBody:'旧休暇は一覧に保持されますが、新しいフローで再計算・書換えしません。',
    },
    vi:{
      newLeave:'Tạo đơn nghỉ',applicationTitle:'Đơn nghỉ phép',applicationDescription:'Quản lý một đơn nghỉ phép được kiểm soát và lịch sử bất biến.',
      leaveType:'Loại nghỉ',startDate:'Ngày bắt đầu',endDate:'Ngày kết thúc',unit:'Thời lượng',fullDay:'Cả ngày',halfDay:'Nửa ngày',halfMorning:'Nửa ngày buổi sáng',halfAfternoon:'Nửa ngày buổi chiều',reason:'Lý do riêng tư',changeReason:'Lý do thay đổi',
      saveDraft:'Lưu nháp',amend:'Sửa đổi',submit:'Gửi',withdraw:'Rút đơn',voidDraft:'Void đơn',requestCancellation:'Yêu cầu hủy',cancel:'Hủy',confirm:'Xác nhận',
      submitTitle:'Gửi đơn nghỉ phép?',submitBody:'Khi gửi, hệ thống giữ trước số dư nghỉ có lương và bắt đầu luồng phê duyệt.',
      withdrawTitle:'Rút đơn đang chờ',voidTitle:'Void đơn này',cancelTitle:'Yêu cầu hủy phép đã duyệt',
      reasonRequired:'Nhập lý do có thể kiểm toán ít nhất 3 ký tự.',saveFailed:'Không thể lưu đơn nghỉ phép.',actionFailed:'Không thể hoàn tất thao tác nghỉ phép.',
      created:'Đã tạo bản nháp',amended:'Đã sửa đơn',submitted:'Đã gửi đơn',withdrawn:'Đã rút đơn',voided:'Đã Void đơn',cancellationRequested:'Đã gửi yêu cầu hủy',
      history:'Lịch sử vòng đời',revisions:'Phiên bản',evidence:'Chứng từ y tế',evidenceRequired:'Bắt buộc trước khi gửi',evidenceNotRequired:'Không bắt buộc',notUploaded:'Chưa nhận chứng từ được quản trị',revision:'Bản sửa',changed:'Thay đổi',event:'Sự kiện',occurred:'Thời điểm',
      status_draft:'Nháp',status_pending:'Đang chờ',status_approved:'Đã duyệt',status_rejected:'Từ chối',status_withdrawn:'Đã rút',status_voided:'Voided',status_cancelled:'Đã hủy',
      missing:'Không có đơn nghỉ phép',missingBody:'Chọn một đơn được quản trị từ Nghỉ phép của tôi.',legacy:'Chính sách cũ',legacyBody:'Đơn cũ vẫn hiển thị nhưng không bị tính lại hoặc ghi đè bởi quy trình mới.',
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
  return leaveRequests.some(lv=>lv.employeeId===employeeId&&lv.status==='approved'&&dateValue(lv.startDate)<=today&&dateValue(lv.endDate)>=today);
}
function hrAnnualLeaveUsed(employeeId,leaveRequests){
  return leaveRequests.filter(lv=>lv.employeeId===employeeId&&lv.status==='approved'&&lv.leaveType==='Annual')
    .reduce((sum,lv)=>sum+Number(lv.days||0),0);
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
function hrLeaveStatusLabel(s,status){
  return {
    pending:s('statusPending'),
    approved:s('statusApproved'),
    rejected:s('statusRejected'),
  }[status]||status;
}

/* ---------------- MY WORK (actor-owned governed shell) ----------------
   List routes share transaction-list-v1, claim/leave cases use case-detail-v1,
   and every read derives employee identity from the active session. Team and
   approval routes render only their authorised privacy-redacted scope. */
function myWorkAdapter(){
  const adapter=window.ErpSystemData&&window.ErpSystemData.my;
  if(!adapter||typeof adapter.context!=='function'){
    const error=new Error('Employee Self Service adapter is unavailable.');
    error.code='my_work_adapter_missing';
    throw error;
  }
  return adapter;
}
function myWorkAfterRender(route,privacy){
  return ({root:screenRoot})=>{
    const layout=screenRoot.querySelector('[data-layout="transaction-list-v1"]');
    if(!layout) return;
    layout.setAttribute('data-my-work-shell','true');
    layout.setAttribute('data-my-work-view',route);
    if(privacy) layout.setAttribute('data-my-work-privacy',privacy);
  };
}
function myWorkStatusTone(status){
  return {
    draft:'neutral',pending:'warn',approved:'ok',rejected:'danger',
    withdrawn:'neutral',voided:'neutral',cancelled:'neutral',
  }[status]||'neutral';
}
function myWorkLeaveStatus(status,statusCopy){
  const lifecycle=myLeaveCopy();
  return lifecycle(`status_${status}`)||hrLeaveStatusLabel(statusCopy,status);
}
function myWorkLeaveColumns(copy,statusCopy,{team=false}={}){
  const columns=[];
  if(team){
    columns.push(
      {label:copy('employee'),render:row=>`<div class="cellsub"><b>${esc(row.employeeName)}</b><small>${esc(row.employeeNo)}</small></div>`},
      {label:copy('department'),align:'l',render:row=>esc(row.department)},
    );
  }
  columns.push(
    {label:copy('dates'),align:'l',render:row=>`<span class="tnum">${esc(dateValue(row.startDate))}</span> → <span class="tnum">${esc(dateValue(row.endDate))}</span>`},
    {label:copy('leaveType'),align:'l',render:row=>esc(row.leaveType)},
    {label:copy('days'),render:row=>`<span class="tnum">${esc(String(row.days))}</span>`},
    {label:copy('status'),align:'l',render:row=>cap(myWorkLeaveStatus(row.status,statusCopy),myWorkStatusTone(row.status))},
  );
  if(!team){
    columns.splice(columns.length-1,0,{
      label:copy('reason'),
      align:'l',
      render:row=>`<div class="cellsub"><b>${esc(row.reason||'—')}</b><small>${esc(copy('privateReason'))}</small></div>`,
    });
  }
  return columns;
}
function myWorkEmptyPage(root,{route,title,description,emptyTitle,emptyDescription,note,privacy}){
  transactionListPage(root,{
    module:'mywork',route,title,description,rows:[],rowId:row=>row.id,
    columns:[],
    note,
    empty:{icon:'inbox',title:emptyTitle,description:emptyDescription},
    afterRender:myWorkAfterRender(route,privacy),
  });
}
function isMyWorkIdentityError(error){
  return Boolean(error&&(
    ['employee_identity_missing','employee_identity_ambiguous','permission_denied'].includes(error.code)
    ||/not linked|not linked to an active employee|không liên kết|tidak dipautkan/i.test(error.message||'')
  ));
}
function myWorkIdentityPage(root,route,title,description){
  const copy=myWorkCopy();
  myWorkEmptyPage(root,{
    route,title,description,
    emptyTitle:copy('noIdentity'),emptyDescription:copy('noIdentityBody'),
  });
}

function myLeaveEventLabel(eventType,copy){
  return {
    created_draft:copy('created'),
    amended:copy('amended'),
    submitted:copy('submitted'),
    withdrawn:copy('withdrawn'),
    voided:copy('voided'),
    cancellation_requested:copy('cancellationRequested'),
    cancellation_approved:copy('status_cancelled'),
    cancellation_rejected:copy('status_approved'),
    approved:copy('status_approved'),
    rejected:copy('status_rejected'),
  }[eventType]||String(eventType||'—');
}
function myLeaveTypeOptions(context,selectedId){
  const types=Array.isArray(context&&context.leaveTypes)?context.leaveTypes:[];
  return types.map(type=>`<option value="${type.id}" ${String(type.id)===String(selectedId)?'selected':''}>
    ${esc(type.name)}
  </option>`).join('');
}
function openMyLeaveForm(context,current,onSaved){
  const copy=myLeaveCopy();
  const revision=current&&current.revisions&&current.revisions[0];
  const editing=Boolean(current);
  const start=revision&&revision.startDate||hrToday();
  const end=revision&&revision.endDate||start;
  appModal({
    icon:'calendar',
    title:editing?copy('amend'):copy('newLeave'),
    width:640,
    body:`<div class="alert danger" data-my-leave-form-error hidden>${ic('warn')}<span></span></div>
      <div class="fld"><span>${esc(copy('leaveType'))}</span>
        <select data-my-leave-type>${myLeaveTypeOptions(context,revision&&revision.leaveTypeId)}</select>
      </div>
      <div class="fldrow c2">
        <div class="fld"><span>${esc(copy('startDate'))}</span><input type="date" value="${esc(dateValue(start))}" data-my-leave-start></div>
        <div class="fld"><span>${esc(copy('endDate'))}</span><input type="date" value="${esc(dateValue(end))}" data-my-leave-end></div>
      </div>
      <div class="fld"><span>${esc(copy('unit'))}</span>
        <select data-my-leave-unit>
          <option value="full_day" ${revision&&revision.unit==='full_day'?'selected':''}>${esc(copy('fullDay'))}</option>
          <option value="half_day_am" ${revision&&revision.unit==='half_day_am'?'selected':''}>${esc(copy('halfMorning'))}</option>
          <option value="half_day_pm" ${revision&&revision.unit==='half_day_pm'?'selected':''}>${esc(copy('halfAfternoon'))}</option>
        </select>
      </div>
      <div class="fld"><span>${esc(copy('reason'))}</span><textarea rows="3" data-my-leave-reason>${esc(revision&&revision.reason||'')}</textarea></div>
      ${editing?`<div class="fld"><span>${esc(copy('changeReason'))}</span><textarea rows="2" data-my-leave-change></textarea></div>`:''}`,
    actions:`${btn(copy('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(editing?copy('amend'):copy('saveDraft'),{icon:'check',cls:'primary',attrs:'data-my-leave-save'})}`,
  });
  const modal=$('#modalEl');
  const save=modal&&modal.querySelector('[data-my-leave-save]');
  save?.addEventListener('click',async()=>{
    const payload={
      leaveTypeId:Number(modal.querySelector('[data-my-leave-type]').value),
      startDate:modal.querySelector('[data-my-leave-start]').value,
      endDate:modal.querySelector('[data-my-leave-end]').value,
      unit:modal.querySelector('[data-my-leave-unit]').value,
      reason:modal.querySelector('[data-my-leave-reason]').value.trim()||null,
    };
    if(editing) payload.changeReason=modal.querySelector('[data-my-leave-change]').value.trim();
    const errorRoot=modal.querySelector('[data-my-leave-form-error]');
    errorRoot.hidden=true;
    if(!payload.leaveTypeId||!payload.startDate||!payload.endDate||payload.endDate<payload.startDate
      ||(editing&&payload.changeReason.length<3)){
      errorRoot.hidden=false;
      errorRoot.querySelector('span').textContent=copy('reasonRequired');
      return;
    }
    save.disabled=true;
    try{
      const response=editing
        ?await myWorkAdapter().leaveAction(current.id,'amend',{
          ...payload,expectedVersion:current.version,
        })
        :await myWorkAdapter().createLeaveDraft(payload);
      closeModal();
      toast(editing?copy('amended'):copy('created'),'ok');
      onSaved(response.data);
    }catch(error){
      save.disabled=false;
      errorRoot.hidden=false;
      errorRoot.querySelector('span').textContent=error&&error.message||copy('saveFailed');
    }
  });
}
function confirmMyLeaveAction(application,name){
  const copy=myLeaveCopy();
  const isSubmit=name==='submit';
  const title={
    submit:copy('submitTitle'),withdraw:copy('withdrawTitle'),
    void:copy('voidTitle'),'request-cancellation':copy('cancelTitle'),
  }[name];
  const success={
    submit:copy('submitted'),withdraw:copy('withdrawn'),
    void:copy('voided'),'request-cancellation':copy('cancellationRequested'),
  }[name];
  appModal({
    icon:isSubmit?'send':'warn',
    title,
    width:520,
    body:isSubmit
      ?`<p>${esc(copy('submitBody'))}</p><div class="alert danger" data-my-leave-action-error hidden>${ic('warn')}<span></span></div>`
      :`<div class="fld"><span>${esc(copy('reason'))}</span><textarea rows="3" data-my-leave-action-reason></textarea></div>
        <div class="alert danger" data-my-leave-action-error hidden>${ic('warn')}<span></span></div>`,
    actions:`${btn(copy('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(copy('confirm'),{icon:'check',cls:name==='void'?'danger':'primary',attrs:'data-my-leave-action-confirm'})}`,
  });
  const modal=$('#modalEl');
  const confirm=modal&&modal.querySelector('[data-my-leave-action-confirm]');
  confirm?.addEventListener('click',async()=>{
    const reason=modal.querySelector('[data-my-leave-action-reason]')?.value.trim()||'';
    const errorRoot=modal.querySelector('[data-my-leave-action-error]');
    if(!isSubmit&&reason.length<3){
      errorRoot.hidden=false;
      errorRoot.querySelector('span').textContent=copy('reasonRequired');
      return;
    }
    confirm.disabled=true;
    try{
      await myWorkAdapter().leaveAction(application.id,name,{
        expectedVersion:application.version,reason,
      });
      closeModal();
      toast(success,'ok');
      navigate('leave-application',{requestId:application.id});
    }catch(error){
      confirm.disabled=false;
      errorRoot.hidden=false;
      errorRoot.querySelector('span').textContent=error&&error.message||copy('actionFailed');
    }
  });
}

SCREENS['my-leave']=async function(root){
  const copy=myWorkCopy();
  const statusCopy=hrCopy();
  const adapter=myWorkAdapter();
  let contextResponse;
  let leaveResponse;
  try{
    [contextResponse,leaveResponse]=await Promise.all([
      adapter.context(),
      adapter.leaveRequests(),
    ]);
  }catch(error){
    if(!isMyWorkIdentityError(error)) throw error;
    myWorkIdentityPage(root,'my-leave',copy('leaveTitle'),copy('leaveDescription'));
    return;
  }
  const context=contextResponse.data;
  const rows=Array.isArray(leaveResponse.data)?leaveResponse.data:[];
  const pending=rows.filter(row=>row.status==='pending').length;
  const approvedDays=rows.filter(row=>row.status==='approved')
    .reduce((sum,row)=>sum+Number(row.days||0),0);
  transactionListPage(root,{
    module:'mywork',route:'my-leave',
    title:copy('leaveTitle'),description:copy('leaveDescription'),
    rows,rowId:row=>row.id,
    filters:[
      ['all',statusCopy('filterAllStatus')],
      ['pending',statusCopy('statusPending')],
      ['approved',statusCopy('statusApproved')],
      ['rejected',statusCopy('statusRejected')],
    ],
    filterFn:(row,status)=>row.status===status,
    kpis:[
      {label:copy('allowance'),value:String(context.employee.annualLeaveDays)},
      {label:copy('pending'),value:String(pending),negative:pending>0},
      {label:copy('approvedDays'),value:String(approvedDays)},
    ],
    columns:myWorkLeaveColumns(copy,statusCopy),
    primaryAction:context.capabilities&&context.capabilities.leave&&context.capabilities.leave.writable
      ?{label:myLeaveCopy()('newLeave'),icon:'plus',onClick:()=>openMyLeaveForm(context,null,created=>
        navigate('leave-application',{requestId:created.id}))}
      :null,
    rowAction:{
      enabled:row=>!row.legacyPolicy,
      label:row=>`${myLeaveCopy()('applicationTitle')} ${row.id}`,
      run:row=>navigate('leave-application',{requestId:row.id}),
    },
    empty:{icon:'calendar',title:copy('noLeave'),description:copy('noLeaveBody')},
    afterRender:myWorkAfterRender('my-leave'),
  });
};

SCREENS['leave-application']=async function(root,params){
  // Yield before the first render so navigate() can install its loading state
  // without overwriting the synchronous empty-case shell of this async screen.
  await Promise.resolve();
  const copy=myLeaveCopy();
  const workCopy=myWorkCopy();
  const statusCopy=hrCopy();
  const requestId=params&&Number(params.requestId);
  if(!Number.isSafeInteger(requestId)||requestId<=0){
    caseDetailPage(root,{
      module:'mywork',route:'leave-application',active:'my-leave',
      title:copy('applicationTitle'),description:copy('applicationDescription'),
      crumb:[DB.company.name,{label:workCopy('leaveTitle'),route:'my-leave'},{cur:copy('applicationTitle')}],
      empty:{icon:'calendar',title:copy('missing'),description:copy('missingBody')},
      context:{
        title:copy('history'),
        body:`<div class="callout info">${ic('info')}<span>${esc(copy('missingBody'))}</span></div>`,
      },
    });
    return;
  }
  const [contextResponse,detailResponse]=await Promise.all([
    myWorkAdapter().context(),
    myWorkAdapter().leaveApplication(requestId),
  ]);
  const context=contextResponse.data;
  const application=detailResponse.data;
  const revision=application.revisions&&application.revisions[0];
  if(!revision) throw new Error(copy('missing'));
  const lifecyclePath={
    draft:['draft'],pending:['draft','pending'],approved:['draft','pending','approved'],
    rejected:['draft','pending','rejected'],withdrawn:['draft','pending','withdrawn'],
    voided:['draft','voided'],cancelled:['draft','pending','approved','cancelled'],
  }[application.status]||[application.status];
  const lifecycleSteps=lifecyclePath.map(key=>({key,label:myWorkLeaveStatus(key,statusCopy)}));
  const revisionRows=application.revisions||[];
  const revisionTable=buildTable({
    rowId:row=>row.id,
    columns:[
      {label:copy('revision'),render:row=>`<b class="tnum">v${row.revisionNo}</b>`},
      {label:workCopy('dates'),align:'l',render:row=>`${esc(dateValue(row.startDate))} → ${esc(dateValue(row.endDate))}`},
      {label:workCopy('days'),align:'r',render:row=>`<span class="tnum">${esc(String(row.days))}</span>`},
      {label:copy('changed'),align:'l',render:row=>esc(row.changeReason||'—')},
    ],
    rows:revisionRows,
  });
  const eventRows=(application.events||[]).map(event=>`<div class="tl">
    <span class="tldot"></span><div class="tlbody">
      <div class="when">${esc(dateTimeValue(event.occurredAt))}</div>
      <div class="what">${esc(myLeaveEventLabel(event.eventType,copy))}</div>
      ${event.reason?`<div class="det">${esc(event.reason)}</div>`:''}
    </div>
  </div>`).join('');
  const evidenceRequired=Boolean(revision.evidenceRequired);
  const evidence=application.evidence||[];
  const cancellation=(application.cancellations||[])[0];
  const actions=[];
  if(['draft','rejected','withdrawn'].includes(application.status)){
    actions.push(btn(copy('voidDraft'),{icon:'x',cls:'danger',attrs:'data-my-leave-void'}));
    actions.push(btn(copy('amend'),{icon:'edit',cls:'soft',attrs:'data-my-leave-amend'}));
  }
  if(application.status==='draft') actions.push(btn(copy('submit'),{icon:'send',cls:'primary',attrs:'data-my-leave-submit'}));
  if(application.status==='pending') actions.push(btn(copy('withdraw'),{icon:'undo',cls:'soft',attrs:'data-my-leave-withdraw'}));
  if(application.status==='approved'&&(!cancellation||cancellation.status!=='pending')){
    actions.push(btn(copy('requestCancellation'),{icon:'undo',cls:'soft',attrs:'data-my-leave-cancel'}));
  }
  caseDetailPage(root,{
    module:'mywork',route:'leave-application',active:'my-leave',
    title:copy('applicationTitle'),description:copy('applicationDescription'),
    crumb:[DB.company.name,{label:workCopy('leaveTitle'),route:'my-leave'},{cur:`#${application.id}`}],
    identity:{
      title:application.leaveType,
      code:`#${application.id}`,
      meta:`${dateValue(application.startDate)} → ${dateValue(application.endDate)}`,
    },
    statuses:[{label:myWorkLeaveStatus(application.status,statusCopy),tone:myWorkStatusTone(application.status)}],
    lifecycle:{label:copy('history'),current:application.status,steps:lifecycleSteps},
    facts:[
      {label:copy('startDate'),value:dateValue(application.startDate)},
      {label:copy('endDate'),value:dateValue(application.endDate)},
      {label:workCopy('days'),value:String(application.days),numeric:true},
      {label:copy('unit'),value:application.unit==='half_day_am'
        ?copy('halfMorning'):application.unit==='half_day_pm'?copy('halfAfternoon'):copy('fullDay')},
    ],
    main:`<div class="panel" data-my-leave-reason>
        <div class="panel-h"><h3>${esc(copy('reason'))}</h3></div>
        <div class="panel-body"><p>${esc(revision.reason||'—')}</p><small>${esc(workCopy('privateReason'))}</small></div>
      </div>
      <div class="panel" data-my-leave-revisions>
        <div class="panel-h"><h3>${esc(copy('revisions'))}</h3><span>${revisionRows.length}</span></div>
        <div class="master-detail-editor-table-scroll">${revisionTable}</div>
      </div>`,
    context:{
      title:copy('history'),
      body:`<div class="service-order-context-section">
          <div class="sectitle">${esc(copy('evidence'))}</div>
          <div class="callout ${evidenceRequired?'warn':'info'}">${ic(evidenceRequired?'warn':'check')}
            <span>${esc(evidenceRequired?copy('evidenceRequired'):copy('evidenceNotRequired'))}</span>
          </div>
          ${evidence.length?`<small>${esc(String(evidence.length))}</small>`:`<small>${esc(copy('notUploaded'))}</small>`}
        </div>
        <div class="timeline" data-my-leave-events>${eventRows}</div>`,
    },
    actions:actions.length?`<div class="grow"></div>${actions.join('')}`:'',
    afterRender:()=>{
      root.querySelector('[data-my-leave-amend]')?.addEventListener('click',()=>openMyLeaveForm(
        context,application,()=>navigate('leave-application',{requestId:application.id}),
      ));
      root.querySelector('[data-my-leave-submit]')?.addEventListener('click',()=>confirmMyLeaveAction(application,'submit'));
      root.querySelector('[data-my-leave-withdraw]')?.addEventListener('click',()=>confirmMyLeaveAction(application,'withdraw'));
      root.querySelector('[data-my-leave-void]')?.addEventListener('click',()=>confirmMyLeaveAction(application,'void'));
      root.querySelector('[data-my-leave-cancel]')?.addEventListener('click',()=>confirmMyLeaveAction(application,'request-cancellation'));
    },
  });
};

function expenseClaimCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{title:'My Claims',description:'Review your employee-owned expense claims, line decisions and immutable accounting outcome.',claim:'Claim',expenseClaim:'Expense claim',lines:'Lines',amount:'Claimed amount',updated:'Updated',status:'Status',all:'All',draft:'Draft',pending:'Pending approval',partial:'Partially decided',approved:'Approved',rejected:'Rejected',returned:'Returned',empty:'No expense claims',emptyBody:'Claims created by your signed-in employee profile will appear here.',missing:'Expense claim unavailable',missingBody:'Choose one of your own claims from My Claims.',ownerPrivacy:'Only your employee profile can read these claim facts. Duplicate evidence is summarized without exposing another employee or evidence hash.',merchant:'Merchant',date:'Transaction date',purpose:'Purpose',category:'Category',payment:'Payment source',employeePaid:'Employee paid',companyPaid:'Company paid',original:'Original amount',functional:'Functional amount',fx:'FX policy',actualFx:'Verified actual bank FX',tax:'Input tax',allocation:'Allocation',duplicate:'Duplicate control',risk:'risk',override:'Finance override recorded',budget:'Budget control',remaining:'remaining',breached:'Budget exceeded',withinBudget:'Within budget',approval:'Line approval',posting:'Accounting posting',notPosted:'Not posted',postingFailed:'Posting failed; approval remains recoverable',journal:'Journal',privacy:'Privacy',details:'Line details',noPolicy:'Awaiting submitted policy snapshot',noControl:'Controls run at submission',noApproval:'Approval not started',version:'Version',submitted:'Submitted',system:'System submitted',employee:'Employee submitted'},
    ms:{title:'Tuntutan Saya',description:'Semak tuntutan perbelanjaan milik pekerja, keputusan baris dan hasil perakaunan kekal.',claim:'Tuntutan',expenseClaim:'Tuntutan perbelanjaan',lines:'Baris',amount:'Amaun tuntutan',updated:'Dikemas kini',status:'Status',all:'Semua',draft:'Draf',pending:'Menunggu kelulusan',partial:'Diputuskan sebahagian',approved:'Diluluskan',rejected:'Ditolak',returned:'Dikembalikan',empty:'Tiada tuntutan perbelanjaan',emptyBody:'Tuntutan yang dicipta oleh profil pekerja anda akan dipaparkan di sini.',missing:'Tuntutan tidak tersedia',missingBody:'Pilih tuntutan anda daripada Tuntutan Saya.',ownerPrivacy:'Hanya profil pekerja anda boleh membaca fakta tuntutan ini. Bukti pendua diringkaskan tanpa mendedahkan pekerja lain atau hash bukti.',merchant:'Peniaga',date:'Tarikh transaksi',purpose:'Tujuan',category:'Kategori',payment:'Sumber bayaran',employeePaid:'Dibayar pekerja',companyPaid:'Dibayar syarikat',original:'Amaun asal',functional:'Amaun fungsi',fx:'Dasar FX',actualFx:'FX bank sebenar disahkan',tax:'Cukai input',allocation:'Peruntukan',duplicate:'Kawalan pendua',risk:'risiko',override:'Pintasan Kewangan direkod',budget:'Kawalan bajet',remaining:'baki',breached:'Bajet dilebihi',withinBudget:'Dalam bajet',approval:'Kelulusan baris',posting:'Catatan perakaunan',notPosted:'Belum dicatat',postingFailed:'Catatan gagal; kelulusan boleh dipulihkan',journal:'Jurnal',privacy:'Privasi',details:'Butiran baris',noPolicy:'Menunggu snapshot dasar dihantar',noControl:'Kawalan dijalankan semasa penghantaran',noApproval:'Kelulusan belum bermula',version:'Versi',submitted:'Dihantar',system:'Dihantar sistem',employee:'Dihantar pekerja'},
    zh:{title:'我的报销',description:'查看本人拥有的报销单、逐行决定及不可变会计结果。',claim:'报销单',expenseClaim:'费用报销单',lines:'费用行',amount:'申报金额',updated:'更新时间',status:'状态',all:'全部',draft:'草稿',pending:'待审批',partial:'部分已决定',approved:'已批准',rejected:'已拒绝',returned:'已退回',empty:'暂无费用报销',emptyBody:'当前登录员工本人建立的报销单会显示在这里。',missing:'报销单不可用',missingBody:'请从“我的报销”选择一份属于你的报销单。',ownerPrivacy:'只有你的员工身份可读取这些申报事实。重复凭证仅显示摘要，不会泄露其他员工或凭证哈希。',merchant:'商户',date:'交易日期',purpose:'用途',category:'类别',payment:'付款来源',employeePaid:'员工垫付',companyPaid:'公司支付',original:'原币金额',functional:'本位币金额',fx:'汇率政策',actualFx:'已核实银行实际汇率',tax:'进项税',allocation:'分摊',duplicate:'重复控制',risk:'风险',override:'已记录财务覆盖决定',budget:'预算控制',remaining:'剩余',breached:'预算已超出',withinBudget:'预算范围内',approval:'费用行审批',posting:'会计记账',notPosted:'尚未记账',postingFailed:'记账失败；审批仍可恢复',journal:'凭证',privacy:'隐私',details:'费用行明细',noPolicy:'提交后才生成政策快照',noControl:'提交时才执行控制',noApproval:'尚未开始审批',version:'版本',submitted:'提交时间',system:'系统自动提交',employee:'员工本人提交'},
    ja:{title:'自分の経費申請',description:'本人所有の経費申請、明細ごとの決定、変更不能な会計結果を確認します。',claim:'申請',expenseClaim:'経費申請',lines:'明細',amount:'申請額',updated:'更新',status:'状態',all:'すべて',draft:'下書き',pending:'承認待ち',partial:'一部決定済み',approved:'承認済み',rejected:'却下',returned:'差し戻し',empty:'経費申請はありません',emptyBody:'ログイン中の従業員プロフィールで作成した申請が表示されます。',missing:'経費申請を利用できません',missingBody:'自分の経費申請から本人所有の申請を選択してください。',ownerPrivacy:'この申請情報は本人の従業員プロフィールだけが閲覧できます。重複証拠は他の従業員や証拠ハッシュを公開せず要約されます。',merchant:'加盟店',date:'取引日',purpose:'目的',category:'カテゴリ',payment:'支払元',employeePaid:'従業員立替',companyPaid:'会社払い',original:'原通貨額',functional:'機能通貨額',fx:'FXポリシー',actualFx:'確認済み銀行実勢FX',tax:'仕入税',allocation:'配賦',duplicate:'重複管理',risk:'リスク',override:'財務オーバーライド記録済み',budget:'予算管理',remaining:'残額',breached:'予算超過',withinBudget:'予算内',approval:'明細承認',posting:'会計転記',notPosted:'未転記',postingFailed:'転記失敗。承認は再実行可能です',journal:'仕訳',privacy:'プライバシー',details:'明細詳細',noPolicy:'提出後のポリシースナップショット待ち',noControl:'管理は提出時に実行',noApproval:'承認未開始',version:'バージョン',submitted:'提出',system:'システム提出',employee:'従業員提出'},
    vi:{title:'Yêu cầu chi phí của tôi',description:'Xem yêu cầu chi phí thuộc nhân viên, quyết định từng dòng và kết quả kế toán bất biến.',claim:'Yêu cầu',expenseClaim:'Yêu cầu chi phí',lines:'Dòng',amount:'Số tiền yêu cầu',updated:'Cập nhật',status:'Trạng thái',all:'Tất cả',draft:'Bản nháp',pending:'Chờ phê duyệt',partial:'Đã quyết định một phần',approved:'Đã duyệt',rejected:'Đã từ chối',returned:'Đã trả lại',empty:'Không có yêu cầu chi phí',emptyBody:'Yêu cầu do hồ sơ nhân viên đang đăng nhập tạo sẽ xuất hiện ở đây.',missing:'Không thể xem yêu cầu',missingBody:'Chọn một yêu cầu thuộc bạn từ Yêu cầu chi phí của tôi.',ownerPrivacy:'Chỉ hồ sơ nhân viên của bạn có thể đọc dữ liệu này. Bằng chứng trùng lặp được tóm tắt mà không lộ nhân viên khác hoặc hash chứng từ.',merchant:'Đơn vị bán',date:'Ngày giao dịch',purpose:'Mục đích',category:'Danh mục',payment:'Nguồn thanh toán',employeePaid:'Nhân viên trả',companyPaid:'Công ty trả',original:'Số tiền gốc',functional:'Số tiền chức năng',fx:'Chính sách FX',actualFx:'FX ngân hàng thực tế đã xác minh',tax:'Thuế đầu vào',allocation:'Phân bổ',duplicate:'Kiểm soát trùng',risk:'rủi ro',override:'Đã ghi nhận ghi đè Tài chính',budget:'Kiểm soát ngân sách',remaining:'còn lại',breached:'Vượt ngân sách',withinBudget:'Trong ngân sách',approval:'Phê duyệt dòng',posting:'Hạch toán',notPosted:'Chưa hạch toán',postingFailed:'Hạch toán lỗi; phê duyệt vẫn có thể khôi phục',journal:'Nhật ký',privacy:'Riêng tư',details:'Chi tiết dòng',noPolicy:'Chờ snapshot chính sách khi gửi',noControl:'Kiểm soát chạy khi gửi',noApproval:'Chưa bắt đầu phê duyệt',version:'Phiên bản',submitted:'Đã gửi',system:'Hệ thống gửi',employee:'Nhân viên gửi'},
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}
function expenseStatusInfo(status,c){
  const map={
    draft:['draft','neutral'],pending_approval:['pending','warn'],
    partially_approved:['partial','violet'],approved:['approved','ok'],
    rejected:['rejected','danger'],returned:['returned','warn'],
  };
  const item=map[status]||[status||'status','neutral'];
  return {label:c(item[0]),tone:item[1]};
}
function expenseMoney(value,currency){
  const amount=Number(value||0);
  return `${currency||''} ${Number.isFinite(amount)?amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):String(value||'0')}`.trim();
}
function claimTotals(lines){
  const totals=new Map();
  (lines||[]).forEach(line=>totals.set(
    line.originalCurrency,
    Number(totals.get(line.originalCurrency)||0)+Number(line.originalGross||0),
  ));
  return [...totals].map(([currency,value])=>expenseMoney(value,currency)).join(' + ')||'—';
}

SCREENS['my-claims']=async function(root){
  const c=expenseClaimCopy();
  let response;
  try{ response=await myWorkAdapter().claims(); }
  catch(error){
    if(!isMyWorkIdentityError(error)) throw error;
    myWorkIdentityPage(root,'my-claims',c('title'),c('description'));
    return;
  }
  const rows=Array.isArray(response.data)?response.data:[];
  transactionListPage(root,{
    module:'mywork',route:'my-claims',title:c('title'),description:c('description'),
    rows,rowId:row=>row.id,
    filters:[
      ['all',c('all')],['draft',c('draft')],['pending_approval',c('pending')],
      ['partially_approved',c('partial')],['approved',c('approved')],
      ['returned',c('returned')],['rejected',c('rejected')],
    ],
    filterFn:(row,status)=>row.status===status,
    kpis:[
      {label:c('pending'),value:rows.filter(row=>['pending_approval','partially_approved'].includes(row.status)).length,accent:true},
      {label:c('approved'),value:rows.filter(row=>row.status==='approved').length},
      {label:c('draft'),value:rows.filter(row=>row.status==='draft').length},
    ],
    columns:[
      {key:'claim',label:c('claim'),primary:true,render:row=>`<div class="cellsub"><b>${esc(row.claimNo)}</b><small>${esc(row.title)}</small></div>`},
      {key:'status',label:c('status'),render:row=>{const state=expenseStatusInfo(row.status,c);return cap(state.label,state.tone);}},
      {key:'lines',label:c('lines'),numeric:true,render:row=>esc(String((row.lines||[]).length))},
      {key:'amount',label:c('amount'),numeric:true,render:row=>esc(claimTotals(row.lines))},
      {key:'updated',label:c('updated'),render:row=>esc(dateValue(row.updatedAt))},
    ],
    rowAction:{label:row=>`${c('expenseClaim')} ${row.claimNo}`,run:row=>navigate('expense-claim',{claimId:row.id})},
    empty:{icon:'receipt',title:c('empty'),description:c('emptyBody')},
    afterRender:({root:screenRoot})=>{
      screenRoot.querySelector('[data-layout="transaction-list-v1"]')?.setAttribute('data-expense-claims','canonical');
    },
  });
};

SCREENS['expense-claim']=async function(root,params){
  // Let navigate() install its loading shell before rendering the synchronous
  // empty case used when no claim id is supplied by route audits or deep links.
  await Promise.resolve();
  const c=expenseClaimCopy();
  const claimId=Number(params&&params.claimId);
  if(!Number.isSafeInteger(claimId)||claimId<=0){
    caseDetailPage(root,{module:'mywork',route:'expense-claim',active:'my-claims',
      title:c('expenseClaim'),description:c('description'),
      empty:{icon:'receipt',title:c('missing'),description:c('missingBody')},
      context:{
        title:c('privacy'),
        body:`<div class="callout info">${ic('shield')}<span>${esc(c('ownerPrivacy'))}</span></div>`,
      }});
    return;
  }
  let payload;
  try{ payload=(await myWorkAdapter().claim(claimId)).data; }
  catch(error){
    caseDetailPage(root,{module:'mywork',route:'expense-claim',active:'my-claims',
      title:c('expenseClaim'),description:c('description'),
      empty:{icon:'warn',title:c('missing'),description:(error&&error.message)||c('missingBody')},
      context:{
        title:c('privacy'),
        body:`<div class="callout info">${ic('shield')}<span>${esc(c('ownerPrivacy'))}</span></div>`,
      }});
    return;
  }
  const claim=payload.claim||{},lines=Array.isArray(payload.lines)?payload.lines:[];
  const state=expenseStatusInfo(claim.status,c);
  const lineCards=lines.map(line=>{
    const policy=line.policy,control=line.control,approval=line.approval,posting=line.posting;
    const payment=c(line.paymentSource==='company_paid'?'companyPaid':'employeePaid');
    const allocation=(line.allocations||[]).map(item=>{
      const amount=item.mode==='percentage'
        ?`${Number(item.percentage||0).toFixed(2)}%`
        :expenseMoney(item.amountOriginal,line.originalCurrency);
      return `${esc(item.dimensionType)}: ${esc(item.dimensionKey)} · ${esc(amount)}`;
    }).join('<br>')||'—';
    const duplicate=control
      ?`${control.duplicateRiskScore}/100 · ${control.duplicateRiskLevel} ${c('risk')}`
      :c('noControl');
    const budget=control
      ?`${control.budgetBreached?c('breached'):c('withinBudget')}${control.remainingAfter==null?'':` · ${expenseMoney(control.remainingAfter,policy&&policy.functionalCurrency)} ${c('remaining')}`}`
      :c('noControl');
    const approvalState=approval?expenseStatusInfo(approval.status,c):null;
    const postingState=line.postingFailure
      ?`<div class="alert danger" data-expense-posting-failure>${ic('warn')}<span>${esc(c('postingFailed'))}: ${esc(line.postingFailure)}</span></div>`
      :posting
        ?`<div class="alert ok" data-expense-posting>${ic('check')}<span><b>${esc(c('journal'))} ${esc(posting.journalRef)}</b><br>${esc(expenseMoney(posting.baseGross,posting.functionalCurrency))}</span></div>`
        :`<small data-expense-posting>${esc(c('notPosted'))}</small>`;
    return `<article class="card" data-expense-line="${esc(String(line.lineNo))}">
      <div class="detail-head" style="padding:0 0 12px"><div class="dh-top">
        <div><h3>${esc(String(line.lineNo))}. ${esc(line.merchant)}</h3><span class="sub">${esc(dateValue(line.transactionDate))} · ${esc(line.categoryCode)}</span></div>
        <div style="margin-left:auto">${approvalState?cap(approvalState.label,approvalState.tone):cap(c('draft'),'neutral')}</div>
      </div></div>
      <div class="statgrid c3">
        <div class="stat"><small>${esc(c('original'))}</small><b class="tnum">${esc(expenseMoney(line.originalGross,line.originalCurrency))}</b></div>
        <div class="stat"><small>${esc(c('payment'))}</small><b>${esc(payment)}</b></div>
        <div class="stat"><small>${esc(c('functional'))}</small><b class="tnum">${esc(policy?expenseMoney(policy.baseGross,policy.functionalCurrency):'—')}</b></div>
      </div>
      <div class="card" style="margin-top:10px">
        <div class="field"><span class="k">${esc(c('purpose'))}</span><span class="v">${esc(line.purpose)}</span></div>
        <div class="field" data-expense-fx><span class="k">${esc(c('fx'))}</span><span class="v">${policy?`${esc(String(policy.policyFxRate))} · ${esc(policy.fxMethod)}`:esc(c('noPolicy'))}</span></div>
        ${policy&&policy.bankChargeOverride?`<div class="field"><span class="k">${esc(c('actualFx'))}</span><span class="v">${esc(String(policy.bankChargeOverride.actualFxRate))} · ${esc(expenseMoney(policy.bankChargeOverride.actualBaseGross,policy.functionalCurrency))}</span></div>`:''}
        <div class="field"><span class="k">${esc(c('tax'))}</span><span class="v">${policy?esc(expenseMoney(policy.baseInputTax,policy.functionalCurrency)):'—'}</span></div>
        <div class="field" data-expense-allocation><span class="k">${esc(c('allocation'))}</span><span class="v">${allocation}</span></div>
        <div class="field" data-expense-duplicate><span class="k">${esc(c('duplicate'))}</span><span class="v">${esc(duplicate)}${control&&control.duplicateOverride?` · ${esc(c('override'))}`:''}</span></div>
        <div class="field" data-expense-budget><span class="k">${esc(c('budget'))}</span><span class="v">${esc(budget)}</span></div>
        <div class="field"><span class="k">${esc(c('approval'))}</span><span class="v">${approvalState?esc(approvalState.label):esc(c('noApproval'))}</span></div>
      </div>
      <div style="margin-top:10px">${postingState}</div>
    </article>`;
  }).join('');
  const submittedBy=claim.submissionKind==='system'?c('system'):claim.submissionKind==='employee'?c('employee'):'—';
  caseDetailPage(root,{
    module:'mywork',route:'expense-claim',active:'my-claims',
    title:c('expenseClaim'),description:c('description'),
    identity:{title:claim.title,code:claim.claimNo,meta:`${c('version')} ${claim.version}`},
    statuses:[{label:state.label,tone:state.tone}],
    facts:[
      {label:c('lines'),value:lines.length,numeric:true},
      {label:c('amount'),value:claimTotals(lines),numeric:true},
      {label:c('submitted'),value:claim.submittedAt?dateValue(claim.submittedAt):'—'},
      {label:c('status'),value:submittedBy},
    ],
    lifecycle:[
      {label:c('draft'),state:claim.status==='draft'?'current':'complete'},
      {label:c('pending'),state:['pending_approval','partially_approved'].includes(claim.status)?'current':claim.status==='draft'?'upcoming':'complete'},
      {label:state.label,state:['approved','rejected','returned'].includes(claim.status)?'current':'upcoming'},
    ],
    main:lineCards||`<div class="statepanel empty">${ic('receipt')}<h3>${esc(c('empty'))}</h3></div>`,
    context:{title:c('privacy'),body:`<div class="callout info" data-expense-privacy>${ic('shield')}<span>${esc(c('ownerPrivacy'))}</span></div>
      <div class="card"><div class="field"><span class="k">${esc(c('version'))}</span><span class="v">${esc(String(claim.version||1))}</span></div>
      <div class="field"><span class="k">${esc(c('lines'))}</span><span class="v">${esc(String(lines.length))}</span></div></div>`},
    afterRender:({caseRoot})=>{
      caseRoot?.setAttribute('data-expense-state',claim.status||'unknown');
      caseRoot?.setAttribute('data-expense-owner-only','true');
    },
  });
};

function receiptCaptureCopy(){
  const packs={
    en:{title:'My Receipts',sub:'Capture secure receipt evidence online or offline. Files stay private and cannot enter a claim until later governance steps are delivered.',take:'Take photo',choose:'Choose file',syncAll:'Sync all',file:'File',state:'State',size:'Size',pages:'Pages',updated:'Updated',actions:'Actions',offline:'Offline draft',stored:'Stored · awaiting TASK-119 scan',edit:'Edit',sync:'Sync',remove:'Delete',empty:'No receipts or drafts',emptyBody:'Take a photo or choose JPEG, PNG, HEIC or PDF evidence (20 MB maximum; PDFs up to 20 pages).',limits:'JPEG · PNG · HEIC · PDF · 20 MB · PDF ≤ 20 pages',offlineNote:'Offline drafts are stored only on this device. Signing out warns and clears every unsynchronised draft.',editTitle:'Crop, rotate and compress',crop:'Crop',original:'Original',square:'Square',receipt:'Receipt 3:4',rotation:'Rotation',rotateLeft:'Rotate left',rotateRight:'Rotate right',quality:'JPEG quality',save:'Save edit',cancel:'Cancel',syncing:'Synchronising…',saved:'Receipt draft saved on this device.',uploaded:'Receipt uploaded securely.',deleted:'Receipt draft deleted.',offlineError:'You are offline. The draft remains safely on this device.',editUnavailable:'HEIC and PDF stay original because this browser cannot safely decode them for editing.',confirmDelete:'Delete this unsynchronised receipt draft?',error:'Receipt could not be processed.'},
    ms:{title:'Resit Saya',sub:'Tangkap bukti resit dengan selamat dalam talian atau luar talian. Fail kekal peribadi dan belum boleh dimasukkan ke tuntutan.',take:'Ambil foto',choose:'Pilih fail',syncAll:'Segerakkan semua',file:'Fail',state:'Keadaan',size:'Saiz',pages:'Halaman',updated:'Dikemas kini',actions:'Tindakan',offline:'Draf luar talian',stored:'Disimpan · menunggu imbasan TASK-119',edit:'Sunting',sync:'Segerak',remove:'Padam',empty:'Tiada resit atau draf',emptyBody:'Ambil foto atau pilih bukti JPEG, PNG, HEIC atau PDF (maksimum 20 MB; PDF sehingga 20 halaman).',limits:'JPEG · PNG · HEIC · PDF · 20 MB · PDF ≤ 20 halaman',offlineNote:'Draf luar talian disimpan pada peranti ini sahaja. Log keluar memberi amaran lalu memadam semua draf belum disegerakkan.',editTitle:'Pangkas, putar dan mampat',crop:'Pangkas',original:'Asal',square:'Segi empat',receipt:'Resit 3:4',rotation:'Putaran',rotateLeft:'Putar kiri',rotateRight:'Putar kanan',quality:'Kualiti JPEG',save:'Simpan suntingan',cancel:'Batal',syncing:'Menyegerak…',saved:'Draf resit disimpan pada peranti ini.',uploaded:'Resit dimuat naik dengan selamat.',deleted:'Draf resit dipadam.',offlineError:'Anda di luar talian. Draf kekal selamat pada peranti ini.',editUnavailable:'HEIC dan PDF kekal asal kerana pelayar ini tidak dapat menyahkodnya dengan selamat.',confirmDelete:'Padam draf resit belum disegerakkan ini?',error:'Resit tidak dapat diproses.'},
    zh:{title:'我的收据',sub:'在线或离线安全采集收据凭证。文件保持私密，后续治理步骤完成前不会进入报销单。',take:'拍摄收据',choose:'选择文件',syncAll:'全部同步',file:'文件',state:'状态',size:'大小',pages:'页数',updated:'更新时间',actions:'操作',offline:'离线草稿',stored:'已安全存储 · 等待 TASK-119 扫描',edit:'编辑',sync:'同步',remove:'删除',empty:'暂无收据或草稿',emptyBody:'拍照或选择 JPEG、PNG、HEIC、PDF 凭证（最大 20 MB；PDF 最多 20 页）。',limits:'JPEG · PNG · HEIC · PDF · 20 MB · PDF ≤ 20 页',offlineNote:'离线草稿只保存在此设备。登出时会先警告，确认后清除所有未同步草稿。',editTitle:'裁切、旋转与压缩',crop:'裁切',original:'原始',square:'正方形',receipt:'收据 3:4',rotation:'旋转',rotateLeft:'向左旋转',rotateRight:'向右旋转',quality:'JPEG 质量',save:'保存编辑',cancel:'取消',syncing:'正在同步…',saved:'收据草稿已保存在此设备。',uploaded:'收据已安全上传。',deleted:'收据草稿已删除。',offlineError:'当前离线，草稿仍安全保存在此设备。',editUnavailable:'浏览器无法安全解码 HEIC 与 PDF，因此会保留原件。',confirmDelete:'删除这份尚未同步的收据草稿？',error:'无法处理此收据。'},
    ja:{title:'自分の領収書',sub:'オンラインまたはオフラインで領収書を安全に取得します。後続の統制が完了するまで経費申請には入りません。',take:'写真を撮る',choose:'ファイルを選択',syncAll:'すべて同期',file:'ファイル',state:'状態',size:'サイズ',pages:'ページ',updated:'更新',actions:'操作',offline:'オフライン下書き',stored:'保存済み · TASK-119 スキャン待ち',edit:'編集',sync:'同期',remove:'削除',empty:'領収書または下書きはありません',emptyBody:'JPEG、PNG、HEIC、PDF を撮影または選択（最大20MB、PDFは20ページまで）。',limits:'JPEG · PNG · HEIC · PDF · 20 MB · PDF ≤ 20ページ',offlineNote:'下書きはこの端末だけに保存されます。サインアウト時に警告し、確認後に未同期下書きを消去します。',editTitle:'切り抜き・回転・圧縮',crop:'切り抜き',original:'元画像',square:'正方形',receipt:'領収書 3:4',rotation:'回転',rotateLeft:'左回転',rotateRight:'右回転',quality:'JPEG品質',save:'編集を保存',cancel:'キャンセル',syncing:'同期中…',saved:'領収書下書きをこの端末に保存しました。',uploaded:'領収書を安全にアップロードしました。',deleted:'下書きを削除しました。',offlineError:'オフラインです。下書きはこの端末に安全に残ります。',editUnavailable:'HEICとPDFは安全にデコードできないため元のまま保持します。',confirmDelete:'未同期の領収書下書きを削除しますか？',error:'領収書を処理できませんでした。'},
    vi:{title:'Biên lai của tôi',sub:'Chụp chứng từ biên lai an toàn khi trực tuyến hoặc ngoại tuyến. Tệp chưa được đưa vào yêu cầu chi phí cho đến bước quản trị sau.',take:'Chụp ảnh',choose:'Chọn tệp',syncAll:'Đồng bộ tất cả',file:'Tệp',state:'Trạng thái',size:'Kích thước',pages:'Số trang',updated:'Cập nhật',actions:'Thao tác',offline:'Bản nháp ngoại tuyến',stored:'Đã lưu · chờ quét TASK-119',edit:'Chỉnh sửa',sync:'Đồng bộ',remove:'Xóa',empty:'Không có biên lai hoặc bản nháp',emptyBody:'Chụp hoặc chọn JPEG, PNG, HEIC hay PDF (tối đa 20 MB; PDF tối đa 20 trang).',limits:'JPEG · PNG · HEIC · PDF · 20 MB · PDF ≤ 20 trang',offlineNote:'Bản nháp chỉ lưu trên thiết bị này. Đăng xuất sẽ cảnh báo rồi xóa mọi bản nháp chưa đồng bộ.',editTitle:'Cắt, xoay và nén',crop:'Cắt',original:'Gốc',square:'Vuông',receipt:'Biên lai 3:4',rotation:'Xoay',rotateLeft:'Xoay trái',rotateRight:'Xoay phải',quality:'Chất lượng JPEG',save:'Lưu chỉnh sửa',cancel:'Hủy',syncing:'Đang đồng bộ…',saved:'Đã lưu bản nháp trên thiết bị này.',uploaded:'Đã tải biên lai lên an toàn.',deleted:'Đã xóa bản nháp.',offlineError:'Bạn đang ngoại tuyến. Bản nháp vẫn an toàn trên thiết bị.',editUnavailable:'HEIC và PDF được giữ nguyên vì trình duyệt không thể giải mã an toàn.',confirmDelete:'Xóa bản nháp biên lai chưa đồng bộ này?',error:'Không thể xử lý biên lai.'},
  };
  const lang=typeof getLang==='function'?getLang():'en';
  const pack=packs[lang]||packs.en;
  const quarantine={
    en:{sub:'Every stored file stays quarantined until malware scanning is clean; preview, extraction, claims and export remain blocked beforehand.',stored:'Stored securely'},
    ms:{sub:'Setiap fail disimpan dalam kuarantin sehingga imbasan perisian hasad bersih; pratonton, pengekstrakan, tuntutan dan eksport disekat sebelumnya.',stored:'Disimpan dengan selamat'},
    zh:{sub:'每个已存文件在恶意软件扫描确认安全前都会保持隔离，预览、提取、报销与导出均被阻止。',stored:'已安全存储'},
    ja:{sub:'保存されたファイルはマルウェアスキャンが安全と確認するまで隔離され、プレビュー・抽出・申請・エクスポートはブロックされます。',stored:'安全に保存済み'},
    vi:{sub:'Mọi tệp đã lưu được cách ly đến khi quét mã độc xác nhận an toàn; xem trước, trích xuất, yêu cầu chi phí và xuất đều bị chặn trước đó.',stored:'Đã lưu an toàn'},
  };
  const safety=quarantine[lang]||quarantine.en;
  const confidence={
    en:{autoAuthorize:'Allow system submission when every critical field is at least 98% confident and all safety, amount and duplicate checks pass.',draftAuthorized:'Offline draft · system submission authorised',reviewRequired:'Human review required',readyReview:'Ready for review',autoSubmitted:'Submitted automatically'},
    ms:{autoAuthorize:'Benarkan penyerahan sistem hanya apabila semua medan kritikal sekurang-kurangnya 98% yakin dan semua semakan keselamatan, amaun serta pendua lulus.',draftAuthorized:'Draf luar talian · penyerahan sistem dibenarkan',reviewRequired:'Semakan manusia diperlukan',readyReview:'Sedia untuk semakan',autoSubmitted:'Dihantar secara automatik'},
    zh:{autoAuthorize:'仅当所有关键字段置信度至少为 98%，且安全、金额与重复检查全部通过时，允许系统提交。',draftAuthorized:'离线草稿 · 已授权系统提交',reviewRequired:'需要人工审核',readyReview:'等待人工审核',autoSubmitted:'已由系统自动提交'},
    ja:{autoAuthorize:'すべての重要項目が98%以上の信頼度で、安全性・金額・重複チェックを通過した場合のみシステム送信を許可します。',draftAuthorized:'オフライン下書き · システム送信を許可済み',reviewRequired:'人による確認が必要',readyReview:'確認準備完了',autoSubmitted:'自動送信済み'},
    vi:{autoAuthorize:'Chỉ cho phép hệ thống gửi khi mọi trường quan trọng đạt độ tin cậy ít nhất 98% và tất cả kiểm tra an toàn, số tiền, trùng lặp đều đạt.',draftAuthorized:'Bản nháp ngoại tuyến · đã cho phép hệ thống gửi',reviewRequired:'Cần người xem xét',readyReview:'Sẵn sàng để xem xét',autoSubmitted:'Đã tự động gửi'},
  };
  const governed=confidence[lang]||confidence.en;
  const governance={
    en:{storedDelete:'Delete draft',storedVoid:'Void',confirmStoredDelete:'Permanently delete this unsubmitted stored draft?',voidReason:'Enter the reason for voiding this submitted record:',storedDeleted:'Stored draft deleted.',voided:'Voided',voidedDone:'Submitted record voided.'},
    ms:{storedDelete:'Padam draf',storedVoid:'Batal',confirmStoredDelete:'Padam kekal draf tersimpan yang belum dihantar ini?',voidReason:'Masukkan sebab membatalkan rekod yang telah dihantar ini:',storedDeleted:'Draf tersimpan dipadam.',voided:'Dibatalkan',voidedDone:'Rekod yang dihantar telah dibatalkan.'},
    zh:{storedDelete:'删除草稿',storedVoid:'作废',confirmStoredDelete:'永久删除这份尚未提交的已存草稿？',voidReason:'请输入作废这份已提交记录的原因：',storedDeleted:'已删除存储草稿。',voided:'已作废',voidedDone:'已作废提交记录。'},
    ja:{storedDelete:'下書きを削除',storedVoid:'無効化',confirmStoredDelete:'未送信の保存済み下書きを完全に削除しますか？',voidReason:'送信済み記録を無効化する理由を入力してください：',storedDeleted:'保存済み下書きを削除しました。',voided:'無効化済み',voidedDone:'送信済み記録を無効化しました。'},
    vi:{storedDelete:'Xóa bản nháp',storedVoid:'Hủy hiệu lực',confirmStoredDelete:'Xóa vĩnh viễn bản nháp đã lưu nhưng chưa gửi này?',voidReason:'Nhập lý do hủy hiệu lực bản ghi đã gửi này:',storedDeleted:'Đã xóa bản nháp lưu trữ.',voided:'Đã hủy hiệu lực',voidedDone:'Đã hủy hiệu lực bản ghi đã gửi.'},
  };
  const recordGovernance=governance[lang]||governance.en;
  return key=>recordGovernance[key]||governed[key]||safety[key]||pack[key]||packs.en[key]||key;
}
function receiptBytes(value){
  const size=Number(value)||0;
  return size>=1024*1024?(size/(1024*1024)).toFixed(1)+' MB':Math.max(1,Math.ceil(size/1024))+' KB';
}
function receiptProcessingState(item){
  const packs={
    en:{queued:'Quarantined · scan queued',scanning:'Quarantined · scanning',unavailable:'Quarantined · scanner unavailable',indeterminate:'Quarantined · scan indeterminate',infected:'Blocked · malware detected',extracting:'Clean · extracting locally',extractionUnavailable:'Clean · extraction unavailable',extracted:'Clean · extracted'},
    ms:{queued:'Kuarantin · imbasan menunggu',scanning:'Kuarantin · sedang diimbas',unavailable:'Kuarantin · pengimbas tiada',indeterminate:'Kuarantin · hasil tidak pasti',infected:'Disekat · perisian hasad dikesan',extracting:'Bersih · ekstrak setempat',extractionUnavailable:'Bersih · pengekstrakan tiada',extracted:'Bersih · telah diekstrak'},
    zh:{queued:'已隔离 · 等待扫描',scanning:'已隔离 · 正在扫描',unavailable:'已隔离 · 扫描器不可用',indeterminate:'已隔离 · 扫描结果不确定',infected:'已阻止 · 检测到恶意文件',extracting:'扫描安全 · 本地提取中',extractionUnavailable:'扫描安全 · 提取服务不可用',extracted:'扫描安全 · 已提取'},
    ja:{queued:'隔離中 · スキャン待ち',scanning:'隔離中 · スキャン中',unavailable:'隔離中 · スキャナー利用不可',indeterminate:'隔離中 · 判定不能',infected:'ブロック済み · マルウェア検出',extracting:'安全 · ローカル抽出中',extractionUnavailable:'安全 · 抽出利用不可',extracted:'安全 · 抽出済み'},
    vi:{queued:'Cách ly · chờ quét',scanning:'Cách ly · đang quét',unavailable:'Cách ly · máy quét không sẵn sàng',indeterminate:'Cách ly · kết quả chưa xác định',infected:'Đã chặn · phát hiện mã độc',extracting:'An toàn · đang trích xuất cục bộ',extractionUnavailable:'An toàn · không thể trích xuất',extracted:'An toàn · đã trích xuất'},
  };
  const p=packs[typeof getLang==='function'?getLang():'en']||packs.en;
  const s=receiptCaptureCopy();
  if(item.recordStatus==='voided')return {label:s('voided'),tone:'danger'};
  if(item.inboxStatus==='review_required')return {label:s('reviewRequired'),tone:'warn'};
  if(item.inboxStatus==='ready')return {label:s('readyReview'),tone:'info'};
  if(item.inboxStatus==='submitted')return {label:s('autoSubmitted'),tone:'ok'};
  if(item.scanStatus==='infected')return {label:p.infected,tone:'danger'};
  if(item.scanStatus==='unavailable')return {label:p.unavailable,tone:'warn'};
  if(item.scanStatus==='indeterminate')return {label:p.indeterminate,tone:'warn'};
  if(item.scanStatus==='scanning')return {label:p.scanning,tone:'warn'};
  if(item.scanStatus!=='clean')return {label:p.queued,tone:'warn'};
  if(item.extractionStatus==='succeeded')return {label:p.extracted,tone:'ok'};
  if(['failed','unavailable'].includes(item.extractionStatus))return {label:p.extractionUnavailable,tone:'warn'};
  return {label:p.extracting,tone:'info'};
}
async function openReceiptEditor(draft,onDone){
  const s=receiptCaptureCopy();
  if(!['image/jpeg','image/png'].includes(draft.type)){toast(s('editUnavailable'),'warn');return;}
  let rotation=Number(draft.transform&&draft.transform.rotation)||0;
  appModal({icon:'crop',title:s('editTitle'),width:'min(680px, calc(100vw - 24px))',body:`
    <div class="formgrid">
      <label class="fld"><span>${esc(s('crop'))}</span><select data-receipt-crop>
        <option value="original">${esc(s('original'))}</option><option value="square">${esc(s('square'))}</option>
        <option value="receipt">${esc(s('receipt'))}</option></select></label>
      <label class="fld"><span>${esc(s('quality'))}</span><input type="range" min="45" max="95" value="82" data-receipt-quality></label>
    </div>
    <div class="toolbar"><small>${esc(s('rotation'))}: <b data-receipt-rotation>${rotation}°</b></small><div class="grow"></div>
      ${btn(s('rotateLeft'),{icon:'undo',attrs:'data-receipt-rotate="-90"'})}
      ${btn(s('rotateRight'),{icon:'redo',attrs:'data-receipt-rotate="90"'})}</div>
    <div class="callout info">${ic('info')}<span>${esc(s('limits'))}</span></div>
    <div class="auth-error" data-receipt-edit-error role="alert"></div>`,
    actions:`${btn(s('cancel'),{attrs:'onclick="closeModal()"'})}${btn(s('save'),{icon:'check',cls:'primary',attrs:'data-receipt-edit-save'})}`});
  const modal=$('#modalEl');
  modal.querySelectorAll('[data-receipt-rotate]').forEach(button=>button.addEventListener('click',()=>{
    rotation=(rotation+Number(button.dataset.receiptRotate)+360)%360;
    modal.querySelector('[data-receipt-rotation]').textContent=rotation+'°';
  }));
  modal.querySelector('[data-receipt-edit-save]').addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{
      await window.ErpReceiptDrafts.transformImage(draft.id,{
        rotation,crop:modal.querySelector('[data-receipt-crop]').value,
        quality:Number(modal.querySelector('[data-receipt-quality]').value)/100,
      });
      closeModal();await onDone();
    }catch(error){modal.querySelector('[data-receipt-edit-error]').textContent=(error&&error.message)||s('error');button.disabled=false;}
  });
}
SCREENS['my-receipts']=async function(root){
  const s=receiptCaptureCopy(),adapter=myWorkAdapter(),draftStore=window.ErpReceiptDrafts;
  if(!draftStore) throw new Error('Offline receipt draft storage is unavailable.');
  let response;
  try{ response=await adapter.receipts(); }
  catch(error){
    if(!isMyWorkIdentityError(error)) throw error;
    myWorkIdentityPage(root,'my-receipts',s('title'),s('sub'));return;
  }
  const drafts=await draftStore.list();
  const stored=Array.isArray(response.data)?response.data:[];
  const rows=[
    ...drafts.map(draft=>({id:draft.id,kind:'draft',name:draft.name,state:s(draft.autoSubmitAuthorized?'draftAuthorized':'offline'),size:draft.size,pages:'—',updated:draft.updatedAt,draft})),
    ...stored.map(item=>{
      const processing=receiptProcessingState(item);
      return {id:'stored-'+item.id,kind:'stored',name:item.originalFileName,state:processing.label,tone:processing.tone,size:item.sizeBytes,pages:item.pageCount||1,updated:item.createdAt,item};
    }),
  ];
  const rerender=()=>navigate('my-receipts');
  async function capture(files,source){
    const file=files&&files[0];if(!file)return;
    try{
      file.__captureSource=source;
      const authorized=Boolean(root.querySelector('[data-receipt-auto-authorize]')?.checked);
      await draftStore.putFile(file,{autoSubmitAuthorized:authorized});
      toast(s('saved'),'ok');await rerender();
    }
    catch(error){toast((error&&error.message)||s('error'),'danger');}
  }
  async function syncDraft(draft){
    if(!navigator.onLine){toast(s('offlineError'),'warn');return;}
    try{await adapter.uploadReceipt(draft);await draftStore.remove(draft.id);toast(s('uploaded'),'ok');await rerender();}
    catch(error){toast((error&&error.message)||s('error'),'danger');}
  }
  async function syncAllDrafts(){
    if(!navigator.onLine){toast(s('offlineError'),'warn');return;}
    try{
      for(const draft of await draftStore.list()){
        await adapter.uploadReceipt(draft);
        await draftStore.remove(draft.id);
      }
      toast(s('uploaded'),'ok');
      await rerender();
    }catch(error){toast((error&&error.message)||s('error'),'danger');}
  }
  transactionListPage(root,{
    module:'mywork',route:'my-receipts',title:s('title'),description:s('sub'),rows,rowId:row=>row.id,
    primaryAction:{label:s('take'),icon:'camera',onClick:()=>root.querySelector('[data-receipt-camera]').click()},
    toolbarActions:[
      {label:s('choose'),icon:'upload',onClick:()=>root.querySelector('[data-receipt-file]').click()},
      {label:s('syncAll'),icon:'sync',disabled:!drafts.length,onClick:syncAllDrafts},
    ],
    toolbarContent:`<input hidden type="file" accept="image/jpeg,image/png,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.heic,.heif,.pdf" capture="environment" data-receipt-camera>
      <input hidden type="file" accept="image/jpeg,image/png,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.heic,.heif,.pdf" data-receipt-file>
      <label class="checkline"><input type="checkbox" data-receipt-auto-authorize> <span>${esc(s('autoAuthorize'))}</span></label>`,
    kpis:[{label:s('offline'),value:drafts.length,accent:drafts.length>0},{label:s('stored'),value:stored.length}],
    columns:[
      {key:'name',label:s('file'),primary:true},
      {key:'state',label:s('state'),render:row=>`<span class="badge ${row.kind==='draft'?'warn':row.tone||'ok'}">${esc(row.state)}</span>`},
      {key:'size',label:s('size'),numeric:true,render:row=>esc(receiptBytes(row.size))},
      {key:'pages',label:s('pages'),numeric:true},
      {key:'updated',label:s('updated'),render:row=>esc(dateValue(row.updated))},
      {key:'actions',label:s('actions'),render:row=>row.kind==='draft'
        ?`<div class="row-actions">
          ${btn(s('edit'),{icon:'edit',sm:true,attrs:`data-receipt-edit="${esc(row.draft.id)}"`})}
          ${btn(s('sync'),{icon:'sync',sm:true,attrs:`data-receipt-sync="${esc(row.draft.id)}"`})}
          ${btn(s('remove'),{icon:'trash',cls:'danger',sm:true,attrs:`data-receipt-delete="${esc(row.draft.id)}"`})}</div>`
        :row.item.recordStatus==='draft'
          ?btn(s('storedDelete'),{icon:'trash',cls:'danger',sm:true,attrs:`data-receipt-delete-stored="${esc(row.item.id)}"`})
          :['submitted','approved'].includes(row.item.recordStatus)
            ?btn(s('storedVoid'),{icon:'x',cls:'danger',sm:true,attrs:`data-receipt-void-stored="${esc(row.item.id)}"`})
            :'—'},
    ],
    empty:{icon:'receipt',title:s('empty'),description:s('emptyBody')},
    note:s('limits'),
    afterRender:({root:screenRoot})=>{
      screenRoot.querySelector('[data-layout="transaction-list-v1"]')?.setAttribute('data-receipt-capture','canonical');
      const note=document.createElement('div');note.className='callout warn';note.setAttribute('data-offline-draft-warning','');
      note.innerHTML=`${ic('info')}<span>${esc(s('offlineNote'))}</span>`;
      screenRoot.querySelector('[data-list-table]')?.before(note);
      screenRoot.querySelector('[data-receipt-camera]')?.addEventListener('change',event=>capture(event.target.files,'camera'));
      screenRoot.querySelector('[data-receipt-file]')?.addEventListener('change',event=>capture(event.target.files,'file'));
      screenRoot.querySelectorAll('[data-receipt-edit]').forEach(button=>button.addEventListener('click',async event=>{
        event.stopPropagation();const draft=await draftStore.get(button.dataset.receiptEdit);if(draft)openReceiptEditor(draft,rerender);
      }));
      screenRoot.querySelectorAll('[data-receipt-sync]').forEach(button=>button.addEventListener('click',async event=>{
        event.stopPropagation();const draft=await draftStore.get(button.dataset.receiptSync);if(draft)await syncDraft(draft);
      }));
      screenRoot.querySelectorAll('[data-receipt-delete]').forEach(button=>button.addEventListener('click',async event=>{
        event.stopPropagation();if(!confirm(s('confirmDelete')))return;
        await draftStore.remove(button.dataset.receiptDelete);toast(s('deleted'),'ok');await rerender();
      }));
      screenRoot.querySelectorAll('[data-receipt-delete-stored]').forEach(button=>button.addEventListener('click',async event=>{
        event.stopPropagation();if(!confirm(s('confirmStoredDelete')))return;
        try{
          await adapter.deleteStoredReceipt(button.dataset.receiptDeleteStored);
          toast(s('storedDeleted'),'ok');await rerender();
        }catch(error){toast((error&&error.message)||s('error'),'danger');}
      }));
      screenRoot.querySelectorAll('[data-receipt-void-stored]').forEach(button=>button.addEventListener('click',async event=>{
        event.stopPropagation();
        const item=stored.find(candidate=>String(candidate.id)===button.dataset.receiptVoidStored);
        if(!item)return;
        const reason=prompt(s('voidReason'),'');
        if(reason===null)return;
        try{
          await adapter.voidStoredReceipt(item,reason);
          toast(s('voidedDone'),'ok');await rerender();
        }catch(error){toast((error&&error.message)||s('error'),'danger');}
      }));
    },
  });
};

async function renderMyWorkTeamRoute(root,{route,approvals=false}){
  const copy=myWorkCopy();
  const statusCopy=hrCopy();
  const adapter=myWorkAdapter();
  let context;
  try{ context=(await adapter.context()).data; }
  catch(error){
    if(!isMyWorkIdentityError(error)) throw error;
    myWorkIdentityPage(
      root,route,
      copy(approvals?'approvalsTitle':'teamTitle'),
      copy(approvals?'approvalsDescription':'teamDescription'),
    );
    return;
  }
  if(!context.capabilities||!context.capabilities.team||!context.capabilities.team.available){
    myWorkEmptyPage(root,{
      route,
      title:copy(approvals?'approvalsTitle':'teamTitle'),
      description:copy(approvals?'approvalsDescription':'teamDescription'),
      emptyTitle:copy('teamUnavailable'),emptyDescription:copy('teamUnavailableBody'),
      privacy:'reason_and_evidence_redacted',
    });
    return;
  }
  const response=await adapter.teamLeaveRequests();
  const source=Array.isArray(response.data)?response.data:[];
  const rows=approvals?source.filter(row=>row.status==='pending'):source;
  transactionListPage(root,{
    module:'mywork',route,
    title:copy(approvals?'approvalsTitle':'teamTitle'),
    description:copy(approvals?'approvalsDescription':'teamDescription'),
    rows,rowId:row=>row.id,
    filters:approvals?[]:[
      ['all',statusCopy('filterAllStatus')],
      ['pending',statusCopy('statusPending')],
      ['approved',statusCopy('statusApproved')],
      ['rejected',statusCopy('statusRejected')],
    ],
    filterFn:(row,status)=>row.status===status,
    columns:myWorkLeaveColumns(copy,statusCopy,{team:true}),
    note:copy(approvals?'approvalPreview':'calendarPreview'),
    empty:{
      icon:approvals?'check':'calendar',
      title:copy(approvals?'noApprovals':'noTeamLeave'),
      description:copy(approvals?'noApprovalsBody':'noTeamLeaveBody'),
    },
    afterRender:myWorkAfterRender(route,'reason_and_evidence_redacted'),
  });
}

function teamCalendarCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{title:'Team Calendar',description:'Review privacy-redacted availability in your authorised reporting scope.',month:'Month',week:'Week',list:'List',previous:'Previous',next:'Next',today:'Today',department:'Department',allDepartments:'All departments',status:'Status',allStatuses:'All statuses',scope:'Reporting scope',direct:'Direct reports',expanded:'Expanded tree',select:'Select an absence',selectBody:'Choose an event to review availability, conflict and sync facts.',noEvents:'No team absences in this period',more:'more',conflict:'Coverage conflict',conflicts:'overlapping team absences',privacy:'Private reasons and document references are never shown.',openApprovals:'Open My Approvals',retry:'Retry',sync:'External sync',notSynced:'Not queued',employee:'Employee',dates:'Dates',days:'Days',leaveType:'Leave type',job:'Role',close:'Close detail'},
    ms:{title:'Kalendar Pasukan',description:'Semak ketersediaan disunting privasi dalam skop pelaporan dibenarkan.',month:'Bulan',week:'Minggu',list:'Senarai',previous:'Sebelum',next:'Seterusnya',today:'Hari ini',department:'Jabatan',allDepartments:'Semua jabatan',status:'Status',allStatuses:'Semua status',scope:'Skop pelaporan',direct:'Laporan langsung',expanded:'Pokok diperluas',select:'Pilih ketidakhadiran',selectBody:'Pilih acara untuk semak ketersediaan, konflik dan fakta segerak.',noEvents:'Tiada ketidakhadiran pasukan dalam tempoh ini',more:'lagi',conflict:'Konflik liputan',conflicts:'ketidakhadiran pasukan bertindih',privacy:'Sebab peribadi dan rujukan dokumen tidak pernah dipaparkan.',openApprovals:'Buka Kelulusan Saya',retry:'Cuba lagi',sync:'Segerak luaran',notSynced:'Belum beratur',employee:'Pekerja',dates:'Tarikh',days:'Hari',leaveType:'Jenis cuti',job:'Peranan',close:'Tutup butiran'},
    zh:{title:'团队日历',description:'查看授权汇报范围内、已按隐私规则脱敏的人员可用情况。',month:'月',week:'周',list:'列表',previous:'上一期',next:'下一期',today:'今天',department:'部门',allDepartments:'所有部门',status:'状态',allStatuses:'所有状态',scope:'汇报范围',direct:'直属下属',expanded:'扩展汇报树',select:'选择缺勤事项',selectBody:'选择日历事项以查看可用性、冲突和同步事实。',noEvents:'此期间没有团队缺勤',more:'更多',conflict:'人力冲突',conflicts:'项重叠的团队缺勤',privacy:'不会显示私人原因或文件引用。',openApprovals:'打开我的审批',retry:'重试',sync:'外部同步',notSynced:'未排队',employee:'员工',dates:'日期',days:'天数',leaveType:'假期类型',job:'职位',close:'关闭详情'},
    ja:{title:'チームカレンダー',description:'許可された報告範囲の、プライバシー編集済み在席情報を確認します。',month:'月',week:'週',list:'一覧',previous:'前へ',next:'次へ',today:'今日',department:'部署',allDepartments:'すべての部署',status:'状態',allStatuses:'すべての状態',scope:'報告範囲',direct:'直属部下',expanded:'拡張ツリー',select:'不在を選択',selectBody:'予定を選択して在席、競合、同期情報を確認します。',noEvents:'この期間にチームの不在はありません',more:'件',conflict:'要員競合',conflicts:'件の重複不在',privacy:'非公開理由と文書参照は表示されません。',openApprovals:'自分の承認を開く',retry:'再試行',sync:'外部同期',notSynced:'未キュー',employee:'従業員',dates:'日付',days:'日数',leaveType:'休暇種別',job:'役職',close:'詳細を閉じる'},
    vi:{title:'Lịch nhóm',description:'Xem tình trạng sẵn sàng đã ẩn dữ liệu riêng tư trong phạm vi báo cáo được phép.',month:'Tháng',week:'Tuần',list:'Danh sách',previous:'Trước',next:'Sau',today:'Hôm nay',department:'Phòng ban',allDepartments:'Tất cả phòng ban',status:'Trạng thái',allStatuses:'Tất cả trạng thái',scope:'Phạm vi báo cáo',direct:'Báo cáo trực tiếp',expanded:'Cây mở rộng',select:'Chọn vắng mặt',selectBody:'Chọn sự kiện để xem tình trạng, xung đột và đồng bộ.',noEvents:'Không có nhân viên nhóm vắng trong kỳ này',more:'thêm',conflict:'Xung đột nhân lực',conflicts:'lịch vắng trùng nhau',privacy:'Không bao giờ hiển thị lý do riêng hoặc tham chiếu tài liệu.',openApprovals:'Mở Phê duyệt của tôi',retry:'Thử lại',sync:'Đồng bộ ngoài',notSynced:'Chưa xếp hàng',employee:'Nhân viên',dates:'Ngày',days:'Số ngày',leaveType:'Loại nghỉ',job:'Vai trò',close:'Đóng chi tiết'},
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

SCREENS['team-calendar']=async function(root){
  const c=teamCalendarCopy();
  const statusCopy=hrCopy();
  const lang=typeof getLang==='function'?getLang():'en';
  const locales={en:'en-SG',ms:'ms-MY',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'};
  let view='month';
  let cursor=hrToday();
  let selectedId=null;
  let rows=[];
  let departments=[];
  let department='all';
  let status='all';
  let reportingScope='direct';
  let canExpand=false;
  let error=null;
  function iso(date){return date.toISOString().slice(0,10);}
  function addDays(value,days){
    const date=new Date(`${value}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return iso(date);
  }
  function range(){
    const date=new Date(`${cursor}T00:00:00Z`);
    if(view==='month'){
      const from=iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1)));
      const to=iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)));
      return {from,to};
    }
    if(view==='week'){
      const day=(date.getUTCDay()+6)%7;
      return {from:addDays(cursor,-day),to:addDays(cursor,6-day)};
    }
    return {from:cursor,to:addDays(cursor,30)};
  }
  function periodLabel(){
    const date=new Date(`${cursor}T00:00:00Z`);
    if(view==='month') return new Intl.DateTimeFormat(locales[lang],{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
    const value=range();
    return `${dateValue(value.from)} → ${dateValue(value.to)}`;
  }
  function detail(row){
    const sync=row.sync?`${row.sync.eventType} · ${row.sync.status}`:c('notSynced');
    return `<div class="detail-head"><span class="grabber"></span>
      <button class="close" data-calendar-close>${ic('x')}${esc(c('close'))}</button>
      <div class="dh-top">${profileAvatar({name:row.employeeName,cls:'cav',size:42})}
        <div><h2>${esc(row.employeeName)}</h2><span class="sub">${esc(row.employeeNo)} · ${esc(row.department)}</span></div>
        <div style="margin-left:auto">${cap(myWorkLeaveStatus(row.status,statusCopy),myWorkStatusTone(row.status))}</div>
      </div></div>
      <div class="detail-body">
        <div class="alert info">${ic('shield')}<span>${esc(c('privacy'))}</span></div>
        ${row.conflict?`<div class="alert danger">${ic('warn')}<span><b>${esc(c('conflict'))}</b><br>${row.conflictCount} ${esc(c('conflicts'))}</span></div>`:''}
        <div class="card">
          <div class="field"><span class="k">${esc(c('employee'))}</span><span class="v">${esc(row.employeeName)}</span></div>
          <div class="field"><span class="k">${esc(c('job'))}</span><span class="v">${esc(row.jobTitle||'—')}</span></div>
          <div class="field"><span class="k">${esc(c('leaveType'))}</span><span class="v">${esc(row.leaveType)}</span></div>
          <div class="field"><span class="k">${esc(c('dates'))}</span><span class="v">${esc(dateValue(row.startDate))} → ${esc(dateValue(row.endDate))}</span></div>
          <div class="field"><span class="k">${esc(c('days'))}</span><span class="v tnum">${esc(String(row.days))}</span></div>
          <div class="field"><span class="k">${esc(c('sync'))}</span><span class="v">${esc(sync)}</span></div>
        </div>
      </div>`;
  }
  async function load(){
    error=null;
    try{
      const value=range();
      const response=await myWorkAdapter().teamCalendar({
        from:value.from,to:value.to,scope:reportingScope,department,status,
      });
      rows=response.data&&response.data.items||[];
      departments=Array.from(new Set(departments.concat(response.data&&response.data.departments||[]))).sort();
      canExpand=Boolean(response.meta&&response.meta.canExpand);
      if(reportingScope==='expanded'&&!canExpand) reportingScope='direct';
      if(selectedId&&!rows.some(row=>String(row.id)===String(selectedId))) selectedId=null;
    }catch(loadError){
      rows=[];
      error=loadError&&loadError.message||String(loadError);
    }
    render();
  }
  function render(){
    const weekdays=Array.from({length:7},(_,index)=>{
      const date=new Date(Date.UTC(2026,0,5+index));
      return new Intl.DateTimeFormat(locales[lang],{weekday:'short',timeZone:'UTC'}).format(date);
    });
    calendarWorkspacePage(root,{
      module:'mywork',route:'team-calendar',title:c('title'),description:c('description'),
      rows,view,cursor,selectedId,error,periodLabel:periodLabel(),
      privacy:c('privacy'),statusLabel:value=>myWorkLeaveStatus(value,statusCopy),
      labels:{
        month:c('month'),week:c('week'),list:c('list'),previous:c('previous'),
        next:c('next'),today:c('today'),select:c('select'),selectBody:c('selectBody'),
        noEvents:c('noEvents'),more:c('more'),conflict:c('conflict'),weekdays,
      },
      filters:()=>`<label class="fld"><span>${esc(c('department'))}</span><select data-calendar-department>
        <option value="all">${esc(c('allDepartments'))}</option>
        ${departments.map(item=>`<option value="${esc(item)}" ${item===department?'selected':''}>${esc(item)}</option>`).join('')}
      </select></label>
      <label class="fld"><span>${esc(c('status'))}</span><select data-calendar-status>
        <option value="all">${esc(c('allStatuses'))}</option>
        ${['pending','approved','cancelled'].map(item=>`<option value="${item}" ${item===status?'selected':''}>${esc(myWorkLeaveStatus(item,statusCopy))}</option>`).join('')}
      </select></label>
      <label class="fld"><span>${esc(c('scope'))}</span><select data-calendar-scope ${canExpand?'':'disabled'}>
        <option value="direct">${esc(c('direct'))}</option>
        ${canExpand?`<option value="expanded" ${reportingScope==='expanded'?'selected':''}>${esc(c('expanded'))}</option>`:''}
      </select></label>`,
      detail,
      actions:[
        ...(error?[{label:c('retry'),icon:'refresh',onClick:load}]:[]),
        {label:c('openApprovals'),icon:'check',cls:'primary',onClick:()=>navigate('my-approvals')},
      ],
      onNavigate:direction=>{
        if(direction==='today') cursor=hrToday();
        else if(view==='month'){
          const date=new Date(`${cursor}T00:00:00Z`);
          date.setUTCMonth(date.getUTCMonth()+Number(direction));cursor=iso(date);
        }else cursor=addDays(cursor,Number(direction)*(view==='week'?7:31));
        selectedId=null;load();
      },
      onView:next=>{view=next;selectedId=null;load();},
      onSelect:id=>{selectedId=String(id)===String(selectedId)?null:id;render();},
      afterRender:({root:screenRoot})=>{
        const layout=screenRoot.querySelector('[data-layout="calendar-workspace-v1"]');
        layout?.setAttribute('data-my-work-shell','true');
        layout?.setAttribute('data-my-work-view','team-calendar');
        layout?.setAttribute('data-my-work-privacy','reason_and_evidence_redacted');
        screenRoot.querySelector('[data-calendar-close]')?.addEventListener('click',()=>{
          selectedId=null;render();
        });
        screenRoot.querySelector('[data-calendar-department]')?.addEventListener('change',event=>{
          department=event.target.value;selectedId=null;load();
        });
        screenRoot.querySelector('[data-calendar-status]')?.addEventListener('change',event=>{
          status=event.target.value;selectedId=null;load();
        });
        screenRoot.querySelector('[data-calendar-scope]')?.addEventListener('change',event=>{
          reportingScope=event.target.value;selectedId=null;load();
        });
      },
    });
  }
  await load();
};

function myApprovalCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{title:'My Approvals',description:'Decide policy-assigned leave and expense steps without editing employee-owned facts.',step:'Current step',submitted:'Submitted',due:'Escalation due',capacity:'Capacity control',privacy:'Employee reasons and document references remain private in this manager view.',approve:'Approve step',reject:'Reject',return:'Return',note:'Decision note',reason:'Decision reason',reasonHint:'Required audit reason of at least 3 characters.',approved:'Approval step completed.',rejected:'Request rejected.',returned:'Expense line returned.',failed:'The approval decision could not be completed.',delegation:'Manage delegation',delegationTitle:'Approval delegation',delegate:'Delegate to',from:'Valid from',to:'Valid to',delegationReason:'Delegation reason',createDelegation:'Create delegation',revoke:'Revoke',activeDelegations:'Active and historical delegations',noDelegations:'No delegations created.',delegated:'Delegation created.',revoked:'Delegation revoked.',warn:'Warning only',extra:'Extra approval required',block:'Approval blocked',remaining:'staff remain',select:'Select an approval',selectBody:'Choose a policy-assigned leave or expense item to review its governed decision step.',leave:'Leave',expense:'Expense',merchant:'Merchant',claimed:'Claimed',payment:'Payment',allocation:'Allocation',duplicate:'Duplicate risk',budget:'Budget',fx:'FX',overrideDuplicate:'Override duplicate',postingFailure:'Posting failed; the decision remains retryable.',expensePrivacy:'Expense facts are read-only. Receipt content and unrelated employee evidence are not exposed.'},
    ms:{title:'Kelulusan Saya',description:'Putuskan langkah cuti dan perbelanjaan tanpa menyunting fakta milik pekerja.',step:'Langkah semasa',submitted:'Dihantar',due:'Eskalasi perlu',capacity:'Kawalan kapasiti',privacy:'Sebab pekerja dan rujukan dokumen kekal peribadi dalam paparan pengurus.',approve:'Luluskan langkah',reject:'Tolak',return:'Kembalikan',note:'Nota keputusan',reason:'Sebab keputusan',reasonHint:'Sebab audit sekurang-kurangnya 3 aksara diperlukan.',approved:'Langkah kelulusan selesai.',rejected:'Permohonan ditolak.',returned:'Baris perbelanjaan dikembalikan.',failed:'Keputusan kelulusan gagal.',delegation:'Urus perwakilan',delegationTitle:'Perwakilan kelulusan',delegate:'Wakil kepada',from:'Sah dari',to:'Sah hingga',delegationReason:'Sebab perwakilan',createDelegation:'Cipta perwakilan',revoke:'Batalkan',activeDelegations:'Perwakilan aktif dan sejarah',noDelegations:'Tiada perwakilan.',delegated:'Perwakilan dicipta.',revoked:'Perwakilan dibatalkan.',warn:'Amaran sahaja',extra:'Kelulusan tambahan diperlukan',block:'Kelulusan disekat',remaining:'kakitangan kekal',select:'Pilih kelulusan',selectBody:'Pilih cuti atau perbelanjaan yang ditugaskan untuk menyemak langkah keputusan.',leave:'Cuti',expense:'Perbelanjaan',merchant:'Peniaga',claimed:'Dituntut',payment:'Bayaran',allocation:'Peruntukan',duplicate:'Risiko pendua',budget:'Bajet',fx:'FX',overrideDuplicate:'Atasi pendua',postingFailure:'Catatan gagal; keputusan masih boleh dicuba semula.',expensePrivacy:'Fakta perbelanjaan hanya boleh dibaca. Kandungan resit dan bukti pekerja lain tidak didedahkan.'},
    zh:{title:'我的审批',description:'处理按政策分配的请假及费用步骤，不可编辑员工拥有的原始事实。',step:'当前步骤',submitted:'提交时间',due:'升级期限',capacity:'人力容量控制',privacy:'主管视图不会显示员工的私人原因及文件引用。',approve:'批准此步骤',reject:'拒绝',return:'退回',note:'决定备注',reason:'决定原因',reasonHint:'必须填写至少 3 个字符的审计原因。',approved:'审批步骤已完成。',rejected:'申请已拒绝。',returned:'费用行已退回。',failed:'无法完成审批决定。',delegation:'管理代理',delegationTitle:'审批代理',delegate:'代理人',from:'生效时间',to:'结束时间',delegationReason:'代理原因',createDelegation:'建立代理',revoke:'撤销',activeDelegations:'有效及历史代理',noDelegations:'尚未建立代理。',delegated:'审批代理已建立。',revoked:'审批代理已撤销。',warn:'仅警告',extra:'需要额外审批',block:'禁止批准',remaining:'名员工留岗',select:'选择审批事项',selectBody:'请选择一项按政策分配的请假或费用，处理当前受治理的决定步骤。',leave:'请假',expense:'费用',merchant:'商户',claimed:'申报金额',payment:'付款来源',allocation:'分摊',duplicate:'重复风险',budget:'预算',fx:'汇率',overrideDuplicate:'覆盖重复阻止',postingFailure:'记账失败；此决定仍可重试。',expensePrivacy:'费用事实只读，不会暴露收据内容或其他员工的凭证。'},
    ja:{title:'自分の承認',description:'従業員所有の情報を編集せず、割り当てられた休暇・経費ステップを決定します。',step:'現在のステップ',submitted:'提出日時',due:'エスカレーション期限',capacity:'要員管理',privacy:'管理者ビューでは従業員の理由と文書参照を表示しません。',approve:'ステップを承認',reject:'却下',return:'差し戻し',note:'決定メモ',reason:'決定理由',reasonHint:'3文字以上の監査理由が必要です。',approved:'承認ステップが完了しました。',rejected:'申請を却下しました。',returned:'経費明細を差し戻しました。',failed:'承認を完了できませんでした。',delegation:'委任を管理',delegationTitle:'承認の委任',delegate:'委任先',from:'開始',to:'終了',delegationReason:'委任理由',createDelegation:'委任を作成',revoke:'取消',activeDelegations:'有効・過去の委任',noDelegations:'委任はありません。',delegated:'委任を作成しました。',revoked:'委任を取り消しました。',warn:'警告のみ',extra:'追加承認が必要',block:'承認をブロック',remaining:'人が残ります',select:'承認を選択',selectBody:'割り当てられた休暇または経費を選択してください。',leave:'休暇',expense:'経費',merchant:'加盟店',claimed:'申請額',payment:'支払元',allocation:'配賦',duplicate:'重複リスク',budget:'予算',fx:'FX',overrideDuplicate:'重複をオーバーライド',postingFailure:'転記失敗。決定は再試行できます。',expensePrivacy:'経費情報は読み取り専用です。領収書内容や他の従業員の証拠は公開されません。'},
    vi:{title:'Phê duyệt của tôi',description:'Quyết định bước nghỉ phép và chi phí mà không sửa dữ liệu thuộc nhân viên.',step:'Bước hiện tại',submitted:'Đã gửi',due:'Hạn leo thang',capacity:'Kiểm soát nhân lực',privacy:'Lý do riêng và tham chiếu tài liệu không hiển thị trong chế độ quản lý.',approve:'Duyệt bước',reject:'Từ chối',return:'Trả lại',note:'Ghi chú quyết định',reason:'Lý do quyết định',reasonHint:'Cần lý do kiểm toán ít nhất 3 ký tự.',approved:'Đã hoàn tất bước phê duyệt.',rejected:'Đã từ chối yêu cầu.',returned:'Đã trả lại dòng chi phí.',failed:'Không thể hoàn tất quyết định.',delegation:'Quản lý ủy quyền',delegationTitle:'Ủy quyền phê duyệt',delegate:'Ủy quyền cho',from:'Hiệu lực từ',to:'Hiệu lực đến',delegationReason:'Lý do ủy quyền',createDelegation:'Tạo ủy quyền',revoke:'Thu hồi',activeDelegations:'Ủy quyền hiện tại và lịch sử',noDelegations:'Chưa có ủy quyền.',delegated:'Đã tạo ủy quyền.',revoked:'Đã thu hồi ủy quyền.',warn:'Chỉ cảnh báo',extra:'Cần thêm cấp duyệt',block:'Chặn phê duyệt',remaining:'nhân viên còn lại',select:'Chọn phê duyệt',selectBody:'Chọn nghỉ phép hoặc chi phí được giao để xử lý bước quyết định.',leave:'Nghỉ phép',expense:'Chi phí',merchant:'Đơn vị bán',claimed:'Đã yêu cầu',payment:'Thanh toán',allocation:'Phân bổ',duplicate:'Rủi ro trùng',budget:'Ngân sách',fx:'FX',overrideDuplicate:'Ghi đè trùng lặp',postingFailure:'Hạch toán lỗi; quyết định vẫn có thể thử lại.',expensePrivacy:'Dữ liệu chi phí chỉ đọc. Không hiển thị nội dung biên lai hoặc chứng từ của nhân viên khác.'},
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

SCREENS['my-approvals']=async function(root){
  const c=myApprovalCopy();
  const w=myWorkCopy();
  const adapter=myWorkAdapter();
  let rows=[];
  let loadError=null;
  async function reloadRows(){
    const results=await Promise.allSettled([adapter.approvals(),adapter.expenseApprovals()]);
    const leave=results[0].status==='fulfilled'?(results[0].value.data||[]):[];
    const expenses=results[1].status==='fulfilled'?(results[1].value.data||[]):[];
    rows=[
      ...leave.map(row=>({...row,approvalKind:'leave',rowKey:`leave-${row.requestId}`})),
      ...expenses.map(row=>({...row,approvalKind:'expense',rowKey:`expense-${row.link.id}`})),
    ];
    const failures=results.filter(result=>result.status==='rejected');
    loadError=failures.length===2
      ?failures.map(result=>result.reason&&result.reason.message||c('failed')).join(' · ')
      :null;
  }
  await reloadRows();
  let busyId=null;
  let actionError=null;
  const tone={warn:'warn',extra_approval:'violet',block:'danger',none:'neutral'};
  const capacityLabel=action=>c(action==='extra_approval'?'extra':action);
  async function decide(row,action,reason){
    busyId=row.rowKey; actionError=null; page.render();
    try{
      const result=row.approvalKind==='expense'
        ?await adapter.expenseApprovalAction(
          row.link.id,
          action==='approve'?'approved':action==='reject'?'rejected':'returned',
          reason||'',
        )
        :await adapter.approvalAction(row.requestId,action,{
          expectedVersion:row.requestVersion,reason:reason||'',
        });
      await reloadRows();
      busyId=null;
      toast(action==='approve'?c('approved'):action==='return'?c('returned'):c('rejected'),action==='approve'?'ok':'danger');
      if(row.approvalKind==='leave'&&result.data&&result.data.status==='pending'){
        navigate('my-approvals');
      }else{
        page.setFilter(page.getFilter());
      }
    }catch(error){
      busyId=null;
      actionError={id:row.rowKey,message:error&&error.message||c('failed')};
      page.render();
    }
  }
  async function overrideDuplicate(row,reason){
    busyId=row.rowKey;actionError=null;page.render();
    try{
      await adapter.expenseDuplicateOverride(row.assessment.id,reason);
      await reloadRows();busyId=null;toast(c('overrideDuplicate'),'ok');page.render();
    }catch(error){
      busyId=null;actionError={id:row.rowKey,message:error&&error.message||c('failed')};page.render();
    }
  }
  function expenseDetail(row){
    const busy=String(busyId)===String(row.rowKey);
    const error=actionError&&String(actionError.id)===String(row.rowKey)
      ?actionError.message:null;
    const line=row.line||{},claim=row.claim||{},assessment=row.assessment||{},snapshot=row.snapshot||{};
    const claimant=row.claimant||{};
    const allocation=(row.allocations||[]).map(item=>{
      const value=item.mode==='percentage'
        ?`${Number(item.percentage||0).toFixed(2)}%`
        :expenseMoney(item.amountOriginal,line.originalCurrency);
      return `${esc(item.dimensionType)}: ${esc(item.dimensionKey)} · ${esc(value)}`;
    }).join('<br>')||'—';
    const signals=(row.duplicateSignals||[]).map(signal=>
      `${esc(signal.signalType)} +${esc(String(signal.riskPoints))}`).join(' · ')||'—';
    const actual=row.bankChargeOverride;
    return `<div class="detail-head"><span class="grabber"></span>
      <button class="close" data-master-detail-close>${ic('chevL')}${esc(t('common.close'))}</button>
      <div class="dh-top">${profileAvatar({name:claimant.fullName||claim.claimNo,cls:'cav',size:42})}
        <div><h2>${esc(claimant.fullName||claim.claimNo)}</h2><span class="sub">${esc(claimant.department||'—')} · ${esc(claimant.employeeNo||'—')}</span></div>
        <div style="margin-left:auto">${cap(c('expense'),'violet')}</div>
      </div></div>
      <div class="detail-body" data-expense-approval-detail data-expense-read-only="true">
        ${error?`<div class="alert danger" data-expense-posting-failure>${ic('warn')}<span>${esc(error)}</span></div>`:''}
        <div class="alert info">${ic('shield')}<span>${esc(c('expensePrivacy'))}</span></div>
        <div class="statgrid c3">
          <div class="stat"><small>${esc(c('claimed'))}</small><b class="tnum">${esc(expenseMoney(line.originalGross,line.originalCurrency))}</b></div>
          <div class="stat"><small>${esc(c('step'))}</small><b>${esc(row.approval.stepLabel)}</b></div>
          <div class="stat"><small>${esc(c('fx'))}</small><b class="tnum">${esc(String(actual?actual.actualFxRate:snapshot.policyFxRate||'—'))}</b></div>
        </div>
        <div class="card">
          <div class="field"><span class="k">${esc(c('merchant'))}</span><span class="v">${esc(line.merchant)}</span></div>
          <div class="field"><span class="k">${esc(c('expense'))}</span><span class="v">${esc(claim.claimNo)} · ${esc(claim.title)}</span></div>
          <div class="field"><span class="k">${esc(c('payment'))}</span><span class="v">${esc(line.paymentSource)}</span></div>
          <div class="field" data-expense-allocation><span class="k">${esc(c('allocation'))}</span><span class="v">${allocation}</span></div>
          <div class="field" data-expense-fx><span class="k">${esc(c('fx'))}</span><span class="v">${esc(snapshot.originalCurrency)} → ${esc(snapshot.functionalCurrency)} · ${esc(String(snapshot.policyFxRate||'—'))}${actual?` · ${esc(String(actual.actualFxRate))}`:''}</span></div>
          <div class="field" data-expense-duplicate><span class="k">${esc(c('duplicate'))}</span><span class="v">${esc(String(assessment.duplicateRiskScore||0))}/100 · ${esc(assessment.duplicateRiskLevel||'none')}<br>${signals}</span></div>
          <div class="field" data-expense-budget><span class="k">${esc(c('budget'))}</span><span class="v">${esc(assessment.budgetBreached?c('block'):c('warn'))} · ${esc(assessment.budgetAction||'warn')}${assessment.remainingAfter==null?'':` · ${esc(expenseMoney(assessment.remainingAfter,snapshot.functionalCurrency))}`}</span></div>
        </div>
        ${assessment.duplicateRiskLevel==='high'&&!row.duplicateOverride
          ?`<div class="alert warn">${ic('warn')}<span>${esc(c('duplicate'))}</span>
            ${btn(c('overrideDuplicate'),{icon:'shield',sm:true,attrs:`data-expense-duplicate-override${busy?' disabled':''}`})}</div>`
          :row.duplicateOverride?`<div class="alert ok">${ic('check')}<span>${esc(c('overrideDuplicate'))}</span></div>`:''}
      </div>
      <div class="set-savebar" data-expense-approval-actions><div class="grow"></div>
        ${btn(c('return'),{icon:'undo',cls:'soft',attrs:`data-expense-approval-action="return"${busy?' disabled':''}`})}
        ${btn(c('reject'),{icon:'x',cls:'danger',attrs:`data-expense-approval-action="reject"${busy?' disabled':''}`})}
        ${btn(c('approve'),{icon:'check',cls:'primary',attrs:`data-expense-approval-action="approve"${busy?' disabled':''}`})}
      </div>`;
  }
  function detail(row){
    if(row.approvalKind==='expense') return expenseDetail(row);
    const capacity=row.capacity;
    const busy=String(busyId)===String(row.rowKey);
    const error=actionError&&String(actionError.id)===String(row.rowKey)
      ?actionError.message:null;
    return `<div class="detail-head"><span class="grabber"></span>
      <button class="close" data-master-detail-close>${ic('chevL')}${esc(t('common.close'))}</button>
      <div class="dh-top">${profileAvatar({name:row.employeeName,cls:'cav',size:42})}
        <div><h2>${esc(row.employeeName)}</h2><span class="sub">${esc(row.department)} · ${esc(row.jobTitle||'—')}</span></div>
        <div style="margin-left:auto">${cap(c('step')+' '+row.currentStepNo,'warn')}</div>
      </div></div>
      <div class="detail-body">
        ${error?`<div class="alert danger">${ic('warn')}<span>${esc(error)}</span></div>`:''}
        <div class="alert info">${ic('shield')}<span>${esc(c('privacy'))}</span></div>
        <div class="statgrid c3">
          <div class="stat"><small>${esc(c('step'))}</small><b>${esc(row.stepLabel)}</b></div>
          <div class="stat"><small>${esc(c('submitted'))}</small><b>${esc(dateValue(row.stepActivatedAt||row.startDate))}</b></div>
          <div class="stat"><small>${esc(w('days'))}</small><b class="tnum">${esc(String(row.days))}</b></div>
        </div>
        <div class="card">
          <div class="field"><span class="k">${esc(w('leaveType'))}</span><span class="v">${esc(row.leaveType)}</span></div>
          <div class="field"><span class="k">${esc(w('dates'))}</span><span class="v">${esc(dateValue(row.startDate))} → ${esc(dateValue(row.endDate))}</span></div>
          <div class="field"><span class="k">${esc(c('due'))}</span><span class="v">${row.stepDueAt?esc(dateValue(row.stepDueAt)):'—'}</span></div>
        </div>
        ${capacity?`<div class="alert ${capacity.breached?(capacity.action==='block'?'danger':'warn'):'ok'}">
          ${ic(capacity.action==='block'?'warn':'people')}<span><b>${esc(c('capacity'))} · ${esc(capacityLabel(capacity.action))}</b><br>
          ${esc(String(capacity.remainingStaff))} ${esc(c('remaining'))} · minimum ${esc(String(capacity.minimumStaff))}</span></div>`:''}
      </div>
      <div class="set-savebar"><div class="grow"></div>
        ${btn(c('reject'),{icon:'x',cls:'danger',attrs:`data-approval-action="reject"${busy?' disabled':''}`})}
        ${btn(c('approve'),{icon:'check',cls:'primary',attrs:`data-approval-action="approve"${busy?' disabled':''}`})}
      </div>`;
  }
  async function openDelegation(){
    const [delegations,candidates]=await Promise.all([
      adapter.approvalDelegations(),adapter.approvalDelegationCandidates(),
    ]);
    const history=delegations.data||[];
    const choices=(candidates.data||[]).map(person=>`<option value="${person.id}">${esc(person.fullName)} · ${esc(person.department)}</option>`).join('');
    const historyHtml=history.length?history.map(item=>`<div class="card" style="margin-bottom:8px">
      <div class="field"><span class="k">${esc(item.delegateName)}</span><span class="v">${esc(dateValue(item.validFrom))} → ${esc(dateValue(item.validTo))}</span></div>
      <div class="field"><span class="k">${esc(item.reason)}</span><span class="v">${item.revokedAt?cap(c('revoked'),'neutral'):btn(c('revoke'),{icon:'x',cls:'soft',sm:true,attrs:`data-revoke-delegation="${item.id}"`})}</span></div>
    </div>`).join(''):`<p class="muted">${esc(c('noDelegations'))}</p>`;
    appModal({icon:'flow',title:c('delegationTitle'),width:'min(760px, calc(100vw - 24px))',body:`
      <div class="fldrow c3"><div class="fld"><span>${esc(c('delegate'))}</span><select id="approvalDelegate">${choices}</select></div>
      <div class="fld"><span>${esc(c('from'))}</span><input id="approvalDelegateFrom" type="datetime-local"></div>
      <div class="fld"><span>${esc(c('to'))}</span><input id="approvalDelegateTo" type="datetime-local"></div></div>
      <div class="fld"><span>${esc(c('delegationReason'))}</span><input id="approvalDelegateReason"></div>
      <h4>${esc(c('activeDelegations'))}</h4>${historyHtml}`,
      actions:`${btn(t('common.close'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c('createDelegation'),{icon:'plus',cls:'primary',attrs:'data-create-delegation'})}`,
    });
    $('#modalEl').querySelector('[data-create-delegation]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;
      const delegateId=Number($('#approvalDelegate').value);
      const validFrom=$('#approvalDelegateFrom').value;
      const validTo=$('#approvalDelegateTo').value;
      const reason=$('#approvalDelegateReason').value.trim();
      if(!delegateId||!validFrom||!validTo||reason.length<3){
        toast(c('reasonHint'),'danger'); return;
      }
      button.disabled=true;
      try{
        await adapter.createApprovalDelegation({
          domain:'leave',delegateId,
          validFrom:new Date(validFrom).toISOString(),
          validTo:new Date(validTo).toISOString(),reason,
        });
        closeModal(); toast(c('delegated'),'ok');
      }catch(error){button.disabled=false;toast(error&&error.message||c('failed'),'danger');}
    });
    $('#modalEl').querySelectorAll('[data-revoke-delegation]').forEach(button=>button.addEventListener('click',async()=>{
      button.disabled=true;
      try{await adapter.revokeApprovalDelegation(Number(button.dataset.revokeDelegation));closeModal();toast(c('revoked'),'ok');}
      catch(error){button.disabled=false;toast(error&&error.message||c('failed'),'danger');}
    }));
  }
  let page=masterDetailRegisterPage(root,{
    module:'mywork',route:'my-approvals',title:c('title'),description:c('description'),
    rows:()=>rows,rowId:row=>row.rowKey,
    filters:[['all',w('approvalsTitle')],['leave',c('leave')],['expense',c('expense')]],
    filterFn:(row,kind)=>row.approvalKind===kind,
    note:()=>loadError,
    toolbarActions:[{
      label:c('delegation'),icon:'flow',onClick:openDelegation,disabled:!!loadError,
    }],
    kpis:()=>[
      {label:c('title'),value:rows.length,accent:rows.length>0},
      {label:c('expense'),value:rows.filter(row=>row.approvalKind==='expense').length},
      {label:c('block'),value:rows.filter(row=>
        row.approvalKind==='leave'
          ?row.capacity&&row.capacity.action==='block'&&row.capacity.breached
          :row.assessment&&row.assessment.budgetBreached&&row.assessment.budgetAction==='block'
      ).length,negative:true},
    ],
    columns:[
      {label:w('employee'),align:'l',w:'minmax(180px,2fr)',render:row=>`<div class="cellsub"><b>${esc(row.approvalKind==='expense'?row.claimant.fullName:row.employeeName)}</b><small>${esc(row.approvalKind==='expense'?row.claimant.department:row.department)}</small></div>`},
      {label:c('title'),align:'l',render:row=>row.approvalKind==='expense'
        ?`<div class="cellsub"><b>${esc(row.claim.claimNo)}</b><small>${esc(row.line.merchant)}</small></div>`
        :esc(row.leaveType)},
      {label:c('claimed'),align:'l',w:'minmax(160px,1.4fr)',render:row=>row.approvalKind==='expense'
        ?esc(expenseMoney(row.line.originalGross,row.line.originalCurrency))
        :`${esc(dateValue(row.startDate))} → ${esc(dateValue(row.endDate))}`},
      {label:c('step'),align:'l',render:row=>`<div class="cellsub"><b>${esc(row.approvalKind==='expense'?row.approval.stepLabel:row.stepLabel)}</b><small>#${esc(String(row.approvalKind==='expense'?row.approval.currentStepNo:row.currentStepNo))}</small></div>`},
      {label:c('capacity'),align:'l',render:row=>row.approvalKind==='expense'
        ?cap(`${row.assessment.duplicateRiskScore}/100`,row.assessment.duplicateRiskLevel==='high'?'danger':'neutral')
        :row.capacity?cap(capacityLabel(row.capacity.action),tone[row.capacity.action]||'neutral'):'—'},
    ],
    empty:{
      icon:loadError?'warn':'check',
      title:loadError?c('failed'):w('noApprovals'),
      description:loadError||w('noApprovalsBody'),
    },
    detailPane:{
      rowLabel:row=>`${c('title')} · ${row.approvalKind==='expense'?row.claimant.fullName:row.employeeName}`,
      initialSelectedId:()=>window.matchMedia('(max-width:980px)').matches?null:(rows[0]&&rows[0].rowKey),
      empty:`<div class="detail-empty">${ic('check')}<div><b>${esc(c('select'))}</b><small>${esc(c('selectBody'))}</small></div></div>`,
      content:detail,
      afterRender:({detailRoot,row})=>{
        if(row&&row.approvalKind==='expense'){
          detailRoot?.querySelector('[data-expense-approval-action="approve"]')?.addEventListener('click',()=>decide(row,'approve',''));
          ['reject','return'].forEach(action=>{
            detailRoot?.querySelector(`[data-expense-approval-action="${action}"]`)?.addEventListener('click',()=>{
              appModal({icon:action==='reject'?'x':'undo',title:c(action),body:`<div class="fld"><span>${esc(c('reason'))}</span><textarea id="expenseApprovalReason"></textarea><span class="hint">${esc(c('reasonHint'))}</span></div>`,actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c(action),{icon:action==='reject'?'x':'undo',cls:action==='reject'?'danger-solid':'primary',attrs:'data-confirm-expense-decision'})}`});
              $('#modalEl').querySelector('[data-confirm-expense-decision]')?.addEventListener('click',()=>{
                const reason=$('#expenseApprovalReason').value.trim();
                if(reason.length<3){toast(c('reasonHint'),'danger');return;}
                closeModal();decide(row,action,reason);
              });
            });
          });
          detailRoot?.querySelector('[data-expense-duplicate-override]')?.addEventListener('click',()=>{
            appModal({icon:'shield',title:c('overrideDuplicate'),body:`<div class="fld"><span>${esc(c('reason'))}</span><textarea id="expenseOverrideReason"></textarea><span class="hint">${esc(c('reasonHint'))}</span></div>`,actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c('overrideDuplicate'),{icon:'shield',cls:'primary',attrs:'data-confirm-expense-override'})}`});
            $('#modalEl').querySelector('[data-confirm-expense-override]')?.addEventListener('click',()=>{
              const reason=$('#expenseOverrideReason').value.trim();
              if(reason.length<3){toast(c('reasonHint'),'danger');return;}
              closeModal();overrideDuplicate(row,reason);
            });
          });
          return;
        }
        if(!row)return;
        detailRoot?.querySelector('[data-approval-action="approve"]')?.addEventListener('click',()=>decide(row,'approve',''));
        detailRoot?.querySelector('[data-approval-action="reject"]')?.addEventListener('click',()=>{
          appModal({icon:'x',title:c('reject'),body:`<div class="fld"><span>${esc(c('reason'))}</span><textarea id="approvalRejectReason"></textarea><span class="hint">${esc(c('reasonHint'))}</span></div>`,actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c('reject'),{icon:'x',cls:'danger-solid',attrs:'data-confirm-approval-reject'})}`});
          $('#modalEl').querySelector('[data-confirm-approval-reject]')?.addEventListener('click',()=>{
            const reason=$('#approvalRejectReason').value.trim();
            if(reason.length<3){toast(c('reasonHint'),'danger');return;}
            closeModal();decide(row,'reject',reason);
          });
        });
      },
    },
  });
};

/* ---------------- EMPLOYEE DIRECTORY (listing — module landing) ---------------- */
SCREENS['hr-directory'] = async function(root){
  const s=hrCopy();
  const {employees,leaveRequests}=await prepareHrData();
  const depts=[...new Set(employees.map(e=>e.department))];
  const chips=[['all',t('common.all')]].concat(depts.map(d=>[d,d]));
  const onLeave=employees.filter(e=>hrIsOnLeaveToday(e.id,leaveRequests)).length;
  const pending=leaveRequests.filter(l=>l.status==='pending').length;
  transactionListPage(root,{
    module:'hr',route:'hr-directory',title:t('hr.title'),
    rows:employees,rowId:e=>e.id,
    filters:chips,filterFn:(employee,department)=>employee.department===department,
    kpis:[
      {label:t('hr.t.headcount'),value:employees.length},
      {label:t('hr.t.onleave'),value:onLeave,accent:true},
      {label:t('hr.t.pending'),value:pending,filter:null,negative:pending>0},
    ],
    primaryAction:{label:t('hr.add'),icon:'plus',onClick:()=>navigate('new-employee')},
    toolbarActions:[{label:t('hr.leave'),icon:'calendar',onClick:()=>navigate('leave-approval')}],
    columns:[
      {label:t('hr.col.employee'),render:e=>`<div style="display:flex;align-items:center;gap:11px">${profileAvatar({name:e.fullName,src:e.photoUrl||e.imageUrl||e.avatarUrl,size:30})}<div class="cellsub"><b>${esc(e.fullName)}</b><small>${esc(e.employeeNo)}</small></div></div>`},
      {label:t('hr.col.dept'),align:'l',render:e=>esc(e.department)},
      {label:t('hr.col.role'),align:'l',render:e=>esc(e.jobTitle)},
      {label:t('qc.col.type'),align:'l',render:e=>e.employmentType==='Contract'?cap(t('hr.emp.contract'),'violet'):cap(hrEmploymentTypeLabel(s,e.employmentType),'neutral')},
      {label:t('hr.col.joined'),align:'l',render:e=>esc(dateValue(e.startDate))},
      {label:t('col.status'),align:'l',render:e=>{ const st=hrStatusOf(e,leaveRequests); return cap(hrStatusLabel(s,st),hrStatusTone(st)); }},
    ],
    rowAction:{
      label:e=>`${t('common.open')} ${e.employeeNo}`,
      run:e=>navigate('employee',{employeeId:Number(e.id)}),
    },
    empty:{icon:'people',title:'No employees'},
  });
};

/* ---------------- EMPLOYEE PROFILE (master) ---------------- */
SCREENS['employee'] = async function(root, params){
  const s=hrCopy();
  const ac=employeeAccountCopy();
  const {employees,leaveRequests}=await prepareHrData();
  const requestedId=params&&params.employeeId?Number(params.employeeId):null;
  const e=requestedId?employees.find(row=>row.id===requestedId):employees[0];
  if(!e){
    masterDetailEditorPage(root,{
      module:'hr',route:'employee',title:s('employeeProfileTitle'),
      description:s('employeeProfileDescription'),
      crumb:[DB.company.name,{label:t('nav.hr'),route:'hr-directory'},{cur:t('hr.crumb')}],
      empty:{icon:'people',title:s('noEmployeeFound'),description:s('noEmployeeBody')},
      afterRender:({editor})=>{
        editor?.setAttribute('data-canonical-employee','true');
      },
    });
    return;
  }
  const manager=e.managerId?employees.find(m=>m.id===e.managerId):null;
  const status=hrStatusOf(e,leaveRequests);
  const used=hrAnnualLeaveUsed(e.id,leaveRequests);
  const total=e.annualLeaveDays;
  const remaining=Math.max(0,total-used);
  const pct=total>0?Math.max(0,Math.min(100,Math.round(remaining/total*100))):0;
  const myLeave=leaveRequests.filter(lv=>lv.employeeId===e.id).sort((a,b)=>dateValue(b.startDate).localeCompare(dateValue(a.startDate)));
  let account=null;
  try{ account=(await window.ErpSystemData.get('hr/employee-accounts',e.id)).data; }catch(error){
    if(error&&error.code!=='route_not_found'&&error.code!=='resource_not_found') console.warn('Employee account read failed',error);
  }
  const accountLabel=!account||!account.userId?ac('none'):ac(account.accountState||'active');
  const accountTone=!account||!account.userId?'neutral':account.accountState==='active'?'ok':account.accountState==='offboarded'?'neutral':'warn';
  const availableTargets=employees.filter(row=>row.id!==e.id&&row.isActive);
  const accountControls=!account||!account.userId
    ? btn(ac('create'),{icon:'plus',cls:'soft',sm:true,attrs:'data-employee-account-create'})
    : account.accountState!=='offboarded'
      ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${account.passwordChangeRequired?btn(ac('reveal'),{icon:'eye',cls:'soft',sm:true,attrs:'data-employee-account-reveal'}):''}${btn(ac('reset'),{icon:'refresh',cls:'soft',sm:true,attrs:'data-employee-account-reset'})}${btn(ac('offboard'),{icon:'x',cls:'soft',sm:true,attrs:'data-employee-account-offboard'})}</div>`
      : '';
  const leaveStatusTone={pending:'warn',approved:'ok',rejected:'danger'};
  const leaveRows=myLeave.map(lv=>`<tr data-employee-leave-row>
      <td class="l li-name"><b>${esc(lv.leaveType)}</b></td>
      <td class="l tnum">${esc(dateValue(lv.startDate))} → ${esc(dateValue(lv.endDate))}</td>
      <td class="tnum">${esc(String(lv.days))}</td>
      <td class="l">${cap(hrLeaveStatusLabel(s,lv.status),leaveStatusTone[lv.status]||'neutral')}</td>
    </tr>`).join('');
  const leaveBody=leaveRows
    ? `<div class="master-detail-editor-table-scroll"><table class="lines">
        <thead><tr><th class="l">${esc(s('colLeaveType'))}</th><th class="l">${esc(s('colDates'))}</th>
          <th>${esc(s('colDays'))}</th><th class="l">${esc(t('col.status'))}</th></tr></thead>
        <tbody>${leaveRows}</tbody></table></div>`
    : `<div class="master-detail-editor-inline-empty" data-employee-leave-empty>
        ${ic('calendar')}<span>${esc(s('noLeaveRequests'))}</span></div>`;
  const remainingLabel=s('annualLeaveRemaining')
    .replace('{remaining}',remaining)
    .replace('{total}',total);
  const usedLabel=s('annualLeaveUsed').replace('{used}',used).replace('{total}',total);
  masterDetailEditorPage(root,{
    module:'hr',route:'employee',title:s('employeeProfileTitle'),
    description:s('employeeProfileDescription'),
    crumb:[DB.company.name,{label:t('nav.hr'),route:'hr-directory'},{label:t('hr.crumb'),route:'hr-directory'},{cur:e.employeeNo}],
    status:{label:hrStatusLabel(s,status),tone:hrStatusTone(status)},
    headerActions:btn(s('reviewLeave'),{
      icon:'check',cls:'primary',sm:false,attrs:'data-employee-review',
    }),
    overview:{
      avatar:{name:e.fullName,src:e.photoUrl||e.imageUrl||e.avatarUrl,size:48},
      title:e.fullName,
      code:e.employeeNo,
      meta:`${e.jobTitle} · ${e.department}`,
      facts:[
        {label:s('fieldDept'),value:e.department},
        {label:s('fieldEmployment'),value:hrEmploymentTypeLabel(s,e.employmentType)},
        {label:s('fieldJoined'),value:dateValue(e.startDate)},
        {label:s('fieldManager'),value:manager?manager.fullName:s('noManager')},
      ],
    },
    main:`
      <div class="panel" data-employee-contact>
        <div class="panel-h"><h3>${esc(s('personalContact'))}</h3></div>
        <div class="master-detail-editor-facts employee-contact-facts">
          <div class="master-detail-editor-fact">
            <small>${esc(s('fieldEmail'))}</small><b title="${esc(e.email)}">${esc(e.email)}</b>
          </div>
          <div class="master-detail-editor-fact">
            <small>${esc(s('fieldPhone'))}</small><b title="${e.phone?esc(e.phone):esc(s('noPhone'))}">${e.phone?esc(e.phone):esc(s('noPhone'))}</b>
          </div>
        </div>
      </div>
      <div class="panel" data-employee-leave-history>
        <div class="panel-h"><h3>${esc(s('recentLeaveTitle'))}</h3><span class="grow"></span><small class="tnum">${myLeave.length}</small></div>
        ${leaveBody}
      </div>`,
    context:{
      title:s('leaveBalanceTitle'),
      body:`<div class="indicator ok" data-employee-leave-balance>
        <div class="ind-top">${ic('calendar')}<span>${esc(s('annualLeaveLabel'))}</span><span class="ind-r tnum">${remaining} / ${total}</span></div>
        <div class="track"><i style="width:${pct}%"></i></div>
        <small>${esc(remainingLabel)}</small>
        <small>${esc(usedLabel)}</small>
      </div>
      <div class="indicator ${accountTone}" data-employee-account-status style="margin-top:12px">
        <div class="ind-top">${ic('user')}<span>${esc(ac('title'))}</span><span class="ind-r">${cap(accountLabel,accountTone)}</span></div>
        ${account&&account.userId?`<small>${esc(account.username||'')} · ${esc(account.email||'—')}</small>`:`<small>${esc(ac('createHint'))}</small>`}
        ${accountControls}
      </div>`,
    },
    afterRender:({editor})=>{
      editor?.setAttribute('data-canonical-employee','true');
      root.querySelector('[data-employee-review]')?.addEventListener('click',()=>navigate('leave-approval'));
      const reload=()=>navigate('employee',{employeeId:Number(e.id)});
      root.querySelector('[data-employee-account-create]')?.addEventListener('click',()=>{
        const suggested=String(e.employeeNo||e.fullName).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64);
        appModal({icon:'user',title:ac('create'),body:`
          <p class="muted" style="margin-bottom:14px">${esc(ac('createHint'))}</p>
          <label class="fld"><span>${esc(ac('username'))}</span><input id="employeeAccountUsername" value="${esc(suggested)}" autocomplete="off"></label>
          <div class="auth-error" id="employeeAccountError" role="alert"></div>`,
          actions:`${btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(ac('create'),{icon:'plus',cls:'primary',attrs:'data-account-create-confirm'})}`});
        document.querySelector('[data-account-create-confirm]')?.addEventListener('click',async()=>{
          const button=document.querySelector('[data-account-create-confirm]');
          button.setAttribute('disabled','');
          try{
            await window.ErpSystemData.action('hr/employee-accounts',e.id,'create',{username:document.querySelector('#employeeAccountUsername').value.trim()},crypto.randomUUID());
            closeModal(); toast(ac('created'),'ok'); reload();
          }catch(error){ document.querySelector('#employeeAccountError').textContent=(error&&error.message)||ac('error'); button.removeAttribute('disabled'); }
        });
      });
      root.querySelector('[data-employee-account-reveal]')?.addEventListener('click',async()=>{
        try{
          const revealed=(await window.ErpSystemData.action('hr/employee-accounts',e.id,'reveal-temporary-password',{})).data;
          appModal({icon:'eye',title:ac('temporary'),body:`
            <div class="fld"><span>${esc(ac('temporary'))}</span><code id="employeeTemporaryPassword" style="display:block;padding:10px;border:1px solid var(--line);border-radius:8px;overflow-wrap:anywhere">${esc(revealed.temporaryPassword)}</code></div>
            <small>${esc(ac('expires'))}: ${esc(String(revealed.expiresAt||''))}</small>`,
            actions:`${btn(ac('copy'),{icon:'copy',cls:'primary',attrs:'data-account-copy'})}`});
          document.querySelector('[data-account-copy]')?.addEventListener('click',async()=>{
            await navigator.clipboard.writeText(document.querySelector('#employeeTemporaryPassword').textContent);
            toast(ac('copied'),'ok');
          });
        }catch(error){ toast((error&&error.message)||ac('error'),'bad'); }
      });
      root.querySelector('[data-employee-account-reset]')?.addEventListener('click',()=>{
        confirmModal({icon:'warn',title:ac('reset'),message:ac('resetConfirm'),confirmLabel:ac('reset'),onConfirm:`async function(){try{await window.ErpSystemData.action('hr/employee-accounts',${Number(e.id)},'reset-password',{},crypto.randomUUID());toast(${JSON.stringify(ac('resetDone'))},'ok');navigate('employee',{employeeId:${Number(e.id)}})}catch(error){toast((error&&error.message)||${JSON.stringify(ac('error'))},'bad')}}`});
      });
      root.querySelector('[data-employee-account-offboard]')?.addEventListener('click',()=>{
        appModal({icon:'warn',title:ac('offboardTitle'),body:`
          <label class="fld"><span>${esc(ac('handoff'))}</span><select id="employeeHandoffTarget">${availableTargets.map(row=>`<option value="${row.id}" ${row.id===e.managerId?'selected':''}>${esc(row.fullName)} · ${esc(row.employeeNo)}</option>`).join('')}</select></label>
          <label class="fld"><span>${esc(ac('reason'))}</span><textarea id="employeeOffboardReason" rows="3"></textarea></label>
          <div class="auth-error" id="employeeOffboardError" role="alert"></div>`,
          actions:`${btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(ac('confirmOffboard'),{icon:'x',cls:'primary',attrs:'data-account-offboard-confirm'})}`});
        document.querySelector('[data-account-offboard-confirm]')?.addEventListener('click',async()=>{
          const button=document.querySelector('[data-account-offboard-confirm]');
          button.setAttribute('disabled','');
          try{
            await window.ErpSystemData.action('hr/employee-accounts',e.id,'offboard',{
              targetEmployeeId:Number(document.querySelector('#employeeHandoffTarget').value),
              reason:document.querySelector('#employeeOffboardReason').value.trim(),
            },crypto.randomUUID());
            closeModal(); toast(ac('offboardedDone'),'ok'); reload();
          }catch(error){ document.querySelector('#employeeOffboardError').textContent=(error&&error.message)||ac('error'); button.removeAttribute('disabled'); }
        });
      });
    },
  });
};

/* ---- shared payroll data prep (payroll-run and payslip both need runs,
   lines, employees and immutable leave-source traces; one fetch point avoids duplicated Promise.all blocks,
   mirroring prepareHrData()'s precedent above) ---- */
async function preparePayrollData(){
  const pages=await Promise.all([
    listPage('payroll/runs'),
    listPage('payroll/run-lines'),
    listPage('hr/employees'),
    listPage('payroll/leave-sources'),
    listPage('payroll/run-leave-sources'),
    listPage('payroll/leave-types'),
    listPage('payroll/leave-policies'),
  ]);
  const [runs,lines,employees,leaveSources,runLeaveSources,leaveTypes,leavePolicies]=pages.map(p=>p.data);
  return {runs,lines,employees,leaveSources,runLeaveSources,leaveTypes,leavePolicies};
}
function nextPayrollDocNo(runs){
  let max=0;
  runs.forEach(r=>{ const m=/(\d+)\s*$/.exec(r.docNo||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'PAY-'+new Date().getFullYear()+'-'+String(max+1).padStart(4,'0');
}
/* SG's real scheme is CPF + SDL with zero monthly income-tax withholding; MY's
   is EPF + SOCSO/EIS + PCB (see src/modules/payroll/statutory.ts). Only two
   schemes exist today, dispatched by the active company's country. */
function payrollStatutoryLabel(s,kind){
  const isMY=DB.company&&DB.company.country==='MY';
  if(kind==='employee') return isMY?s('statutoryEmployeeLabelMY'):s('statutoryEmployeeLabelSG');
  if(kind==='employer') return isMY?s('statutoryEmployerLabelMY'):s('statutoryEmployerLabelSG');
  return isMY?s('additionalLabelMY'):s('additionalLabelSG');
}

/* ---------------- PAYROLL RUN (canonical batch register → selected-run detail) ---------------- */
SCREENS['payroll-run'] = async function(root){
  const s=hrCopy();
  let {runs,lines,employees,runLeaveSources,leaveTypes,leavePolicies}=await preparePayrollData();
  runs=runs.slice().sort((a,b)=>b.id-a.id);
  let employeeById=new Map(employees.map(employee=>[employee.id,employee]));
  let page=null;
  let busyId=null;
  let actionError=null;
  const isDesktop=()=>!window.matchMedia('(max-width:980px)').matches;
  const routeStillActive=()=>root.isConnected&&CURRENT_ROUTE==='payroll-run';
  const statusLabel=status=>status==='posted'?s('statusPosted'):s('statusDraft');
  const statusTone=status=>status==='posted'?'ok':'warn';
  function localDateIso(date){
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function todayIso(){ return localDateIso(new Date()); }
  function firstOfMonthIso(){ const d=new Date(); return localDateIso(new Date(d.getFullYear(),d.getMonth(),1)); }
  function lastOfMonthIso(){ const d=new Date(); return localDateIso(new Date(d.getFullYear(),d.getMonth()+1,0)); }
  function linesFor(run){ return lines.filter(line=>String(line.runId)===String(run.id)); }
  function summaryFor(run){
    const runLines=linesFor(run);
    return {
      runLines,
      headcount:runLines.length,
      base:runLines.reduce((sum,line)=>sum+Number(line.baseGrossPay||line.grossPay),0),
      leaveEarnings:runLines.reduce((sum,line)=>sum+Number(line.leaveEarnings||0),0),
      leaveDeductions:runLines.reduce((sum,line)=>sum+Number(line.leaveDeductions||0),0),
      gross:runLines.reduce((sum,line)=>sum+Number(line.grossPay),0),
      statutory:runLines.reduce((sum,line)=>sum+Number(line.employeeStatutoryDeduction),0),
      tax:runLines.reduce((sum,line)=>sum+Number(line.incomeTaxDeduction),0),
      net:runLines.reduce((sum,line)=>sum+Number(line.netPay),0),
      leaveSourceCount:runLeaveSources.filter(source=>String(source.runId)===String(run.id)).length,
    };
  }
  async function reload(){
    const fresh=await preparePayrollData();
    runs=fresh.runs.slice().sort((a,b)=>b.id-a.id);
    lines=fresh.lines;
    employees=fresh.employees;
    runLeaveSources=fresh.runLeaveSources;
    leaveTypes=fresh.leaveTypes;
    leavePolicies=fresh.leavePolicies;
    employeeById=new Map(employees.map(employee=>[employee.id,employee]));
  }
  function createError(modal,message,input){
    const error=modal.querySelector('[data-payroll-create-error]');
    if(error){
      error.hidden=false;
      error.querySelector('span').textContent=message;
    }
    input?.focus();
  }
  function openCreateRun(){
    appModal({
      icon:'coins',
      title:s('newRunButton'),
      width:620,
      body:`<p class="h1sub payroll-run-modal-description">${esc(s('newRunDescription'))}</p>
        <div class="alert danger payroll-run-modal-error" data-payroll-create-error hidden>${ic('warn')}<span></span></div>
        <div class="set-grid payroll-run-form">
          <div class="fld"><span>${esc(s('fieldRunNo'))}</span><input id="prDocNo" value="${esc(nextPayrollDocNo(runs))}" readonly></div>
          <div class="fld"><span>${esc(s('fieldPeriodStart'))}</span><input id="prStart" type="date" value="${firstOfMonthIso()}"></div>
          <div class="fld"><span>${esc(s('fieldPeriodEnd'))}</span><input id="prEnd" type="date" value="${lastOfMonthIso()}"></div>
          <div class="fld"><span>${esc(s('fieldPayDate'))}</span><input id="prPayDate" type="date" value="${todayIso()}"></div>
        </div>`,
      actions:`${btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('createRun'),{icon:'plus',cls:'primary',attrs:'data-payroll-create'})}`,
    });
    const modal=$('#modalEl');
    const save=modal?.querySelector('[data-payroll-create]');
    save?.addEventListener('click',async()=>{
      const docNo=modal.querySelector('#prDocNo');
      const start=modal.querySelector('#prStart');
      const end=modal.querySelector('#prEnd');
      const payDate=modal.querySelector('#prPayDate');
      modal.querySelector('[data-payroll-create-error]').hidden=true;
      if(!start.value||!end.value||!payDate.value){
        createError(modal,s('dateRequired'),!start.value?start:!end.value?end:payDate);
        return;
      }
      if(end.value<start.value){
        createError(modal,s('invalidPayrollPeriod'),end);
        return;
      }
      save.disabled=true;
      save.setAttribute('aria-busy','true');
      try{
        const created=await window.ErpSystemData.create('payroll/runs',{
          docNo:docNo.value.trim(),
          periodStart:start.value,
          periodEnd:end.value,
          payDate:payDate.value,
        });
        if(!routeStillActive()) return;
        await reload();
        if(!routeStillActive()) return;
        closeModal();
        page.select(created.data.id);
        toast(s('runCreated'),'ok');
      }catch(error){
        if(!routeStillActive()) return;
        save.disabled=false;
        save.removeAttribute('aria-busy');
        createError(modal,error&&error.message?error.message:s('runError'));
      }
    });
  }
  function openEncashment(){
    const paidTypeById=new Map(leaveTypes.filter(type=>type.paid).map(type=>[type.id,type]));
    const choices=leavePolicies
      .filter(policy=>policy.status==='confirmed'&&policy.encashmentAllowed&&paidTypeById.has(policy.leaveTypeId))
      .map(policy=>({policy,type:paidTypeById.get(policy.leaveTypeId)}));
    appModal({
      icon:'coins',
      title:s('encashmentTitle'),
      width:620,
      body:`<p class="h1sub">${esc(s('encashmentDescription'))}</p>
        <div class="alert danger payroll-run-modal-error" data-payroll-create-error hidden>${ic('warn')}<span></span></div>
        <div class="set-grid payroll-run-form">
          <label class="fld"><span>${esc(s('encashmentEmployee'))}</span><select id="encEmployee">
            <option value="">—</option>${employees.filter(row=>row.isActive).map(row=>`<option value="${row.id}">${esc(row.fullName)} · ${esc(row.employeeNo)}</option>`).join('')}
          </select></label>
          <label class="fld"><span>${esc(s('encashmentLeaveType'))}</span><select id="encPolicy">
            <option value="">—</option>${choices.map(row=>`<option value="${row.policy.id}|${row.type.id}">${esc(row.type.name)} · ${esc(row.policy.encashmentMaxDays)} max</option>`).join('')}
          </select></label>
          <label class="fld"><span>${esc(s('encashmentDays'))}</span><input id="encDays" type="number" min="0.5" step="0.5" value="1.00"></label>
          <label class="fld"><span>${esc(s('encashmentDate'))}</span><input id="encDate" type="date" value="${todayIso()}"></label>
          <label class="fld" style="grid-column:1/-1"><span>${esc(s('encashmentNote'))}</span><textarea id="encNote" rows="3" placeholder="${esc(s('encashmentNotePlaceholder'))}"></textarea></label>
        </div>`,
      actions:`${btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('encashmentApprove'),{icon:'check',cls:'primary',attrs:'data-encashment-create'})}`,
    });
    const modal=$('#modalEl');
    const save=modal?.querySelector('[data-encashment-create]');
    save?.addEventListener('click',async()=>{
      const employeeId=Number(modal.querySelector('#encEmployee').value);
      const [policyVersionId,leaveTypeId]=(modal.querySelector('#encPolicy').value||'|').split('|').map(Number);
      const days=modal.querySelector('#encDays').value;
      const effectiveDate=modal.querySelector('#encDate').value;
      modal.querySelector('[data-payroll-create-error]').hidden=true;
      if(!employeeId||!policyVersionId||!leaveTypeId){
        createError(modal,s('selectRequired'),!employeeId?modal.querySelector('#encEmployee'):modal.querySelector('#encPolicy'));
        return;
      }
      save.disabled=true;
      save.setAttribute('aria-busy','true');
      try{
        await window.ErpSystemData.create('payroll/leave-sources',{
          employeeId,leaveTypeId,policyVersionId,days,effectiveDate,
          eventKey:`ui-encashment-${crypto.randomUUID()}`,
          note:modal.querySelector('#encNote').value.trim()||null,
        });
        if(!routeStillActive()) return;
        await reload();
        if(!routeStillActive()) return;
        closeModal();
        page.render();
        toast(s('encashmentCreated'),'ok');
      }catch(error){
        if(!routeStillActive()) return;
        save.disabled=false;
        save.removeAttribute('aria-busy');
        createError(modal,error&&error.message?error.message:s('encashmentError'));
      }
    });
  }
  async function postRun(run){
    busyId=run.id;
    actionError=null;
    page.render();
    try{
      await window.ErpSystemData.action('payroll/runs',run.id,'post',{},`post-payroll-run-${run.id}`);
      if(!routeStillActive()) return;
      await reload();
      if(!routeStillActive()) return;
      busyId=null;
      actionError=null;
      page.render();
      toast(s('postSuccess'),'ok');
    }catch(error){
      if(!routeStillActive()) return;
      busyId=null;
      actionError={id:run.id,message:error&&error.message?error.message:s('postError')};
      page.render();
    }
  }
  function confirmPost(run){
    const summary=summaryFor(run);
    appModal({
      icon:'lock',
      title:s('postConfirmTitle'),
      width:560,
      body:`<p class="payroll-run-confirm">${esc(s('postConfirmBody')
        .replace('{amount}',money0(summary.net))
        .replace('{count}',String(summary.headcount))
        .replace('{date}',dateValue(run.payDate)))}</p>`,
      actions:`${btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('postButton'),{icon:'check',cls:'primary',attrs:'data-payroll-post-confirm'})}`,
    });
    $('#modalEl')?.querySelector('[data-payroll-post-confirm]')?.addEventListener('click',()=>{
      closeModal();
      postRun(run);
    });
  }
  function detailContent(run){
    const summary=summaryFor(run);
    const busy=String(busyId)===String(run.id);
    const error=actionError&&String(actionError.id)===String(run.id)?actionError.message:null;
    const employeeRows=summary.runLines.map((line,index)=>{
      const employee=employeeById.get(line.employeeId);
      const name=employee?.fullName||s('unknownEmployee');
      const department=employee?.department||'—';
      return `<tr class="payroll-line-row" data-payroll-line="${line.id}">
        <td class="lineno">${index+1}</td>
        <td class="l"><div class="payroll-employee">
          ${profileAvatar({name,src:employee&&(employee.photoUrl||employee.imageUrl||employee.avatarUrl),size:28})}
          <div><b>${esc(name)}</b><small>${esc(department)}</small></div>
        </div></td>
        <td class="tnum">${money0(Number(line.baseGrossPay||line.grossPay))}</td>
        <td class="tnum">${Number(line.leaveEarnings||0)>0?'+'+money0(Number(line.leaveEarnings)):money0(0)}</td>
        <td class="tnum">${Number(line.leaveDeductions||0)>0?'−'+money0(Number(line.leaveDeductions)):money0(0)}</td>
        <td class="tnum">${money0(Number(line.grossPay))}</td>
        <td class="tnum"><b>${money0(Number(line.netPay))}</b></td>
      </tr>`;
    }).join('');
    return `<div class="detail-head payroll-run-detail-head">
        <span class="grabber"></span>
        <button class="close" data-master-detail-close>${ic('chevL')}${esc(t('common.close'))}</button>
        <div class="dh-top">
          <span class="payroll-run-icon">${ic('coins')}</span>
          <div><h2>${esc(run.docNo)}</h2><span class="sub">${esc(dateValue(run.periodStart))} → ${esc(dateValue(run.periodEnd))}</span></div>
          <div class="payroll-run-status">${cap(statusLabel(run.status),statusTone(run.status))}</div>
        </div>
      </div>
      <div class="detail-body payroll-run-detail-body">
        ${error?`<div class="alert danger payroll-run-action-error" data-payroll-action-error>${ic('warn')}<span>${esc(error)}</span></div>`:''}
        <div class="payroll-run-kpis">
          <div class="stat"><small>${esc(s('statHeadcount'))}</small><b class="tnum">${summary.headcount}</b></div>
          <div class="stat"><small>${esc(s('statGross'))}</small><b class="tnum">${money0(summary.gross)}</b></div>
          <div class="stat"><small>${esc(s('statStatutoryTax'))}</small><b class="tnum">${money0(summary.statutory+summary.tax)}</b></div>
          <div class="stat"><small>${esc(s('statNet'))}</small><b class="tnum">${money0(summary.net)}</b></div>
        </div>
        <div class="card payroll-run-facts">
          <div class="field"><span class="k">${esc(s('fieldPeriodStart'))}</span><span class="v">${esc(dateValue(run.periodStart))}</span></div>
          <div class="field"><span class="k">${esc(s('fieldPeriodEnd'))}</span><span class="v">${esc(dateValue(run.periodEnd))}</span></div>
          <div class="field"><span class="k">${esc(s('fieldPayDate'))}</span><span class="v">${esc(dateValue(run.payDate))}</span></div>
          <div class="field"><span class="k">${esc(s('colStatus'))}</span><span class="v">${cap(statusLabel(run.status),statusTone(run.status))}</span></div>
          <div class="field"><span class="k">${esc(s('leaveTraceTitle'))}</span><span class="v">${esc(s('leaveSourceCount').replace('{count}',String(summary.leaveSourceCount)))}</span></div>
        </div>
        <div class="panel payroll-lines-panel">
          <div class="panel-h"><h3>${esc(s('employeePayrollLines'))}</h3><small>${esc(s('clickForPayslip'))}</small></div>
          ${summary.runLines.length?`<div class="payroll-lines-scroll">
            <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(t('hr.col.employee'))}</th><th>${esc(s('baseSalaryLabel'))}</th><th>${esc(s('leaveEarningsLabel'))}</th><th>${esc(s('unpaidLeaveDeductionLabel'))}</th><th>${esc(s('colGross'))}</th><th>${esc(s('colNet'))}</th></tr></thead>
              <tbody>${employeeRows}</tbody>
              <tfoot><tr><td></td><td class="l"><b>${esc(s('totalsLabel').replace('{n}',String(summary.headcount)))}</b></td><td class="tnum">${money0(summary.base)}</td><td class="tnum">${money0(summary.leaveEarnings)}</td><td class="tnum">${money0(summary.leaveDeductions)}</td><td class="tnum"><b>${money0(summary.gross)}</b></td><td class="tnum"><b>${money0(summary.net)}</b></td></tr></tfoot>
            </table>
          </div>`:`<div class="detail-empty payroll-lines-empty">${ic('people')}<div><b>${esc(s('noPayrollLines'))}</b><small>${esc(s('noPayrollLinesBody'))}</small></div></div>`}
        </div>
      </div>
      <div class="set-savebar" data-payroll-actions>
        <div class="grow"></div>
        ${btn(s('encashmentButton'),{icon:'coins',cls:'soft',sm:false,attrs:'data-payroll-action="encashment"'})}
        ${run.status==='draft'?btn(s('postButton'),{icon:'check',cls:'primary',sm:false,attrs:`data-payroll-action="post"${busy?' disabled':''}`}):''}
      </div>`;
  }

  page=masterDetailRegisterPage(root,{
    module:'hr',
    route:'payroll-run',
    title:s('payrollRunTitle'),
    description:s('payrollRunDescription'),
    rows:()=>runs,
    rowId:run=>run.id,
    initialFilter:'all',
    filters:[
      ['all',s('filterAllRuns')],
      ['draft',s('statusDraft')],
      ['posted',s('statusPosted')],
    ],
    filterFn:(run,status)=>run.status===status,
    kpis:()=>{
      const latest=runs[0];
      return [
        {label:s('kpiTotalRuns'),value:runs.length,filter:'all'},
        {label:s('kpiDraftRuns'),value:runs.filter(run=>run.status==='draft').length,filter:'draft'},
        {label:s('kpiPostedRuns'),value:runs.filter(run=>run.status==='posted').length,filter:'posted'},
        {label:s('kpiLatestNet'),value:latest?money0(summaryFor(latest).net):'—',accent:Boolean(latest)},
      ];
    },
    primaryAction:{label:s('newRunButton'),icon:'plus',onClick:openCreateRun},
    columns:[
      {label:s('colRun'),align:'l',w:'minmax(150px,1.4fr)',render:run=>`<div class="cellsub"><b>${esc(run.docNo)}</b><small>${esc(dateValue(run.periodStart))} → ${esc(dateValue(run.periodEnd))}</small></div>`},
      {label:s('colPeriod'),align:'l',w:'minmax(150px,1.5fr)',render:run=>`${esc(dateValue(run.periodStart))} → ${esc(dateValue(run.periodEnd))}`},
      {label:s('colPayDate'),align:'l',render:run=>esc(dateValue(run.payDate))},
      {label:s('colHeadcount'),align:'r',render:run=>`<span class="tnum">${summaryFor(run).headcount}</span>`},
      {label:s('colNet'),align:'r',render:run=>`<b class="tnum">${money0(summaryFor(run).net)}</b>`},
      {label:s('colStatus'),align:'l',render:run=>cap(statusLabel(run.status),statusTone(run.status))},
    ],
    empty:{icon:'coins',title:s('noRunYet'),description:s('noRunBody')},
    detailPane:{
      rowLabel:run=>`${t('common.open')} ${run.docNo}`,
      initialSelectedId:()=>isDesktop()?runs[0]?.id??null:null,
      selectionOnFilter:rows=>isDesktop()?rows[0]?.id??null:null,
      empty:`<div class="detail-empty">${ic('coins')}<div><b>${esc(s('selectPayrollRun'))}</b><small>${esc(s('selectPayrollRunBody'))}</small></div></div>`,
      content:detailContent,
      afterRender:({detailRoot,row})=>{
        if(!detailRoot||!row) return;
        detailRoot.querySelectorAll('[data-payroll-line]').forEach(line=>{
          line.addEventListener('click',()=>navigate('payslip',{lineId:Number(line.dataset.payrollLine)}));
        });
        detailRoot.querySelector('[data-payroll-action="post"]')?.addEventListener('click',()=>confirmPost(row));
        detailRoot.querySelector('[data-payroll-action="encashment"]')?.addEventListener('click',openEncashment);
      },
    },
  });
};

/* ---------------- PAYSLIP (document — one real payroll_run_line) ---------------- */
SCREENS['payslip'] = async function(root, params){
  const s=hrCopy();
  const {runs,lines,employees,leaveSources,runLeaveSources}=await preparePayrollData();
  const requestedId=params&&params.lineId?Number(params.lineId):null;
  const postedLines=lines.slice().sort((a,b)=>b.id-a.id);
  const line=requestedId?lines.find(row=>row.id===requestedId):postedLines[0];
  if(!line){
    root.innerHTML=statePanel({icon:'receipt',title:s('noPayslipYet'),body:s('noPayslipBody')});
    return;
  }
  const run=runs.find(r=>r.id===line.runId)||null;
  const emp=employees.find(e=>e.id===line.employeeId)||null;
  const empName=emp?emp.fullName:('#'+line.employeeId);

  const baseGross=Number(line.baseGrossPay||line.grossPay);
  const leaveEarnings=Number(line.leaveEarnings||0);
  const leaveDeductions=Number(line.leaveDeductions||0);
  const grossEarnings=baseGross+leaveEarnings;
  const statutoryDed=Number(line.employeeStatutoryDeduction);
  const taxDed=Number(line.incomeTaxDeduction);
  const ded=leaveDeductions+statutoryDed+taxDed;
  const net=Number(line.netPay);
  const employerStatutory=Number(line.employerStatutoryContribution);
  const employerAdditional=Number(line.employerAdditionalContribution);
  const empCont=employerStatutory+employerAdditional;

  const earningsRows=[
    `<tr><td class="l li-name"><b>${esc(s('baseSalaryLabel'))}</b></td><td class="tnum">${money(baseGross)}</td></tr>`,
    leaveEarnings>0?`<tr><td class="l li-name"><b>${esc(s('leaveEarningsLabel'))}</b></td><td class="tnum">${money(leaveEarnings)}</td></tr>`:'',
  ].join('');
  const deductionRows=[
    leaveDeductions>0?`<tr><td class="l li-name"><b>${esc(s('unpaidLeaveDeductionLabel'))}</b></td><td class="tnum">${money(leaveDeductions)}</td></tr>`:'',
    `<tr><td class="l li-name"><b>${esc(payrollStatutoryLabel(s,'employee'))}</b></td><td class="tnum">${money(statutoryDed)}</td></tr>`,
    taxDed>0?`<tr><td class="l li-name"><b>${esc(s('incomeTaxLabel'))}</b></td><td class="tnum">${money(taxDed)}</td></tr>`:'',
  ].join('');
  const employerRows=[
    `<tr><td class="l li-name"><b>${esc(payrollStatutoryLabel(s,'employer'))}</b></td><td class="tnum">${money(employerStatutory)}</td></tr>`,
    `<tr><td class="l li-name"><b>${esc(payrollStatutoryLabel(s,'additional'))}</b></td><td class="tnum">${money(employerAdditional)}</td></tr>`,
  ].join('');
  const lineMappings=runLeaveSources.filter(mapping=>String(mapping.runLineId)===String(line.id));
  const leaveSourceById=new Map(leaveSources.map(source=>[source.id,source]));
  const traceRows=lineMappings.map(mapping=>{
    const source=leaveSourceById.get(mapping.sourceId);
    if(!source) return '';
    const sign=source.effectDirection==='deduction'?'−':'+';
    return `<div class="field"><span class="k">${esc(source.sourceType.replaceAll('_',' '))} · ${esc(source.days)}d</span><span class="v tnum">${sign}${money(Number(source.amount))}</span></div>`;
  }).join('');

  // Year to date: this employee's other posted lines whose run falls in the
  // current calendar year (this tenant's fiscal year starts January, see
  // DB.fiscalYears), including this line itself -- real aggregation, not the
  // former mock's flat ×6 multiplication of one period's figures.
  const payYear=run?dateValue(run.payDate).slice(0,4):String(new Date().getFullYear());
  const ytdLines=lines.filter(l=>{
    if(l.employeeId!==line.employeeId) return false;
    const lRun=runs.find(r=>r.id===l.runId);
    return lRun&&lRun.status==='posted'&&dateValue(lRun.payDate).slice(0,4)===payYear;
  });
  const grossYtd=ytdLines.reduce((sum,l)=>sum+Number(l.grossPay),0);
  const statutoryYtd=ytdLines.reduce((sum,l)=>sum+Number(l.employeeStatutoryDeduction),0);
  const taxYtd=ytdLines.reduce((sum,l)=>sum+Number(l.incomeTaxDeduction),0);

  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:920px">
    ${crumbs([DB.company.name,t('nav.hr'),{label:s('payslipCrumb'),route:'payroll-run'},{cur:run?run.docNo+' · #'+line.lineNo:'#'+line.id}])}
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('receipt')}${esc(s('payslipTitle'))} <span class="dnum">${esc(run?run.docNo:'')}${run?' · ':''}${esc(empName)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(empName)} · ${esc(emp?emp.jobTitle:'')} · ${run?esc(dateValue(run.periodStart))+' → '+esc(dateValue(run.periodEnd)):''}</div></div>
        <div class="dactions">${statusBadge(run&&run.status==='posted'?'Posted':'Draft')}</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>${esc(t('hr.col.employee'))}</small><b>${esc(empName)}${emp?' · '+esc(emp.employeeNo):''}</b></div>
        <div class="dm"><small>${esc(s('fieldPeriodStart'))}</small><b>${run?esc(dateValue(run.periodStart))+' → '+esc(dateValue(run.periodEnd)):'—'}</b></div>
        <div class="dm"><small>${esc(s('fieldPayDate'))}</small><b>${run?esc(dateValue(run.payDate)):'—'}</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>${esc(s('earningsTitle'))}</h3></div>
          <table class="lines"><tbody>${earningsRows}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">${esc(s('grossEarnings'))}</td><td class="tnum"><b>${money(grossEarnings)}</b></td></tr></tfoot></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('deductionsTitle'))}</h3></div>
          <table class="lines"><tbody>${deductionRows}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">${esc(s('totalDeductions'))}</td><td class="tnum"><b>${money(ded)}</b></td></tr></tfoot></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('employerContribTitle'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${esc(s('notDeducted'))}</span></div>
          <table class="lines"><tbody>${employerRows}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">${esc(s('totalEmployerCost'))}</td><td class="tnum"><b>${money(empCont)}</b></td></tr></tfoot></table>
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('netPayTitle'))}</div>
          <div class="sumrow"><span class="sk2">${esc(s('grossLabel'))}</span><span class="sv tnum">${money(grossEarnings)}</span></div>
          <div class="sumrow disc"><span class="sk2">${esc(s('deductionsLabel'))}</span><span class="sv tnum">−${money(ded)}</span></div>
          <div class="sumrow total"><span class="sk2">${esc(s('netPayLabel'))}</span><span class="sv tnum">${money(net)}</span></div>
          <div class="indicator ok" style="margin-top:12px"><div class="ind-top">${ic('coins')}<span>${esc(s('netPayDisbursed'))}</span><span class="ind-r">${money0(net)}</span></div><small>${run?esc(s('creditedOn').replace('{date}',dateValue(run.payDate))):''}</small></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('ytdTitle'))}</div>
          <div class="sumrow"><span class="sk2">${esc(s('grossYtd'))}</span><span class="sv tnum">${money0(grossYtd)}</span></div>
          <div class="sumrow"><span class="sk2">${esc(s('statutoryYtd'))}</span><span class="sv tnum">${money0(statutoryYtd)}</span></div>
          <div class="sumrow"><span class="sk2">${esc(s('taxYtd'))}</span><span class="sv tnum">${money0(taxYtd)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('leaveTraceTitle'))}</div>
          ${traceRows||`<div class="field"><span class="k">${esc(s('leaveSourceCount').replace('{count}','0'))}</span></div>`}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:emp?emp.employeeNo:'', label:esc(empName), meta:s('relatedEmployee'), status:emp&&emp.isActive?s('statusActive'):s('statusInactive')},
            {no:run?run.docNo:'', label:s('relatedRun'), meta:run?dateValue(run.periodStart)+' → '+dateValue(run.periodEnd):'', status:run?(run.status==='posted'?'Posted':'Draft'):''},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${esc(s('netPayLabel'))} <b style="color:var(--fg)">${money(net)}</b>${run?' · '+esc(dateValue(run.payDate)):''}.</div>
      <div class="grow"></div>
      ${btn(s('backToPayroll'),{icon:'coins',cls:'primary',sm:false,attrs:'onclick="navigate(\'payroll-run\')"'})}
    </div>
  </div></div></section></div>`;
};
