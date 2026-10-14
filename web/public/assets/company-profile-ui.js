/* Company profile presentation for the canonical System Settings screen. */
(function(){
  const copy={
    en:{title:'Company profile',subtitle:'Legal identity and registered address for the active Company.',edit:'Edit profile',name:'Legal name',registration:'Registration number',taxNo:'Tax number',address:'Registered address',line1:'Address line 1',line2:'Address line 2',city:'City',region:'State / region',postal:'Postal code',logo:'Company logo',chooseLogo:'Choose or replace logo',removeLogo:'Remove logo',logoHelp:'PNG, JPEG or WebP · up to 256 KiB',noLogo:'No logo',country:'Country',currency:'Currency',tax:'Tax regime',save:'Save changes',cancel:'Cancel',saved:'Company profile saved.',required:'Enter the legal Company name.',invalidLogo:'Choose a PNG, JPEG or WebP logo.',largeLogo:'Logo must be at most 256 KiB.',readOnly:'Company identity and tax regime are managed separately.',empty:'Not provided'},
    zh:{title:'公司资料',subtitle:'当前公司的法定身份及注册地址。',edit:'编辑资料',name:'法定名称',registration:'注册号码',taxNo:'税号',address:'注册地址',line1:'地址第一行',line2:'地址第二行',city:'城市',region:'州／地区',postal:'邮政编码',logo:'公司标志',chooseLogo:'选择或更换标志',removeLogo:'移除标志',logoHelp:'PNG、JPEG 或 WebP · 不超过 256 KiB',noLogo:'没有标志',country:'国家／地区',currency:'币种',tax:'税制',save:'保存更改',cancel:'取消',saved:'公司资料已保存。',required:'请输入公司的法定名称。',invalidLogo:'请选择 PNG、JPEG 或 WebP 标志。',largeLogo:'标志不得超过 256 KiB。',readOnly:'公司身份和税制需另行管理。',empty:'未提供'},
    ms:{title:'Profil syarikat',subtitle:'Identiti sah dan alamat berdaftar bagi syarikat aktif.',edit:'Edit profil',name:'Nama berdaftar',registration:'Nombor pendaftaran',taxNo:'Nombor cukai',address:'Alamat berdaftar',line1:'Alamat baris 1',line2:'Alamat baris 2',city:'Bandar',region:'Negeri / wilayah',postal:'Poskod',logo:'Logo syarikat',chooseLogo:'Pilih atau ganti logo',removeLogo:'Buang logo',logoHelp:'PNG, JPEG atau WebP · sehingga 256 KiB',noLogo:'Tiada logo',country:'Negara',currency:'Mata wang',tax:'Rejim cukai',save:'Simpan perubahan',cancel:'Batal',saved:'Profil syarikat disimpan.',required:'Masukkan nama berdaftar syarikat.',invalidLogo:'Pilih logo PNG, JPEG atau WebP.',largeLogo:'Logo tidak boleh melebihi 256 KiB.',readOnly:'Identiti syarikat dan rejim cukai diurus secara berasingan.',empty:'Belum diisi'},
    ja:{title:'会社プロフィール',subtitle:'現在の会社の法人情報と登録住所。',edit:'プロフィールを編集',name:'登記上の名称',registration:'登録番号',taxNo:'税番号',address:'登録住所',line1:'住所1',line2:'住所2',city:'市区町村',region:'都道府県／地域',postal:'郵便番号',logo:'会社ロゴ',chooseLogo:'ロゴを選択・変更',removeLogo:'ロゴを削除',logoHelp:'PNG、JPEG、WebP · 256 KiB以下',noLogo:'ロゴなし',country:'国',currency:'通貨',tax:'税制度',save:'変更を保存',cancel:'キャンセル',saved:'会社プロフィールを保存しました。',required:'登記上の名称を入力してください。',invalidLogo:'PNG、JPEG、WebPのロゴを選択してください。',largeLogo:'ロゴは256 KiB以下にしてください。',readOnly:'会社識別子と税制度は別途管理されます。',empty:'未入力'},
    vi:{title:'Hồ sơ công ty',subtitle:'Thông tin pháp lý và địa chỉ đăng ký của công ty hiện tại.',edit:'Sửa hồ sơ',name:'Tên pháp lý',registration:'Số đăng ký',taxNo:'Mã số thuế',address:'Địa chỉ đăng ký',line1:'Địa chỉ dòng 1',line2:'Địa chỉ dòng 2',city:'Thành phố',region:'Tỉnh / vùng',postal:'Mã bưu chính',logo:'Logo công ty',chooseLogo:'Chọn hoặc thay logo',removeLogo:'Xóa logo',logoHelp:'PNG, JPEG hoặc WebP · tối đa 256 KiB',noLogo:'Chưa có logo',country:'Quốc gia',currency:'Tiền tệ',tax:'Chế độ thuế',save:'Lưu thay đổi',cancel:'Hủy',saved:'Đã lưu hồ sơ công ty.',required:'Nhập tên pháp lý của công ty.',invalidLogo:'Chọn logo PNG, JPEG hoặc WebP.',largeLogo:'Logo không được quá 256 KiB.',readOnly:'Danh tính công ty và chế độ thuế được quản lý riêng.',empty:'Chưa cung cấp'},
  };
  const tr=key=>(copy[getLang()]||copy.en)[key]||copy.en[key]||key;
  const value=text=>text?esc(String(text)):`<span class="cp-empty">${esc(tr('empty'))}</span>`;
  const safeLogo=data=>typeof data==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)?data:null;
  const fact=(label,content)=>`<div class="cp-fact"><small>${esc(label)}</small><strong>${content}</strong></div>`;
  const field=(id,label,valueText,max,required=false)=>`<label class="cp-field" for="${id}"><span>${esc(label)}${required?' *':''}</span><input id="${id}" name="${id}" value="${esc(valueText||'')}" maxlength="${max}" ${required?'required':''}></label>`;

  function viewMarkup(data,canManage){
    const logo=safeLogo(data.logoDataUrl);
    const address=[data.addressLine1,data.addressLine2,data.city,data.region,data.postalCode].filter(Boolean).map(esc).join('<br>');
    return `<section class="panel cp-panel" data-company-profile><div class="panel-h cp-heading"><div><h3>${esc(tr('title'))}</h3><p>${esc(tr('subtitle'))}</p></div>${canManage?`<button type="button" class="btn soft" data-company-profile-edit>${esc(tr('edit'))}</button>`:''}</div><div class="cp-view"><div class="cp-logo-view">${logo?`<img src="${esc(logo)}" alt="${esc(tr('logo'))}">`:`<div class="cp-logo-placeholder" aria-label="${esc(tr('noLogo'))}">${esc((data.name||'?').slice(0,1).toUpperCase())}</div>`}<small>${esc(tr('logo'))}</small></div><div class="cp-facts">${fact(tr('name'),value(data.name))}${fact(tr('registration'),value(data.registrationNo))}${fact(tr('taxNo'),value(data.taxNo))}${fact(tr('address'),address||value(''))}${fact(tr('country'),value(data.country))}${fact(tr('currency'),value(data.currency))}${fact(tr('tax'),value(data.taxRegime))}</div></div></section>`;
  }

  function editMarkup(data,logoDraft){
    const logo=safeLogo(logoDraft);
    return `<section class="panel cp-panel" data-company-profile><div class="panel-h cp-heading"><div><h3>${esc(tr('title'))}</h3><p>${esc(tr('subtitle'))}</p></div></div><form data-company-profile-form novalidate><div class="cp-form-body"><div class="cp-message" role="alert" tabindex="-1" hidden></div><div class="cp-edit-main"><div class="cp-logo-edit"><span class="cp-label">${esc(tr('logo'))}</span><div data-company-profile-logo-preview>${logo?`<img src="${esc(logo)}" alt="${esc(tr('logo'))}">`:`<div class="cp-logo-placeholder" aria-label="${esc(tr('noLogo'))}">${esc((data.name||'?').slice(0,1).toUpperCase())}</div>`}</div><label class="cp-file-label" for="cpLogoFile">${esc(tr('chooseLogo'))}</label><input id="cpLogoFile" type="file" accept="image/png,image/jpeg,image/webp" data-company-profile-logo><span class="cp-file-name" data-company-profile-file-name></span><button type="button" class="btn soft" data-company-profile-remove ${logo?'':'hidden'}>${esc(tr('removeLogo'))}</button><small>${esc(tr('logoHelp'))}</small></div><div class="cp-field-groups"><div class="cp-grid">${field('cpLegalName',tr('name'),data.name,160,true)}${field('cpRegistrationNo',tr('registration'),data.registrationNo,80)}${field('cpTaxNo',tr('taxNo'),data.taxNo,80)}</div><h4>${esc(tr('address'))}</h4><div class="cp-grid">${field('cpAddressLine1',tr('line1'),data.addressLine1,160)}${field('cpAddressLine2',tr('line2'),data.addressLine2,160)}${field('cpCity',tr('city'),data.city,100)}${field('cpRegion',tr('region'),data.region,100)}${field('cpPostalCode',tr('postal'),data.postalCode,20)}</div><p class="cp-readonly">${esc(tr('readOnly'))} ${esc(tr('country'))}: ${esc(data.country)} · ${esc(tr('currency'))}: ${esc(data.currency)} · ${esc(tr('tax'))}: ${esc(data.taxRegime)}</p></div></div></div><div class="cp-actions"><button type="button" class="btn soft" data-company-profile-cancel>${esc(tr('cancel'))}</button><button type="submit" class="btn primary" data-company-profile-save>${esc(tr('save'))}</button></div></form></section>`;
  }

  function mount(root,data,canManage){
    const settings=root.querySelector('[data-canonical-system-settings]');
    if(!settings) return;
    const oldFacts=settings.querySelector('.panel');
    if(oldFacts) oldFacts.remove();
    settings.insertAdjacentHTML('afterbegin',viewMarkup(data,canManage));
    if(!canManage) return;
    function showView(){
      settings.querySelector('[data-company-profile]').outerHTML=viewMarkup(data,true);
      settings.querySelector('[data-company-profile-edit]').addEventListener('click',showEdit);
    }
    function showEdit(){
      let logoDraft=data.logoDataUrl||null;
      settings.querySelector('[data-company-profile]').outerHTML=editMarkup(data,logoDraft);
      const form=settings.querySelector('[data-company-profile-form]');
      const message=form.querySelector('.cp-message');
      const name=form.querySelector('#cpLegalName');
      const save=form.querySelector('[data-company-profile-save]');
      const fileInput=form.querySelector('[data-company-profile-logo]');
      const fileName=form.querySelector('[data-company-profile-file-name]');
      const remove=form.querySelector('[data-company-profile-remove]');
      const preview=form.querySelector('[data-company-profile-logo-preview]');
      const showError=messageText=>{message.hidden=false;message.textContent=messageText;message.focus();};
      form.querySelector('[data-company-profile-cancel]').addEventListener('click',showView);
      remove.addEventListener('click',()=>{
        logoDraft=null;fileInput.value='';fileName.textContent='';remove.hidden=true;
        preview.innerHTML=`<div class="cp-logo-placeholder" aria-label="${esc(tr('noLogo'))}">${esc((name.value||'?').slice(0,1).toUpperCase())}</div>`;
      });
      fileInput.addEventListener('change',async()=>{
        const file=fileInput.files&&fileInput.files[0];
        if(!file) return;
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)){showError(tr('invalidLogo'));fileInput.value='';return;}
        if(file.size>256*1024){showError(tr('largeLogo'));fileInput.value='';return;}
        try{
          save.disabled=true;
          logoDraft=await new Promise((resolve,reject)=>{
            const reader=new FileReader();
            reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error);
            reader.readAsDataURL(file);
          });
          preview.innerHTML=`<img src="${esc(logoDraft)}" alt="${esc(tr('logo'))}">`;
          fileName.textContent=file.name;
          remove.hidden=false;message.hidden=true;
        }catch{showError(tr('invalidLogo'));}finally{save.disabled=false;}
      });
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        name.removeAttribute('aria-invalid');
        if(!name.value.trim()){
          name.setAttribute('aria-invalid','true');showError(tr('required'));name.focus();return;
        }
        const get=id=>form.querySelector('#'+id).value;
        const payload={
          name:get('cpLegalName'),registrationNo:get('cpRegistrationNo'),taxNo:get('cpTaxNo'),
          addressLine1:get('cpAddressLine1'),addressLine2:get('cpAddressLine2'),
          city:get('cpCity'),region:get('cpRegion'),postalCode:get('cpPostalCode'),
          logoDataUrl:logoDraft,expectedVersion:data.profileVersion,
        };
        save.disabled=true;message.hidden=true;
        try{
          await window.ErpSystemData.action('settings/company-profile','current','update',payload,controlPlaneKey('company-profile'));
          await window.ErpSystemData.refresh();
          toast(tr('saved'),'ok');
          await navigate('sys-settings');
        }catch(error){save.disabled=false;showError(error&&error.message||String(error));}
      });
      name.focus();
    }
    settings.querySelector('[data-company-profile-edit]').addEventListener('click',showEdit);
  }
  window.mountCompanyProfilePanel=mount;
}());
