/* ============================================================
   ARIA ERP — Add Employee (create flow)
   A single real form, not the former 3-step compensation/provisioning
   wizard — the employee table has no salary/pay-grade/provisioning
   fields to back those steps. See docs/EPICS.md EPIC-020.
   ============================================================ */
function nextEmployeeNo(employees){
  let max=1000;
  employees.forEach(e=>{ const m=/(\d+)\s*$/.exec(e.employeeNo||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'EMP-'+(max+1);
}

SCREENS['new-employee'] = async function(root){
  const s=hrCopy();
  const {employees}=await prepareHrData();
  const EMPLOYMENT_TYPES=[
    ['Full-time',t('hr.emp.fulltime')],['Part-time',s('typeParttime')],
    ['Contract',t('hr.emp.contract')],['Intern',s('typeIntern')],
  ];

  function managerOptions(){
    return `<option value="">${esc(s('noManagerOption'))}</option>`+
      employees.map(m=>`<option value="${m.id}">${esc(m.fullName)} · ${esc(m.jobTitle)}</option>`).join('');
  }

  function render(){
    root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,t('nav.hr'),{label:t('hr.crumb'),route:'hr-directory'},{cur:'New'}])}
      <div class="dochead">
        <div class="dh-row1">
          <div><div class="dt">${ic('people')}${esc(s('newEmployeeTitle'))}</div></div>
        </div>
      </div>
      <div class="doclayout"><div class="docmain">
        <div class="panel">
          <div class="panel-h">${ic('user')}<h3>${esc(s('personalContact'))}</h3></div>
          <div class="panel-body">
            <div class="fldrow c2">
              <div class="fld"><span>${esc(s('fieldFullName'))} <span class="req">*</span></span><input id="neName" placeholder="${esc(s('fullNamePlaceholder'))}"></div>
              <div class="fld"><span>${esc(s('fieldEmail'))} <span class="req">*</span></span><input id="neEmail" type="email" placeholder="${esc(s('emailPlaceholder'))}"></div>
            </div>
            <div class="fldrow c2" style="margin-top:12px">
              <div class="fld"><span>${esc(s('fieldPhone'))}</span><input id="nePhone" placeholder="${esc(s('phonePlaceholder'))}"></div>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-h">${ic('grid')}<h3>${esc(s('fieldEmployment'))}</h3></div>
          <div class="panel-body">
            <div class="fldrow c2">
              <div class="fld"><span>${esc(s('fieldDept'))} <span class="req">*</span></span><input id="neDept" placeholder="e.g. Operations"></div>
              <div class="fld"><span>${esc(s('fieldJobTitle'))} <span class="req">*</span></span><input id="neTitle" placeholder="${esc(s('jobTitlePlaceholder'))}"></div>
            </div>
            <div class="fldrow c3" style="margin-top:12px">
              <div class="fld"><span>${esc(s('fieldEmploymentType'))}</span><select id="neType">${EMPLOYMENT_TYPES.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}</select></div>
              <div class="fld"><span>${esc(s('fieldManager'))}</span><select id="neManager">${managerOptions()}</select></div>
              <div class="fld"><span>${esc(s('fieldStartDate'))}</span><input type="date" id="neStart" value="${new Date().toISOString().slice(0,10)}"></div>
            </div>
            <div class="fldrow c2" style="margin-top:12px">
              <div class="fld"><span>${esc(s('fieldAnnualDays'))}</span><input type="number" id="neLeave" min="0" max="40" value="14"></div>
            </div>
          </div>
        </div>
      </div></div>
      <div style="height:8px"></div>
    </div></div>
    <div class="set-savebar">
      <div class="grow"></div>
      ${btn(t('common.cancel'),{cls:'soft',attrs:'id="neCancel"'})}
      ${btn(s('createEmployee'),{icon:'plus',cls:'primary',attrs:'id="neCreate"'})}
    </div>
    </section></div>`;
    $('#neCancel').addEventListener('click',()=>navigate('hr-directory'));
    $('#neCreate').addEventListener('click', onCreate);
  }

  async function onCreate(){
    const name=$('#neName').value.trim();
    const email=$('#neEmail').value.trim();
    const dept=$('#neDept').value.trim();
    const title=$('#neTitle').value.trim();
    if(!requireField(name, s('fullNameRequired'), '#neName')) return;
    if(!requireField(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), s('emailRequired'), '#neEmail')) return;
    if(!requireField(dept, s('deptRequired'), '#neDept')) return;
    if(!requireField(title, s('jobTitleRequired'), '#neTitle')) return;
    const managerId=$('#neManager').value?Number($('#neManager').value):null;
    const createBtn=$('#neCreate');
    createBtn.disabled=true;
    try{
      await window.ErpSystemData.create('hr/employees',{
        employeeNo:nextEmployeeNo(employees),
        fullName:name, email, phone:$('#nePhone').value.trim()||null,
        department:dept, jobTitle:title, employmentType:$('#neType').value,
        managerId, startDate:$('#neStart').value,
        annualLeaveDays:Math.max(0,+$('#neLeave').value||0),
      });
      navigate('hr-directory');
      toast(s('employeeCreated').replace('{name}',name),'ok');
    }catch{
      createBtn.disabled=false;
      toast(s('createError'),'danger');
    }
  }

  render();
};
