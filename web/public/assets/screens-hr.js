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
function hrLeaveStatusLabel(s,status){
  return {
    pending:s('statusPending'),
    approved:s('statusApproved'),
    rejected:s('statusRejected'),
  }[status]||status;
}

/* ---------------- MY WORK (actor-owned preview shell) ----------------
   These five routes deliberately use the existing transaction-list SSOT while
   their domain epics are still planned. Leave rows are actor-derived; claims
   and receipts expose honest governed empty states instead of sample records.
   Team routes render only the privacy-redacted manager scope returned by the
   backend capability contract. */
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
  return {pending:'warn',approved:'ok',rejected:'danger'}[status]||'neutral';
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
    {label:copy('status'),align:'l',render:row=>cap(hrLeaveStatusLabel(statusCopy,row.status),myWorkStatusTone(row.status))},
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
    empty:{icon:'calendar',title:copy('noLeave'),description:copy('noLeaveBody')},
    afterRender:myWorkAfterRender('my-leave'),
  });
};

SCREENS['my-claims']=async function(root){
  const copy=myWorkCopy();
  let response;
  try{ response=await myWorkAdapter().claims(); }
  catch(error){
    if(!isMyWorkIdentityError(error)) throw error;
    myWorkIdentityPage(root,'my-claims',copy('claimsTitle'),copy('claimsDescription'));
    return;
  }
  myWorkEmptyPage(root,{
    route:'my-claims',title:copy('claimsTitle'),description:copy('claimsDescription'),
    emptyTitle:copy('claimsUnavailable'),emptyDescription:copy('claimsUnavailableBody'),
    note:response.meta&&response.meta.plannedEpic,
  });
};

SCREENS['my-receipts']=async function(root){
  const copy=myWorkCopy();
  let response;
  try{ response=await myWorkAdapter().receipts(); }
  catch(error){
    if(!isMyWorkIdentityError(error)) throw error;
    myWorkIdentityPage(root,'my-receipts',copy('receiptsTitle'),copy('receiptsDescription'));
    return;
  }
  myWorkEmptyPage(root,{
    route:'my-receipts',title:copy('receiptsTitle'),description:copy('receiptsDescription'),
    emptyTitle:copy('receiptsUnavailable'),emptyDescription:copy('receiptsUnavailableBody'),
    note:response.meta&&response.meta.plannedEpic,
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

SCREENS['team-calendar']=async function(root){
  return renderMyWorkTeamRoute(root,{route:'team-calendar'});
};
SCREENS['my-approvals']=async function(root){
  return renderMyWorkTeamRoute(root,{route:'my-approvals',approvals:true});
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

/* ---- shared payroll data prep (payroll-run and payslip both need runs +
   run-lines + employees; one fetch point avoids duplicated Promise.all blocks,
   mirroring prepareHrData()'s precedent above) ---- */
async function preparePayrollData(){
  const pages=await Promise.all([
    listPage('payroll/runs'),
    listPage('payroll/run-lines'),
    listPage('hr/employees'),
  ]);
  const [runs,lines,employees]=pages.map(p=>p.data);
  return {runs,lines,employees};
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
  let {runs,lines,employees}=await preparePayrollData();
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
      gross:runLines.reduce((sum,line)=>sum+Number(line.grossPay),0),
      statutory:runLines.reduce((sum,line)=>sum+Number(line.employeeStatutoryDeduction),0),
      tax:runLines.reduce((sum,line)=>sum+Number(line.incomeTaxDeduction),0),
      net:runLines.reduce((sum,line)=>sum+Number(line.netPay),0),
    };
  }
  async function reload(){
    const fresh=await preparePayrollData();
    runs=fresh.runs.slice().sort((a,b)=>b.id-a.id);
    lines=fresh.lines;
    employees=fresh.employees;
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
        <td class="tnum">${money0(Number(line.grossPay))}</td>
        <td class="tnum muted">${money0(Number(line.employeeStatutoryDeduction))}</td>
        <td class="tnum muted">${money0(Number(line.incomeTaxDeduction))}</td>
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
        </div>
        <div class="panel payroll-lines-panel">
          <div class="panel-h"><h3>${esc(s('employeePayrollLines'))}</h3><small>${esc(s('clickForPayslip'))}</small></div>
          ${summary.runLines.length?`<div class="payroll-lines-scroll">
            <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(t('hr.col.employee'))}</th><th>${esc(s('colGross'))}</th><th>${esc(s('colStatutory'))}</th><th>${esc(s('colTax'))}</th><th>${esc(s('colNet'))}</th></tr></thead>
              <tbody>${employeeRows}</tbody>
              <tfoot><tr><td></td><td class="l"><b>${esc(s('totalsLabel').replace('{n}',String(summary.headcount)))}</b></td><td class="tnum"><b>${money0(summary.gross)}</b></td><td class="tnum">${money0(summary.statutory)}</td><td class="tnum">${money0(summary.tax)}</td><td class="tnum"><b>${money0(summary.net)}</b></td></tr></tfoot>
            </table>
          </div>`:`<div class="detail-empty payroll-lines-empty">${ic('people')}<div><b>${esc(s('noPayrollLines'))}</b><small>${esc(s('noPayrollLinesBody'))}</small></div></div>`}
        </div>
      </div>
      ${run.status==='draft'?`<div class="set-savebar" data-payroll-actions>
        <div class="grow"></div>
        ${btn(s('postButton'),{icon:'check',cls:'primary',sm:false,attrs:`data-payroll-action="post"${busy?' disabled':''}`})}
      </div>`:''}`;
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
      },
    },
  });
};

/* ---------------- PAYSLIP (document — one real payroll_run_line) ---------------- */
SCREENS['payslip'] = async function(root, params){
  const s=hrCopy();
  const {runs,lines,employees}=await preparePayrollData();
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

  const gross=Number(line.grossPay);
  const statutoryDed=Number(line.employeeStatutoryDeduction);
  const taxDed=Number(line.incomeTaxDeduction);
  const ded=statutoryDed+taxDed;
  const net=Number(line.netPay);
  const employerStatutory=Number(line.employerStatutoryContribution);
  const employerAdditional=Number(line.employerAdditionalContribution);
  const empCont=employerStatutory+employerAdditional;

  const earningsRows=`<tr><td class="l li-name"><b>${esc(s('baseSalaryLabel'))}</b></td><td class="tnum">${money(gross)}</td></tr>`;
  const deductionRows=[
    `<tr><td class="l li-name"><b>${esc(payrollStatutoryLabel(s,'employee'))}</b></td><td class="tnum">${money(statutoryDed)}</td></tr>`,
    taxDed>0?`<tr><td class="l li-name"><b>${esc(s('incomeTaxLabel'))}</b></td><td class="tnum">${money(taxDed)}</td></tr>`:'',
  ].join('');
  const employerRows=[
    `<tr><td class="l li-name"><b>${esc(payrollStatutoryLabel(s,'employer'))}</b></td><td class="tnum">${money(employerStatutory)}</td></tr>`,
    `<tr><td class="l li-name"><b>${esc(payrollStatutoryLabel(s,'additional'))}</b></td><td class="tnum">${money(employerAdditional)}</td></tr>`,
  ].join('');

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
          <tfoot><tr><td class="l" style="font-weight:600">${esc(s('grossEarnings'))}</td><td class="tnum"><b>${money(gross)}</b></td></tr></tfoot></table>
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
          <div class="sumrow"><span class="sk2">${esc(s('grossLabel'))}</span><span class="sv tnum">${money(gross)}</span></div>
          <div class="sumrow disc"><span class="sk2">${esc(s('deductionsLabel'))}</span><span class="sv tnum">−${money(ded)}</span></div>
          <div class="sumrow total"><span class="sk2">${esc(s('netPayLabel'))}</span><span class="sv tnum">${money(net)}</span></div>
          <div class="indicator ok" style="margin-top:12px"><div class="ind-top">${ic('coins')}<span>${esc(s('netPayDisbursed'))}</span><span class="ind-r">${money0(net)}</span></div><small>${run?esc(s('creditedOn').replace('{date}',dateValue(run.payDate))):''}</small></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('ytdTitle'))}</div>
          <div class="sumrow"><span class="sk2">${esc(s('grossYtd'))}</span><span class="sv tnum">${money0(grossYtd)}</span></div>
          <div class="sumrow"><span class="sk2">${esc(s('statutoryYtd'))}</span><span class="sv tnum">${money0(statutoryYtd)}</span></div>
          <div class="sumrow"><span class="sk2">${esc(s('taxYtd'))}</span><span class="sv tnum">${money0(taxYtd)}</span></div>
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
