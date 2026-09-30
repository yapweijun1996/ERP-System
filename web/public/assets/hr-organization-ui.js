(function(){
  function label(key){return t('hr.org.'+key);}
  window.openHrOrganization=async function(){
    var opener=document.activeElement,dialog=document.createElement('dialog');
    dialog.className='hr-organization-dialog';dialog.setAttribute('aria-labelledby','hr-organization-title');
    dialog.innerHTML='<div class="hr-organization-head"><h2 id="hr-organization-title">'+esc(label('title'))+'</h2><button type="button" data-org-close aria-label="'+esc(label('close'))+'">×</button></div><p>'+esc(label('hint'))+'</p><p role="status" data-org-status></p><div data-org-body></div>';
    document.body.appendChild(dialog);dialog.showModal();
    function close(){dialog.close();dialog.remove();if(opener&&opener.isConnected)opener.focus();}
    dialog.addEventListener('cancel',function(event){event.preventDefault();close();});dialog.querySelector('[data-org-close]').onclick=close;
    var body=dialog.querySelector('[data-org-body]'),status=dialog.querySelector('[data-org-status]'),units=[],positions=[],employees=[];
    async function refresh(){
      status.textContent=label('loading');
      try{var results=await Promise.all([ErpSystemData.organizationList('business_unit'),ErpSystemData.organizationList('position'),ErpSystemData.list('hr/employees',{limit:100})]);units=results[0].data;positions=results[1].data;employees=results[2].data;render();status.textContent='';}
      catch(error){status.textContent=error.message;body.innerHTML='';}
    }
    function editor(kind,row){
      body.innerHTML='<form data-org-editor><h3>'+esc(label(kind))+'</h3><label>'+esc(label('code'))+'<input name="code" required maxlength="40" value="'+esc(row?.code||'')+'"></label><label>'+esc(label('name'))+'<input name="name" required maxlength="120" value="'+esc(row?.name||'')+'"></label><label class="hr-org-check"><input type="checkbox" name="active" '+(row?.isActive!==false?'checked':'')+'>'+esc(label('active'))+'</label><div class="hr-org-actions"><button type="submit">'+esc(label('save'))+'</button><button type="button" data-org-cancel>'+esc(label('cancel'))+'</button></div></form>';
      body.querySelector('[data-org-cancel]').onclick=render;body.querySelector('input').focus();
      body.querySelector('form').onsubmit=async function(event){event.preventDefault();var form=event.currentTarget,submit=form.querySelector('[type=submit]');submit.disabled=true;status.textContent=label('saving');
        try{await ErpSystemData.organizationSave(kind,{id:row?.id,code:form.elements.code.value,name:form.elements.name.value,isActive:form.elements.active.checked,expectedVersion:row?.version||0});await refresh();status.textContent=label('saved');}
        catch(error){status.textContent=error.message;submit.disabled=false;}
      };
    }
    function assignment(){
      function options(rows){return '<option value="">'+esc(label('unassigned'))+'</option>'+rows.filter(row=>row.isActive!==false).map(row=>'<option value="'+row.id+'">'+esc(row.code+' · '+row.name)+'</option>').join('');}
      body.innerHTML='<form data-org-assignment><h3>'+esc(label('assignment'))+'</h3><label>'+esc(label('employee'))+'<select name="employee" required><option value="">'+esc(label('choose'))+'</option>'+employees.filter(row=>row.isActive!==false).map(row=>'<option value="'+row.id+'">'+esc(row.employeeNo+' · '+row.fullName)+'</option>').join('')+'</select></label><label>'+esc(label('business_unit'))+'<select name="unit">'+options(units)+'</select></label><label>'+esc(label('position'))+'<select name="position">'+options(positions)+'</select></label><label>'+esc(label('reason'))+'<textarea name="reason" required maxlength="500"></textarea></label><div class="hr-org-actions"><button type="submit">'+esc(label('save'))+'</button><button type="button" data-org-cancel>'+esc(label('cancel'))+'</button></div></form>';
      var form=body.querySelector('form');body.querySelector('[data-org-cancel]').onclick=render;form.elements.employee.focus();
      form.elements.employee.onchange=function(){var row=employees.find(row=>row.id===Number(form.elements.employee.value));form.elements.unit.value=row?.businessUnitId||'';form.elements.position.value=row?.positionId||'';};
      form.onsubmit=async function(event){event.preventDefault();var row=employees.find(row=>row.id===Number(form.elements.employee.value));if(!row)return;var submit=form.querySelector('[type=submit]');submit.disabled=true;status.textContent=label('saving');
        try{await ErpSystemData.organizationAssign(row.id,{businessUnitId:form.elements.unit.value?Number(form.elements.unit.value):null,positionId:form.elements.position.value?Number(form.elements.position.value):null,expectedVersion:row.organizationVersion||0,reason:form.elements.reason.value});await refresh();status.textContent=label('saved');}
        catch(error){status.textContent=error.message;submit.disabled=false;}
      };
    }
    function render(){
      status.textContent='';body.innerHTML=['business_unit','position'].map(function(kind){var rows=kind==='business_unit'?units:positions;return '<section><h3>'+esc(label(kind))+'</h3><button type="button" data-org-new="'+kind+'">'+esc(label('add'))+'</button><ul class="hr-org-list">'+(rows.length?rows.map(row=>'<li><span>'+esc(row.code+' · '+row.name)+'<small>'+esc(label(row.isActive?'active':'inactive'))+'</small></span><button type="button" data-org-edit="'+kind+':'+row.id+'">'+esc(label('edit'))+'</button></li>').join(''):'<li>'+esc(label('empty'))+'</li>')+'</ul></section>';}).join('')+'<button type="button" data-org-assign>'+esc(label('assignment'))+'</button>';
      body.querySelectorAll('[data-org-new]').forEach(button=>button.onclick=()=>editor(button.dataset.orgNew));
      body.querySelectorAll('[data-org-edit]').forEach(button=>button.onclick=function(){var parts=button.dataset.orgEdit.split(':');editor(parts[0],(parts[0]==='business_unit'?units:positions).find(row=>row.id===Number(parts[1])));});body.querySelector('[data-org-assign]').onclick=assignment;
    }
    await refresh();
  };
})();
