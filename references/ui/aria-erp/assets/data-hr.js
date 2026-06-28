/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   HR / payroll — leave, employee directory, the open employee, payroll run, payslip
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ---- HR leave ---- */
DB.leave = [
  { no:'LV-26-0331', emp:'Marcus Silva', dept:'Warehouse', type:'Annual', from:'2026-06-16', to:'2026-06-20', days:5, status:'Pending Approval', balance:11, cover:'J. Okafor', reason:'Family trip', avatar:'MS', clr:'#0a84ff' },
  { no:'LV-26-0330', emp:'Aisha Rahman', dept:'Finance', type:'Medical', from:'2026-06-09', to:'2026-06-10', days:2, status:'Pending Approval', balance:6, cover:'A. Costa', reason:'Medical appointment', avatar:'AR', clr:'#ff375f', cert:true },
  { no:'LV-26-0329', emp:'Tom Becker', dept:'Production', type:'Annual', from:'2026-06-23', to:'2026-06-27', days:5, status:'Pending Approval', balance:3, cover:'—', reason:'Holiday', avatar:'TB', clr:'#34c759', warn:'Exceeds balance by 2 days' },
  { no:'LV-26-0328', emp:'Lena Park', dept:'Sales', type:'Unpaid', from:'2026-07-01', to:'2026-07-05', days:5, status:'Pending Approval', balance:0, cover:'L. Tan', reason:'Personal', avatar:'LP', clr:'#ff9500' },
  { no:'LV-26-0327', emp:'Raj Haddad', dept:'Purchasing', type:'Annual', from:'2026-06-06', to:'2026-06-06', days:1, status:'Approved', balance:9, cover:'A. Bauer', reason:'Errand', avatar:'RH', clr:'#7b46d3' },
];

/* ===================== HR / PAYROLL depth (directory, profile, payroll, payslip) ===================== */
DB.employees = [
  { id:'EMP-1001', name:'Dana Reyes', dept:'Operations', role:'Operations Director', type:'Full-time', joined:'2019', status:'Active', av:'DR', clr:'#FF9500' },
  { id:'EMP-1042', name:'Marcus Silva', dept:'Warehouse', role:'Warehouse Supervisor', type:'Full-time', joined:'2021', status:'On leave', av:'MS', clr:'#0a84ff' },
  { id:'EMP-1055', name:'Aisha Rahman', dept:'Finance', role:'Senior Accountant', type:'Full-time', joined:'2020', status:'Active', av:'AR', clr:'#ff375f' },
  { id:'EMP-1071', name:'Tom Becker', dept:'Production', role:'Production Line Lead', type:'Full-time', joined:'2022', status:'Active', av:'TB', clr:'#34c759' },
  { id:'EMP-1088', name:'Lena Park', dept:'Sales', role:'Account Executive', type:'Full-time', joined:'2023', status:'Active', av:'LP', clr:'#ff9500' },
  { id:'EMP-1090', name:'Raj Haddad', dept:'Purchasing', role:'Procurement Buyer', type:'Full-time', joined:'2021', status:'Active', av:'RH', clr:'#7b46d3' },
  { id:'EMP-1102', name:'Liam Cardoso', dept:'Projects', role:'Project Manager', type:'Full-time', joined:'2020', status:'Active', av:'LC', clr:'#3457D5' },
  { id:'EMP-1119', name:'Aisha Karim', dept:'Engineering', role:'Lead Controls Engineer', type:'Full-time', joined:'2019', status:'Active', av:'AK', clr:'#0B6E7C' },
  { id:'EMP-1126', name:'Priya Nathan', dept:'Projects', role:'Project Manager', type:'Full-time', joined:'2022', status:'Active', av:'PN', clr:'#6536BE' },
  { id:'EMP-1140', name:'Samuel Boateng', dept:'IT', role:'Systems Analyst', type:'Contract', joined:'2024', status:'Probation', av:'SB', clr:'#9A6712' },
  { id:'EMP-1155', name:'Rosa Delgado', dept:'Service', role:'Service Coordinator', type:'Full-time', joined:'2023', status:'Active', av:'RD', clr:'#0a84ff' },
  { id:'EMP-1160', name:'Tom Fielding', dept:'Service', role:'Field Technician', type:'Full-time', joined:'2022', status:'Active', av:'TF', clr:'#9A6712' },
];
DB.emp1042 = {
  id:'EMP-1042', name:'Marcus Silva', dept:'Warehouse', role:'Warehouse Supervisor', manager:'Dana Reyes', type:'Full-time', status:'On leave', joined:'Mar 2021',
  email:'m.silva@northwind.co', phone:'+60 12-345 6789', location:'Kuala Lumpur HQ', av:'MS', clr:'#0a84ff',
  annual:50400, monthly:4200, bank:'HSBC ••4021',
  leave:{ annualUsed:5, annualTotal:16, medUsed:2, medTotal:10 },
  emergency:{ name:'Rosa Silva', rel:'Spouse', phone:'+60 12-987 6543' },
  documents:[
    { name:'Employment contract.pdf', meta:'PDF · signed Mar 2021', ic:'filepdf' },
    { name:'NRIC scan.pdf', meta:'PDF · on file', ic:'filepdf' },
    { name:'Forklift certification.pdf', meta:'PDF · valid to 2027', ic:'filepdf' },
  ],
};
DB.payrollRun = {
  period:'June 2026', status:'Pending Approval', payDate:'Jun 28, 2026', cutoff:'Jun 25',
  rows:[
    { name:'Dana Reyes', dept:'Operations', gross:12000, epf:1320, tax:1980, av:'DR', clr:'#FF9500' },
    { name:'Aisha Rahman', dept:'Finance', gross:6800, epf:748, tax:690, av:'AR', clr:'#ff375f' },
    { name:'Liam Cardoso', dept:'Projects', gross:8400, epf:924, tax:1010, av:'LC', clr:'#3457D5' },
    { name:'Aisha Karim', dept:'Engineering', gross:7600, epf:836, tax:860, av:'AK', clr:'#0B6E7C' },
    { name:'Raj Haddad', dept:'Purchasing', gross:5600, epf:616, tax:480, av:'RH', clr:'#7b46d3' },
    { name:'Lena Park', dept:'Sales', gross:5200, epf:572, tax:420, av:'LP', clr:'#ff9500' },
    { name:'Marcus Silva', dept:'Warehouse', gross:4200, epf:462, tax:210, av:'MS', clr:'#0a84ff' },
    { name:'Tom Becker', dept:'Production', gross:3900, epf:429, tax:180, av:'TB', clr:'#34c759' },
  ],
};
DB.payslip1042 = {
  id:'PSL-26-0642', emp:'Marcus Silva', empId:'EMP-1042', dept:'Warehouse', role:'Warehouse Supervisor',
  period:'June 2026', payDate:'Jun 28, 2026', bank:'HSBC ••4021', days:22,
  earnings:[ { k:'Basic salary', v:3500 }, { k:'Shift allowance', v:500 }, { k:'Overtime (8h @ $25)', v:200 } ],
  deductions:[ { k:'EPF — employee (11%)', v:462 }, { k:'PCB income tax', v:210 } ],
  employer:[ { k:'EPF — employer (13%)', v:546 }, { k:'SOCSO', v:34.65 }, { k:'EIS', v:9.90 } ],
};
