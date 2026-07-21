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
      fieldBaseSalary:'Base salary (monthly)',baseSalaryRequired:'Base salary must be greater than 0',
      payrollRunTitle:'Payroll Run',payrollCrumb:'Payroll',
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
      fieldBaseSalary:'Gaji asas (bulanan)',baseSalaryRequired:'Gaji asas mesti lebih daripada 0',
      payrollRunTitle:'Larian Gaji',payrollCrumb:'Gaji',
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
      fieldBaseSalary:'底薪(每月)',baseSalaryRequired:'底薪必须大于 0',
      payrollRunTitle:'薪资运行',payrollCrumb:'薪资',
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
      fieldBaseSalary:'基本給(月額)',baseSalaryRequired:'基本給は0より大きい必要があります',
      payrollRunTitle:'給与計算',payrollCrumb:'給与',
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
      fieldBaseSalary:'Lương cơ bản (hàng tháng)',baseSalaryRequired:'Lương cơ bản phải lớn hơn 0',
      payrollRunTitle:'Đợt Tính Lương',payrollCrumb:'Lương',
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
        {label:t('hr.col.joined'),align:'l',render:e=>esc(dateValue(e.startDate))},
        {label:t('col.status'),align:'l',render:e=>{ const st=hrStatusOf(e,leaveRequests); return cap(hrStatusLabel(s,st),hrStatusTone(st)); }},
        {label:'',align:'c',render:()=>`<span class="rowact"><button data-tip="${esc(t('common.open'))}" data-act="open">${ic('ext')}</button></span>`},
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
  const myLeave=leaveRequests.filter(lv=>lv.employeeId===e.id).sort((a,b)=>dateValue(b.startDate).localeCompare(dateValue(a.startDate)));
  const leaveStatusTone={pending:'warn',approved:'ok',rejected:'danger'};
  const leaveRows=myLeave.length?myLeave.map(lv=>`<tr>
      <td class="l li-name"><b>${esc(lv.leaveType)}</b><small>${esc(dateValue(lv.startDate))} → ${esc(dateValue(lv.endDate))}</small></td>
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
        <div class="dm"><small>${esc(s('fieldJoined'))}</small><b>${esc(dateValue(e.startDate))}</b></div>
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
          <div class="field"><span class="k">${esc(s('fieldJoined'))}</span><span class="v">${esc(dateValue(e.startDate))}</span></div>
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

/* ---------------- PAYROLL RUN (draft → post report, mirrors screens-asset.js's
   depreciation-run screen) ---------------- */
SCREENS['payroll-run'] = async function(root){
  const s=hrCopy();
  let {runs,lines,employees}=await preparePayrollData();
  runs=runs.slice().sort((a,b)=>b.id-a.id);
  let employeeById=new Map(employees.map(e=>[e.id,e]));
  let selectedRunId=runs.length?runs[0].id:null;

  function statTile(label,value,sub,tone){
    return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
      <b class="tnum" style="font-size:22px;font-weight:600;letter-spacing:-.02em;color:${tone||'var(--fg)'}">${value}</b>
      <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
  }
  function todayIso(){ return new Date().toISOString().slice(0,10); }
  function firstOfMonthIso(){ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10); }
  function lastOfMonthIso(){ const d=new Date(); return new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().slice(0,10); }

  async function render(){
    const run=runs.find(r=>r.id===selectedRunId)||null;
    const runLines=run?lines.filter(l=>l.runId===run.id):[];
    const gross=runLines.reduce((sum,l)=>sum+Number(l.grossPay),0);
    const statutory=runLines.reduce((sum,l)=>sum+Number(l.employeeStatutoryDeduction),0);
    const tax=runLines.reduce((sum,l)=>sum+Number(l.incomeTaxDeduction),0);
    const net=runLines.reduce((sum,l)=>sum+Number(l.netPay),0);
    const isDraft=!!(run&&run.status==='draft');
    const isPosted=!!(run&&run.status==='posted');

    const rowHtml=runLines.map((line,i)=>{
      const emp=employeeById.get(line.employeeId);
      const name=emp?emp.fullName:('#'+line.employeeId);
      const dept=emp?emp.department:'';
      return `<tr class="payrow" data-line="${line.id}">
        <td class="lineno">${i+1}</td>
        <td class="l li-name"><div style="display:flex;align-items:center;gap:10px"><span class="kc-av" style="background:${hrAvatarColor(name)};width:26px;height:26px;font-size:10px">${esc(hrInitials(name))}</span><div><b>${esc(name)}</b><small>${esc(dept)}</small></div></div></td>
        <td class="tnum">${money0(Number(line.grossPay))}</td>
        <td class="tnum" style="color:var(--muted)">${money0(Number(line.employeeStatutoryDeduction))}</td>
        <td class="tnum" style="color:var(--muted)">${money0(Number(line.incomeTaxDeduction))}</td>
        <td class="tnum"><b>${money0(Number(line.netPay))}</b></td></tr>`;
    }).join('');

    root.innerHTML=`<div class="content full"><section class="master"><div class="report">
      <aside class="report-params">
        <h3>${esc(s('newRunButton'))}</h3>
        <div class="fld"><span>${esc(s('fieldRunNo'))}</span><input id="prDocNo" value="${esc(nextPayrollDocNo(runs))}" readonly></div>
        <div class="fld"><span>${esc(s('fieldPeriodStart'))}</span><input id="prStart" type="date" value="${firstOfMonthIso()}"></div>
        <div class="fld"><span>${esc(s('fieldPeriodEnd'))}</span><input id="prEnd" type="date" value="${lastOfMonthIso()}"></div>
        <div class="fld"><span>${esc(s('fieldPayDate'))}</span><input id="prPayDate" type="date" value="${todayIso()}"></div>
        ${btn(s('newRunButton'),{icon:'plus',cls:'primary',sm:false,attrs:'data-act="new"'})}
        ${run?`<div class="note rule" style="border:1px solid var(--hairline);border-left:3px solid ${isPosted?'var(--ok)':'var(--warn)'};background:var(--surface);border-radius:0 var(--r-m) var(--r-m) 0;padding:11px 13px;font-size:12.5px;margin-top:6px">
          <b style="display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:3px">${esc(run.docNo)}</b>
          ${esc(dateValue(run.periodStart))} → ${esc(dateValue(run.periodEnd))} · ${esc(isPosted?'Posted':'Draft')}
        </div>`:''}
      </aside>
      <div class="report-result">
        <div class="report-toolbar">
          <select id="runPicker" class="viewsel">${runs.length?runs.map(r=>`<option value="${r.id}" ${r.id===selectedRunId?'selected':''}>${esc(r.docNo)} · ${esc(dateValue(r.periodStart))} → ${esc(dateValue(r.periodEnd))} · ${esc(r.status)}</option>`).join(''):`<option>${esc(s('noRunYet'))}</option>`}</select>
          <div class="grow"></div>
          ${isDraft?btn(s('postButton'),{icon:'check',cls:'primary',attrs:'data-act="post"'}):''}
        </div>
        <div class="statwrap"><div class="statcards">
          ${statTile(s('statHeadcount'),runLines.length,run?dateValue(run.periodStart)+' → '+dateValue(run.periodEnd):'—')}
          ${statTile(s('statGross'),money0(gross),'')}
          ${statTile(s('statStatutoryTax'),money0(statutory+tax),'','var(--warn)')}
          ${statTile(s('statNet'),money0(net),run?s('fieldPayDate')+' '+dateValue(run.payDate):'','var(--ok)')}
        </div></div>
        <div class="tablewrap" id="prTable">${run?`<div class="panel">
          <div class="panel-h"><h3>${esc(t('hr.employees'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${esc(s('clickForPayslip'))}</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(t('hr.col.employee'))}</th><th>${esc(s('colGross'))}</th><th>${esc(s('colStatutory'))}</th><th>${esc(s('colTax'))}</th><th>${esc(s('colNet'))}</th></tr></thead>
            <tbody>${rowHtml}</tbody>
            <tfoot><tr><td></td><td class="l" style="font-weight:600">${esc(s('totalsLabel').replace('{n}',String(runLines.length)))}</td><td class="tnum"><b>${money0(gross)}</b></td><td class="tnum">${money0(statutory)}</td><td class="tnum">${money0(tax)}</td><td class="tnum"><b>${money0(net)}</b></td></tr></tfoot>
          </table>
        </div>`:statePanel({icon:'coins',title:s('noRunYet'),body:s('noRunBody')})}</div>
      </div>
    </div></section></div>`;
    wire(run);
  }

  function wire(run){
    root.querySelectorAll('.payrow').forEach(r=>{
      r.style.cursor='pointer';
      r.addEventListener('click',()=>navigate('payslip',{lineId:Number(r.dataset.line)}));
    });
    const picker=root.querySelector('#runPicker');
    picker&&picker.addEventListener('change',()=>{ selectedRunId=Number(picker.value); render(); });
    const newBtn=root.querySelector('[data-act="new"]');
    newBtn&&newBtn.addEventListener('click',async()=>{
      newBtn.disabled=true;
      try{
        const created=await window.ErpSystemData.create('payroll/runs',{
          docNo:$('#prDocNo').value.trim(),
          periodStart:$('#prStart').value, periodEnd:$('#prEnd').value, payDate:$('#prPayDate').value,
        });
        toast(s('runCreated'),'ok');
        const fresh=await preparePayrollData();
        runs=fresh.runs.slice().sort((a,b)=>b.id-a.id); lines=fresh.lines; employees=fresh.employees;
        employeeById=new Map(employees.map(e=>[e.id,e]));
        selectedRunId=created.data.id;
        await render();
      }catch(error){
        toast(error&&error.message?error.message:s('runError'),'danger');
        newBtn.disabled=false;
      }
    });
    const postBtn=root.querySelector('[data-act="post"]');
    postBtn&&postBtn.addEventListener('click',async()=>{
      if(!run) return;
      postBtn.disabled=true;
      try{
        await window.ErpSystemData.action('payroll/runs',run.id,'post',{},`post-payroll-run-${run.id}`);
        toast(s('postSuccess'),'ok');
        const fresh=await preparePayrollData();
        runs=fresh.runs.slice().sort((a,b)=>b.id-a.id); lines=fresh.lines; employees=fresh.employees;
        employeeById=new Map(employees.map(e=>[e.id,e]));
        await render();
      }catch(error){
        toast(error&&error.message?error.message:s('postError'),'danger');
        postBtn.disabled=false;
      }
    });
  }

  await render();
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
