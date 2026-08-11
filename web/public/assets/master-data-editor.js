/* ============================================================
   ARIA ERP — shared master-data editor

   All master-data editors use the same modal shell, field semantics,
   validation/error rendering and save lifecycle. Business rules remain in
   the caller/domain command; this helper only owns editor UI behaviour.
   ============================================================ */
(function masterDataEditorFactory(){
  if(typeof window==='undefined') return;

  function fieldId(key){
    return 'masterDataEditorField-'+String(key||'').replace(/[^a-zA-Z0-9_-]/g,'-');
  }

  function optionParts(option){
    if(option&&typeof option==='object') return {value:option.value,label:option.label,disabled:option.disabled};
    return {value:option,label:option};
  }

  function renderField(field, values){
    var key=String(field.key||'');
    var id=field.id||fieldId(key);
    var value=values[key];
    var type=field.type||'text';
    var valueString=value==null?'':String(value);
    var required=Boolean(field.required);
    var span=field.span===2?' master-data-editor-field-span-2':'';
    var attrs=field.attributes||'';
    if(field.readOnly||field.disabled) attrs+=' readonly';
    if(field.disabled) attrs+=' disabled';
    if(field.autocomplete) attrs+=' autocomplete="'+esc(field.autocomplete)+'"';
    if(field.min!=null) attrs+=' min="'+esc(field.min)+'"';
    if(field.max!=null) attrs+=' max="'+esc(field.max)+'"';
    if(field.step!=null) attrs+=' step="'+esc(field.step)+'"';
    if(field.placeholder) attrs+=' placeholder="'+esc(field.placeholder)+'"';
    if(type==='select'){
      input='<select id="'+esc(id)+'" data-master-editor-input="'+esc(key)+'"'+attrs+'>'+
        (field.placeholder?'<option value="">'+esc(field.placeholder)+'</option>':'')+
        (field.options||[]).map(function(option){
          var item=optionParts(option);
          var selected=String(item.value==null?'':item.value)===valueString;
          return '<option value="'+esc(item.value==null?'':item.value)+'"'+(selected?' selected':'')+(item.disabled?' disabled':'')+'>'+esc(item.label==null?'':item.label)+'</option>';
        }).join('')+'</select>';
    }else if(type==='textarea'){
      input='<textarea id="'+esc(id)+'" data-master-editor-input="'+esc(key)+'"'+attrs+'>'+esc(valueString)+'</textarea>';
    }else{
      input='<input id="'+esc(id)+'" type="'+esc(type)+'" value="'+esc(valueString)+'" data-master-editor-input="'+esc(key)+'"'+attrs+'>';
    }
    return '<label class="fld master-data-editor-field'+span+'" data-master-editor-field="'+esc(key)+'">'+
      '<span>'+esc(field.label||key)+(required?' <span class="req">*</span>':'')+'</span>'+input+
      '<small class="field-error master-data-editor-field-error" data-master-editor-error="'+esc(key)+'" role="alert" hidden></small>'+
      (field.help?'<small class="master-data-editor-help">'+esc(field.help)+'</small>':'')+
      (field.locked?'<span class="locked">'+(typeof ic==='function'?ic('lock'):'')+' '+esc(field.locked)+'</span>':'')+
      '</label>';
  }

  function readValue(field, input){
    var raw=input?input.value:'';
    if(field.valueType==='number'){
      if(raw.trim()==='') return field.emptyValue===undefined?null:field.emptyValue;
      return Number(raw);
    }
    if(field.valueType==='boolean') return Boolean(input&&input.checked);
    if(field.emptyValue!==undefined && raw.trim()==='') return field.emptyValue;
    return field.trim===false?raw:raw.trim();
  }

  function open(config){
    var options=config||{};
    var fields=Array.isArray(options.fields)?options.fields:[];
    var initial=Object.assign({},options.values||{});
    var title=options.title||'Edit master data';
    var saveLabel=options.saveLabel||'Save changes';
    var cancelLabel=options.cancelLabel||((typeof t==='function'&&t('common.cancel'))||'Cancel');
    var modalClassNames=['master-data-editor-modal'];
    if(options.modalClass) modalClassNames.push(options.modalClass);
    var body='<div class="master-data-editor-body">'+
      (options.description?'<p class="hint master-data-editor-description">'+esc(options.description)+'</p>':'')+
      '<div class="master-data-editor-grid">'+fields.map(function(field){return renderField(field,initial);}).join('')+'</div>'+
      (options.note?'<div class="callout info master-data-editor-note">'+(typeof ic==='function'?ic('info'):'')+'<span>'+esc(options.note)+'</span></div>':'')+
      '<div class="auth-error master-data-editor-error" data-master-editor-root-error role="alert" hidden></div>'+
      '</div>';
    var actionAttrs='data-master-editor-save="1"';
    if(options.saveTestId) actionAttrs+=' data-testid="'+esc(options.saveTestId)+'"';
    if(typeof appModal!=='function') throw new Error('MasterDataEditor requires appModal.');
    appModal({
      icon:options.icon||'edit',
      title:title,
      body:body,
      actions:(typeof btn==='function'?btn(cancelLabel,{cls:'soft',attrs:'data-master-editor-cancel="1"'}):'<button type="button" data-master-editor-cancel="1">'+esc(cancelLabel)+'</button>')+
        (typeof btn==='function'?btn(saveLabel,{icon:'check',cls:'primary',attrs:actionAttrs}):'<button type="button" data-master-editor-save="1">'+esc(saveLabel)+'</button>'),
      width:options.width||720,
    });
    var modal=document.querySelector('#modalEl');
    if(!modal) return null;
    if(modalClassNames.length){
      modalClassNames.join(' ').split(/\s+/).filter(function(className){
        return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(className);
      }).forEach(function(className){modal.classList.add(className);});
    }
    var saveButton=modal.querySelector('[data-master-editor-save]');
    var cancelButton=modal.querySelector('[data-master-editor-cancel]');
    var rootError=modal.querySelector('[data-master-editor-root-error]');

    function findByData(attribute,key){
      var expected=String(key);
      return Array.from(modal.querySelectorAll('['+attribute+']')).find(function(node){
        return node.getAttribute(attribute)===expected;
      })||null;
    }

    function clearErrors(){
      modal.querySelectorAll('[data-master-editor-error]').forEach(function(node){node.hidden=true;node.textContent='';});
      modal.querySelectorAll('[data-master-editor-input]').forEach(function(node){node.removeAttribute('aria-invalid');});
      if(rootError){rootError.hidden=true;rootError.textContent='';}
    }
    function showErrors(fieldErrors, fallback){
      clearErrors();
      var entries=Object.entries(fieldErrors||{}).filter(function(entry){return String(entry[1]||'').trim();});
      entries.forEach(function(entry){
        var key=entry[0],message=String(entry[1]);
        var node=findByData('data-master-editor-error',key);
        var input=findByData('data-master-editor-input',key);
        if(node){node.hidden=false;node.textContent=message;}
        if(input) input.setAttribute('aria-invalid','true');
      });
      if(rootError&&fallback){rootError.hidden=false;rootError.textContent=fallback;}
      var first=entries.length?findByData('data-master-editor-input',entries[0][0]):null;
      if(first&&typeof first.focus==='function') first.focus();
    }
    function collect(){
      var values={};
      fields.forEach(function(field){values[field.key]=readValue(field,findByData('data-master-editor-input',field.key));});
      return values;
    }
    function validate(values){
      var errors={};
      fields.forEach(function(field){
        var value=values[field.key];
        var empty=value==null||(typeof value==='string'&&!value.trim());
        if(field.required&&empty) errors[field.key]=field.requiredMessage||((field.label||field.key)+' is required.');
        if(!errors[field.key]&&typeof field.validate==='function'){
          var message=field.validate(value,values);
          if(message) errors[field.key]=message;
        }
      });
      if(typeof options.validate==='function') Object.assign(errors,options.validate(values)||{});
      return errors;
    }
    cancelButton?.addEventListener('click',function(){
      if(typeof options.onCancel==='function') options.onCancel();
      closeModal();
    });
    saveButton?.addEventListener('click',async function(event){
      var button=event.currentTarget;
      var values=collect();
      var invalid=validate(values);
      if(Object.keys(invalid).length){showErrors(invalid,'');return;}
      button.disabled=true;
      clearErrors();
      try{
        var result=await options.onSave(values,{modal:modal,button:button,showErrors:showErrors,clearErrors:clearErrors});
        if(result!==false){closeModal();if(typeof options.onSaved==='function') await options.onSaved(result,values);}
      }catch(error){
        button.disabled=false;
        var fieldErrors=error&&error.fieldErrors&&typeof error.fieldErrors==='object'?error.fieldErrors:{};
        showErrors(fieldErrors,Object.keys(fieldErrors).length?'':((error&&error.message)||options.errorMessage||'The changes could not be saved.'));
      }
    });
    var firstInput=modal.querySelector('[data-master-editor-input]');
    if(options.focusFirst!==false&&firstInput&&typeof firstInput.focus==='function') firstInput.focus();
    return {modal:modal,close:closeModal,collect:collect,showErrors:showErrors,clearErrors:clearErrors};
  }

  window.MasterDataEditor={open:open,fieldId:fieldId};
})();
