/* ARIA ERP — one-stop Staff onboarding: employee + identity + company roles. */
function nextEmployeeNo(employees){
  let max=1000;
  employees.forEach(e=>{ const m=/(\d+)\s*$/.exec(e.employeeNo||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'EMP-'+(max+1);
}

SCREENS['new-employee'] = async function(root){
  const s=hrCopy();
  const {employees}=await prepareHrData();
  let roles=[];
  try{ roles=(await window.ErpSystemData.list('admin/roles')).data||[]; }catch{}
  roles=roles.filter(role=>!role.isSuperadmin&&role.name!=='Employee');
  let step=1;
  const EMPLOYMENT_TYPES=[
    ['Full-time',t('hr.emp.fulltime')],['Part-time',s('typeParttime')],
    ['Contract',t('hr.emp.contract')],['Intern',s('typeIntern')],
  ];
  const managerOptions=employees.map(manager=>({
    value:String(manager.id),label:manager.fullName,sub:manager.jobTitle,
  }));
  const steps=[t('staff.step.profile'),t('staff.step.identity'),t('staff.step.access')];

  function render(){
    root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,t('nav.hr'),{label:t('hr.crumb'),route:'hr-directory'},{cur:t('staff.add')}])}
      <div class="dochead"><div class="dh-row1"><div><div class="dt">${ic('people')}${esc(t('staff.add'))}</div>
        <div class="sub">${esc(t('staff.subtitle'))}</div></div></div></div>
      <div class="staff-onboarding-progress" aria-label="${esc(t('staff.progress'))}">${wizardStepper(steps,step-1,step-1)}</div>
      <div class="doclayout"><div class="docmain">
        <div class="alert danger staff-onboarding-error" data-staff-onboarding-error hidden>${ic('warn')}<span></span></div>
        <div class="panel" ${step===1?'':'hidden'}><div class="panel-h">${ic('user')}<h3>${esc(t('staff.step.profile'))}</h3></div><div class="panel-body">
          <div class="fldrow c2"><div class="fld"><span>${esc(s('fieldFullName'))} <span class="req">*</span></span><input id="neName"></div>
          <div class="fld"><span>${esc(s('fieldEmail'))} <span class="req">*</span></span><input id="neEmail" type="email"></div></div>
          <div class="fldrow c2" style="margin-top:12px"><div class="fld"><span>${esc(s('fieldPhone'))}</span><input id="nePhone"></div>
          <div class="fld"><span>${esc(t('staff.employeeNo'))}</span><input id="neNumber" value="${esc(nextEmployeeNo(employees))}"></div></div>
          <div class="fldrow c3" style="margin-top:12px"><div class="fld"><span>${esc(s('fieldDept'))} *</span><input id="neDept"></div>
          <div class="fld"><span>${esc(s('fieldJobTitle'))} *</span><input id="neTitle"></div>
          <div class="fld"><span>${esc(s('fieldEmploymentType'))}</span><select id="neType">${EMPLOYMENT_TYPES.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}</select></div></div>
          <div class="fldrow c3" style="margin-top:12px"><div class="fld"><span>${esc(s('fieldManager'))}</span>${combobox({id:'neManager',value:draft.neManager||'',options:managerOptions,placeholder:s('noManagerOption')})}</div>
          <div class="fld"><span>${esc(s('fieldStartDate'))}</span><input type="date" id="neStart" value="2026-07-27"></div>
          <div class="fld"><span>${esc(s('fieldBaseSalary'))} *</span><input type="number" id="neSalary" min="0" step="0.01"></div></div>
        </div></div>
        <div class="panel" ${step===2?'':'hidden'}><div class="panel-h">${ic('lock')}<h3>${esc(t('staff.step.identity'))}</h3></div><div class="panel-body">
          <div class="callout info">${esc(t('staff.identityHint'))}</div>
          <div class="fldrow c2"><div class="fld"><span>${esc(t('staff.username'))} *</span><input id="neUsername" autocomplete="off"></div>
          <div class="fld"><span>${esc(t('staff.workEmail'))} *</span><input id="neAccountEmail" type="email"></div></div>
          <div class="fldrow c2" style="margin-top:12px"><div class="fld"><span>${esc(t('staff.initialPassword'))} *</span><input id="nePassword" type="password" autocomplete="new-password"></div>
          <div class="fld"><span>${esc(t('staff.expiry'))}</span><input value="${esc(t('staff.expiryValue'))}" disabled></div></div>
          <p class="hint">${esc(t('staff.passwordHint'))}</p>
        </div></div>
        <div class="panel" ${step===3?'':'hidden'}><div class="panel-h">${ic('shield')}<h3>${esc(t('staff.companyRoles'))}</h3></div><div class="panel-body">
          <div class="callout info">${esc(t('staff.roleHint',{company:DB.company.name}))}</div>
          <div class="check-grid">${roles.length?roles.map(role=>`<label class="check-row"><input type="checkbox" name="neRole" value="${role.roleId}"><span><b>${esc(role.name)}</b><small>${esc(role.sourceTemplateKey||t('staff.customRole'))}</small></span></label>`).join(''):`<div class="empty-state">${esc(t('staff.noRoles'))}</div>`}</div>
          <div class="fldrow c2" style="margin-top:12px"><div class="fld"><span>${esc(s('fieldAnnualDays'))}</span><input type="number" id="neLeave" min="0" max="40" value="14"></div></div>
        </div></div>
      </div></div></div></div>
      <div class="set-savebar"><div class="staff-onboarding-save-context"><b>${esc(t('staff.stepCount',{step}))}</b><small>${esc(steps[step-1])}</small></div><div class="grow"></div>
        ${btn(step===1?t('common.cancel'):t('staff.back'),{cls:'soft',attrs:'id="neBack"'})}
        ${btn(step<3?t('staff.continue'):t('staff.activate'),{icon:step<3?'arrowR':'plus',cls:'primary',attrs:'id="neNext"'})}</div>
    </section></div>`;
    $('#neBack').addEventListener('click',()=>{ if(step===1) navigate('hr-directory'); else{ step-=1; render(); restore(); } });
    $('#neNext').addEventListener('click',()=>{ if(step<3) next(); else activate(); });
    restore();
  }

  const draft={};
  function capture(){
    root.querySelectorAll('input,select').forEach(field=>{
      if(field.id) draft[field.id]=field.id==='neManager'?(field.dataset.value||''):field.value;
      if(field.name==='neRole'&&field.checked) (draft.roles||(draft.roles=[])).push(field.value);
    });
  }
  function restore(){
    root.querySelectorAll('input,select').forEach(field=>{
      if(field.id&&field.id!=='neManager'&&draft[field.id]!=null) field.value=draft[field.id];
      if(field.name==='neRole') field.checked=(draft.roles||[]).includes(field.value);
    });
    wireCombobox('neManager',{options:managerOptions,onChange:value=>{ draft.neManager=value; }});
  }
  function clearValidation(){
    root.querySelector('[data-staff-onboarding-error]')?.setAttribute('hidden','');
    root.querySelectorAll('.fld.is-invalid').forEach(field=>field.classList.remove('is-invalid'));
    root.querySelectorAll('[aria-invalid="true"]').forEach(field=>field.removeAttribute('aria-invalid'));
    root.querySelectorAll('[data-staff-field-error]').forEach(error=>error.remove());
  }
  function showValidation(message,invalidFields){
    clearValidation();
    const banner=root.querySelector('[data-staff-onboarding-error]');
    if(banner){ banner.hidden=false; banner.querySelector('span').textContent=message; }
    invalidFields.forEach(({id,message:fieldMessage})=>{
      const field=root.querySelector('#'+id); if(!field) return;
      field.setAttribute('aria-invalid','true');
      const container=field.closest('.fld');
      if(container){
        container.classList.add('is-invalid');
        const error=document.createElement('small');
        error.dataset.staffFieldError='';
        error.className='staff-field-error';
        error.textContent=fieldMessage;
        container.appendChild(error);
      }
    });
    const first=root.querySelector('[aria-invalid="true"]');
    first?.focus();
  }
  function next(){
    capture();
    if(step===1){
      const emailValid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(draft.neEmail||''));
      const invalid=[
        !String(draft.neName||'').trim()&&{id:'neName',message:s('fullNameRequired')},
        !emailValid&&{id:'neEmail',message:s('emailRequired')},
        !String(draft.neDept||'').trim()&&{id:'neDept',message:s('deptRequired')},
        !String(draft.neTitle||'').trim()&&{id:'neTitle',message:s('jobTitleRequired')},
        !(Number(draft.neSalary)>0)&&{id:'neSalary',message:s('baseSalaryRequired')},
      ].filter(Boolean);
      if(invalid.length){ showValidation(t('staff.validationEmployee'),invalid); return; }
      clearValidation();
      draft.neAccountEmail=draft.neEmail;
      draft.neUsername=String(draft.neEmail).split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g,'');
    }else if(step===2){
      const invalid=[
        !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(draft.neUsername||'')&&{id:'neUsername',message:t('staff.validationIdentity')},
        String(draft.nePassword||'').length<8&&{id:'nePassword',message:t('staff.validationIdentity')},
      ].filter(Boolean);
      if(invalid.length){ showValidation(t('staff.validationIdentity'),invalid); return; }
      clearValidation();
    }
    step+=1; render();
  }
  async function activate(){
    draft.roles=[]; capture();
    if(!draft.roles.length){
      const banner=root.querySelector('[data-staff-onboarding-error]');
      if(banner){ banner.hidden=false; banner.querySelector('span').textContent=t('staff.validationRole'); }
      root.querySelector('input[name="neRole"]')?.focus();
      return;
    }
    const button=$('#neNext'); button.disabled=true;
    try{
      await window.ErpSystemData.createStaffAccount({
        employee:{employeeNo:draft.neNumber,fullName:draft.neName,email:draft.neEmail,
          phone:draft.nePhone||null,department:draft.neDept,jobTitle:draft.neTitle,
          employmentType:draft.neType,managerId:draft.neManager?Number(draft.neManager):null,
          startDate:draft.neStart,annualLeaveDays:Number(draft.neLeave||14),
          baseSalary:Number(draft.neSalary).toFixed(2)},
        username:draft.neUsername,email:draft.neAccountEmail,
        roleIds:draft.roles.map(Number),initialPassword:draft.nePassword,
      });
      toast(t('staff.ready',{name:draft.neName}),'ok');
      navigate('hr-directory');
    }catch(error){ button.disabled=false; toast((error&&error.message)||s('createError'),'danger'); }
  }
  render();
};
