/* ============================================================
   ARIA ERP — Canonical browser UI i18n runtime
   English is synchronously provided by i18n-en.js. The other
   locale packs are validated and loaded atomically on demand.
   ============================================================ */

const I18N_LANGS = Object.freeze([
  { code:'en', locale:'en-SG', native:'English', label:'English' },
  { code:'ms', locale:'ms-MY', native:'Bahasa Melayu', label:'Malay' },
  { code:'zh', locale:'zh-Hans', native:'简体中文', label:'Chinese' },
  { code:'ja', locale:'ja-JP', native:'日本語', label:'Japanese' },
  { code:'vi', locale:'vi-VN', native:'Tiếng Việt', label:'Vietnamese' },
]);

const I18N_LOCALES = Object.freeze(Object.fromEntries(I18N_LANGS.map(item=>[item.code,item.locale])));
const I18N_CODES = new Set(I18N_LANGS.map(item=>item.code));
const I18N = { en:window.__ERP_I18N_EN__||Object.freeze({}) };
const I18N_REGISTERED = Object.fromEntries(I18N_LANGS.map(item=>[item.code,Object.freeze({})]));
const I18N_LOADING = new Map();
const I18N_MISSING = new Set();
const I18N_BUSINESS_EXACT = new Set(window.__ERP_I18N_BUSINESS_TEXT__?.exact||[]);
const I18N_BUSINESS_PATTERNS = (window.__ERP_I18N_BUSINESS_TEXT__?.patterns||[]).map(pattern=>new RegExp(pattern));
const I18N_SCRIPT_URL = document.currentScript&&document.currentScript.src
  ?document.currentScript.src:location.href;
const I18N_PACK_BASE = new URL('i18n/',I18N_SCRIPT_URL);

let LANG='en';
let LAST_APPLIED_LANG='en';
let I18N_INITIALIZED=false;
let I18N_INIT_PROMISE=null;
let I18N_RETURN_FOCUS=null;

function i18nStoredLanguage(){
  try{
    const stored=localStorage.getItem('aria-lang');
    return I18N_CODES.has(stored)?stored:'en';
  }catch{return 'en';}
}

function getLang(){ return LANG; }
function getLocale(code=LANG){ return I18N_LOCALES[code]||I18N_LOCALES.en; }

function i18nHasMarkup(value){ return /<\/?[a-z][^>]*>/i.test(value); }
function i18nPlaceholderSignature(value){
  const strings=typeof value==='string'?[value]:value&&typeof value==='object'?Object.values(value):[];
  return [...new Set(strings.flatMap(text=>typeof text==='string'?[...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match=>match[1]):[]))].sort().join(',');
}
function validateLocalePack(code,pack){
  if(!I18N_CODES.has(code)||code==='en') throw new Error(`Unsupported locale pack: ${code}`);
  if(!pack||Array.isArray(pack)||typeof pack!=='object') throw new Error(`Invalid locale pack: ${code}`);
  const clean={};
  for(const [key,value] of Object.entries(pack)){
    if(!key||typeof key!=='string') throw new Error(`Invalid locale key in ${code}`);
    if(typeof value==='string'){
      if(i18nHasMarkup(value)) throw new Error(`Unsafe markup in ${code}:${key}`);
      if(I18N.en[key]!=null&&i18nPlaceholderSignature(value)!==i18nPlaceholderSignature(I18N.en[key])) throw new Error(`Placeholder mismatch in ${code}:${key}`);
      clean[key]=value;
      continue;
    }
    if(value&&typeof value==='object'&&!Array.isArray(value)){
      const forms={};
      for(const [form,text] of Object.entries(value)){
        if(typeof text!=='string'||i18nHasMarkup(text)) throw new Error(`Invalid plural form in ${code}:${key}.${form}`);
        forms[form]=text;
      }
      if(!Object.keys(forms).length) throw new Error(`Empty plural form in ${code}:${key}`);
      if(I18N.en[key]!=null&&i18nPlaceholderSignature(forms)!==i18nPlaceholderSignature(I18N.en[key])) throw new Error(`Placeholder mismatch in ${code}:${key}`);
      clean[key]=Object.freeze(forms);
      continue;
    }
    throw new Error(`Unsupported locale value in ${code}:${key}`);
  }
  return Object.freeze(clean);
}

function loadLocale(code){
  if(!I18N_CODES.has(code)) return Promise.reject(new Error(`Unsupported language: ${code}`));
  if(I18N[code]) return Promise.resolve(I18N[code]);
  if(I18N_LOADING.has(code)) return I18N_LOADING.get(code);
  const localeUrl=new URL(`${code}.json`,I18N_PACK_BASE);
  const localeVersion=new URL(I18N_SCRIPT_URL).searchParams.get('v');
  if(localeVersion) localeUrl.searchParams.set('v',localeVersion);
  const request=fetch(localeUrl,{headers:{accept:'application/json'}})
    .then(response=>{
      if(!response.ok) throw new Error(`Locale ${code} failed with HTTP ${response.status}`);
      return response.json();
    })
    .then(pack=>{
      I18N[code]=Object.freeze(Object.assign({},validateLocalePack(code,pack),I18N_REGISTERED[code]));
      return I18N[code];
    })
    .finally(()=>I18N_LOADING.delete(code));
  I18N_LOADING.set(code,request);
  return request;
}

function i18nTemplate(value,params){
  if(typeof value==='string') return value;
  if(!value||typeof value!=='object') return null;
  const count=Number(params&&params.count);
  if(Number.isFinite(count)&&Object.prototype.hasOwnProperty.call(value,`=${count}`)) return value[`=${count}`];
  const category=Number.isFinite(count)?new Intl.PluralRules(getLocale()).select(count):'other';
  return value[category]??value.other??Object.values(value)[0]??null;
}

function i18nInterpolate(template,params){
  if(typeof template!=='string'||!params) return template;
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(match,name)=>
    Object.prototype.hasOwnProperty.call(params,name)?String(params[name]??'').replace(/[&<>"']/g,char=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
    })[char]):match);
}

function i18nResolve(key,fallback,params){
  const active=I18N[LANG]||I18N.en;
  let value=active[key];
  if(value==null) value=I18N.en[key];
  if(value==null){
    const marker=`${LANG}:${key}`;
    if(!I18N_MISSING.has(marker)){
      I18N_MISSING.add(marker);
      console.warn(`Missing i18n key ${key} for ${LANG}; using fallback.`);
    }
    return i18nInterpolate(fallback==null?key:String(fallback),params);
  }
  return i18nInterpolate(i18nTemplate(value,params),params);
}

function t(key,params){ return i18nResolve(key,null,params); }
function tf(key,fallback,params){ return i18nResolve(key,fallback,params); }
function ts(value,params){
  const normalized=String(value==null?'':value).trim();
  if(!normalized||normalized==='—') return normalized||'—';
  return tf(`st.${normalized}`,normalized,params);
}

function i18nDateOnly(value){
  if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return null;
  const [year,month,day]=value.split('-').map(Number);
  return new Date(year,month-1,day,12,0,0,0);
}

function i18nDateValue(value,dateOnly=false){
  if(value instanceof Date) return value;
  if(dateOnly){ const parsed=i18nDateOnly(value); if(parsed) return parsed; }
  const result=new Date(value);
  return Number.isNaN(result.getTime())?null:result;
}

function formatDate(value,options={}){
  const date=i18nDateValue(value,true);
  if(!date) return '—';
  const config=Object.keys(options).length?options:{dateStyle:'medium'};
  return new Intl.DateTimeFormat(getLocale(),config).format(date);
}
function formatDateTime(value,options={}){
  const date=i18nDateValue(value,false);
  if(!date) return '—';
  const config=Object.keys(options).length?options:{dateStyle:'medium',timeStyle:'short'};
  return new Intl.DateTimeFormat(getLocale(),config).format(date);
}
function formatNumber(value,options={}){
  const number=Number(value);
  return Number.isFinite(number)?new Intl.NumberFormat(getLocale(),options).format(number):'—';
}
function formatCurrency(value,currency,options={}){
  const number=Number(value);
  if(!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat(getLocale(),{style:'currency',currency:currency||'SGD',...options}).format(number);
}

function i18nParams(node){
  try{return node.dataset.i18nParams?JSON.parse(node.dataset.i18nParams):undefined;}
  catch{return undefined;}
}
function i18nOptions(node){
  try{return node.dataset.i18nOptions?JSON.parse(node.dataset.i18nOptions):{};}
  catch{return {};}
}

function applyStaticI18n(root=document){
  const scope=root&&root.querySelectorAll?root:document;
  scope.querySelectorAll('[data-i18n]').forEach(node=>{node.textContent=t(node.dataset.i18n,i18nParams(node));});
  scope.querySelectorAll('[data-i18n-ph]').forEach(node=>node.setAttribute('placeholder',t(node.dataset.i18nPh,i18nParams(node))));
  scope.querySelectorAll('[data-i18n-tip]').forEach(node=>node.setAttribute('data-tip',t(node.dataset.i18nTip,i18nParams(node))));
  scope.querySelectorAll('[data-i18n-title]').forEach(node=>node.setAttribute('title',t(node.dataset.i18nTitle,i18nParams(node))));
  scope.querySelectorAll('[data-i18n-aria-label]').forEach(node=>node.setAttribute('aria-label',t(node.dataset.i18nAriaLabel,i18nParams(node))));
  scope.querySelectorAll('[data-i18n-format]').forEach(node=>{
    const value=node.dataset.i18nValue;
    const options=i18nOptions(node);
    if(node.dataset.i18nFormat==='date') node.textContent=formatDate(value,options);
    else if(node.dataset.i18nFormat==='datetime') node.textContent=formatDateTime(value,options);
    else if(node.dataset.i18nFormat==='number') node.textContent=formatNumber(value,options);
    else if(node.dataset.i18nFormat==='currency') node.textContent=formatCurrency(value,node.dataset.i18nCurrency,options);
  });
}

function i18nFlatStrings(pack){
  const result=new Map();
  for(const [key,value] of Object.entries(pack||{})){
    if(typeof value==='string'&&value.trim()) result.set(value,key);
  }
  return result;
}

function i18nLegacyReplacement(value,reverse,to){
  if(I18N_BUSINESS_EXACT.has(value)||I18N_BUSINESS_PATTERNS.some(pattern=>pattern.test(value))) return value;
  const exact=reverse.get(value);
  if(exact){
    const replacement=i18nTemplate(to[exact]??I18N.en[exact],{});
    return typeof replacement==='string'?replacement:value;
  }
  const pieces=value.split(/(\s+[·—]\s+)/);
  let changed=false;
  const translated=pieces.map(piece=>{
    if(/^(\s+[·—]\s+)$/.test(piece)) return piece;
    const key=reverse.get(piece);
    if(key){
      const replacement=i18nTemplate(to[key]??I18N.en[key],{});
      if(typeof replacement==='string'&&replacement!==piece){changed=true;return replacement;}
    }
    const counted=piece.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    const unitKey=counted&&reverse.get(counted[2]);
    if(unitKey){
      const replacement=i18nTemplate(to[unitKey]??I18N.en[unitKey],{count:Number(counted[1])});
      if(typeof replacement==='string'&&replacement!==counted[2]){changed=true;return `${counted[1]} ${replacement}`;}
    }
    return piece;
  }).join('');
  return changed?translated:value;
}

function translateLegacyDom(root,fromCode,toCode){
  if(fromCode===toCode&&toCode==='en') return;
  const sourceCode=fromCode===toCode?'en':fromCode;
  const from=I18N[sourceCode]||I18N.en;
  const to=I18N[toCode]||I18N.en;
  const reverse=i18nFlatStrings(from);
  if(!reverse.size) return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const parent=node.parentElement;
    if(!parent||parent.closest('script,style,textarea,[data-i18n],[data-business-text]')) return NodeFilter.FILTER_REJECT;
    const value=node.nodeValue.trim();
    return i18nLegacyReplacement(value,reverse,to)!==value?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const textNodes=[];
  while(walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(node=>{
    const leading=node.nodeValue.match(/^\s*/)?.[0]||'';
    const trailing=node.nodeValue.match(/\s*$/)?.[0]||'';
    const replacement=i18nLegacyReplacement(node.nodeValue.trim(),reverse,to);
    if(replacement!==node.nodeValue.trim()) node.nodeValue=leading+replacement+trailing;
  });
  root.querySelectorAll('[aria-label],[title],[placeholder],[data-tip]').forEach(node=>{
    for(const attr of ['aria-label','title','placeholder','data-tip']){
      const value=node.getAttribute(attr);
      const replacement=value&&i18nLegacyReplacement(value.trim(),reverse,to);
      if(replacement&&replacement!==value.trim()) node.setAttribute(attr,replacement);
    }
  });
}

function applyI18n(root=document){
  const scope=root&&root.querySelectorAll?root:document;
  document.documentElement.setAttribute('lang',getLocale());
  translateLegacyDom(scope,LAST_APPLIED_LANG,LANG);
  applyStaticI18n(scope);
  LAST_APPLIED_LANG=LANG;
  const lm=document.querySelector('#langMenu');
  if(lm&&typeof buildLangMenu==='function'){lm.innerHTML=buildLangMenu();wireLangMenu();}
  const lb=document.querySelector('#langBtn');
  if(lb){lb.setAttribute('data-tip',t('tip.language'));lb.setAttribute('aria-label',t('tip.language'));}
  const av=document.querySelector('#avatarBtn');
  if(av&&typeof DB!=='undefined') av.setAttribute('data-tip',`${t('tip.account')} · ${DB.user.name}`);
}

function i18nFlattenRegistered(value,path,result){
  if(typeof value==='string'){
    if(i18nHasMarkup(value)) throw new Error(`Unsafe markup in registered i18n value: ${path}`);
    result[path]=value;
    return;
  }
  if(!value||typeof value!=='object'||Array.isArray(value)) return;
  for(const [key,child] of Object.entries(value)) i18nFlattenRegistered(child,`${path}.${key}`,result);
}

function registerI18nPack(namespace,packs){
  if(!namespace||!packs) return;
  for(const code of I18N_LANGS.map(item=>item.code)){
    const source=packs[code];
    if(source==null) continue;
    const additions={};
    if(typeof source==='string') i18nFlattenRegistered(source,`${namespace}.value`,additions);
    else if(typeof source==='object'&&!Array.isArray(source)){
      for(const [key,value] of Object.entries(source)) i18nFlattenRegistered(value,`${namespace}.${key}`,additions);
    }
    I18N_REGISTERED[code]=Object.freeze(Object.assign({},I18N_REGISTERED[code],additions));
    if(I18N[code]) I18N[code]=Object.freeze(Object.assign({},I18N[code],additions));
  }
}

function i18nLegacy(packs){
  const canonical=JSON.stringify(packs&&packs.en||{});
  let hash=5381;
  for(let index=0;index<canonical.length;index+=1) hash=((hash<<5)+hash)^canonical.charCodeAt(index);
  registerI18nPack(`legacy.${(hash>>>0).toString(36)}`,packs);
  const activeCode=typeof window.getLang==='function'?window.getLang():LANG;
  return packs[activeCode]||packs.en||{};
}

async function setLang(code,options={}){
  if(!I18N_CODES.has(code)) return false;
  if(code!==LANG){
    try{await loadLocale(code);}
    catch(error){
      console.error(`Failed to load locale ${code}`,error);
      if(!options.silent&&typeof toast==='function') toast(tf('lang.loadFailed','Language could not be loaded. Try again.'),'warn');
      return false;
    }
  }
  const previous=LANG;
  LANG=code;
  if(options.persist!==false){try{localStorage.setItem('aria-lang',code);}catch{}}
  applyI18n(document);
  if(previous!==code){
    window.dispatchEvent(new CustomEvent('erp:localechange',{detail:{language:code,locale:getLocale(),previousLanguage:previous}}));
  }
  return true;
}

function initI18n(){
  if(I18N_INITIALIZED) return Promise.resolve(true);
  if(I18N_INIT_PROMISE) return I18N_INIT_PROMISE;
  const desired=i18nStoredLanguage();
  I18N_INIT_PROMISE=(desired==='en'?Promise.resolve(true):setLang(desired,{persist:false,silent:true}))
    .then(active=>{
      I18N_INITIALIZED=true;
      if(!active&&desired!=='en'){
        const retry=()=>{window.removeEventListener('online',retry);setLang(desired,{persist:false,silent:true});};
        window.addEventListener('online',retry,{once:true});
      }
      document.documentElement.setAttribute('lang',getLocale());
      return active;
    });
  return I18N_INIT_PROMISE;
}

function translateApiError(error,fallback){
  const payload=error&&error.error?error.error:error;
  if(!payload) return fallback||t('error.unknown');
  return tf(`error.${payload.code}`,payload.message||fallback||t('error.unknown'),payload.params);
}

function buildLangMenu(){
  return `<div class="menu-section"><div class="menu-head">${esc(t('tip.language'))}</div>`+
    I18N_LANGS.map(item=>`<button class="menu-item lang-item" data-lang="${item.code}"${item.code===LANG?' aria-current="true"':''}>
      <span class="lang-name"><b>${esc(item.native)}</b>${item.label!==item.native?`<small>${esc(item.label)}</small>`:''}</span>
      <span class="meta">${item.code===LANG?ic('check'):''}</span>
    </button>`).join('')+`</div>`;
}

function wireLangMenu(){
  const menu=document.querySelector('#langMenu');
  if(!menu) return;
  menu.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',async event=>{
    event.stopPropagation();
    const code=button.dataset.lang;
    button.setAttribute('disabled','');
    const changed=await setLang(code);
    if(changed){
      if(typeof closeAllPops==='function') closeAllPops();
      if(I18N_RETURN_FOCUS&&I18N_RETURN_FOCUS.isConnected&&typeof I18N_RETURN_FOCUS.focus==='function'){
        try{I18N_RETURN_FOCUS.focus({preventScroll:true});}catch{}
      }
      if(typeof toast==='function') toast(`${t('lang.changed')} — ${(I18N_LANGS.find(item=>item.code===code)||{}).native}`,'ok');
    }else button.removeAttribute('disabled');
  }));
}

if(typeof document.addEventListener==='function'){
  document.addEventListener('focusin',event=>{
    const target=event.target;
    if(target&&typeof target.closest==='function'&&!target.closest('#langMenu,#langBtn')) I18N_RETURN_FOCUS=target;
  });
}

window.I18N=I18N;
window.I18N_LANGS=I18N_LANGS;
window.getLang=getLang;
window.getLocale=getLocale;
window.loadLocale=loadLocale;
window.initI18n=initI18n;
window.t=t;
window.tf=tf;
window.ts=ts;
window.setLang=setLang;
window.applyI18n=applyI18n;
window.applyStaticI18n=applyStaticI18n;
window.formatDate=formatDate;
window.formatDateTime=formatDateTime;
window.formatNumber=formatNumber;
window.formatCurrency=formatCurrency;
window.translateApiError=translateApiError;
window.registerI18nPack=registerI18nPack;
window.i18nLegacy=i18nLegacy;
window.buildLangMenu=buildLangMenu;
window.wireLangMenu=wireLangMenu;
