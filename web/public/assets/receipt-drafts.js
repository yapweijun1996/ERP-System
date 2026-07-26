/* Offline-first receipt capture for TASK-118.
   Draft bytes stay in this browser's IndexedDB until an explicit sync or logout. */
(function receiptDraftStore(){
  'use strict';
  var DB_NAME='aria-receipt-drafts-v1';
  var STORE='drafts';
  var MAX_BYTES=20*1024*1024;

  function request(request){
    return new Promise(function(resolve,reject){
      request.onsuccess=function(){resolve(request.result);};
      request.onerror=function(){reject(request.error||new Error('Receipt draft storage failed.'));};
    });
  }
  function open(){
    return new Promise(function(resolve,reject){
      var req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=function(){
        var db=req.result;
        if(!db.objectStoreNames.contains(STORE)){
          var store=db.createObjectStore(STORE,{keyPath:'id'});
          store.createIndex('updatedAt','updatedAt');
        }
      };
      req.onsuccess=function(){resolve(req.result);};
      req.onerror=function(){reject(req.error||new Error('Receipt draft storage is unavailable.'));};
    });
  }
  async function transaction(mode,work){
    var db=await open();
    try{
      var tx=db.transaction(STORE,mode);
      var result=await work(tx.objectStore(STORE));
      await new Promise(function(resolve,reject){
        tx.oncomplete=resolve;
        tx.onerror=function(){reject(tx.error);};
        tx.onabort=function(){reject(tx.error||new Error('Receipt draft transaction was aborted.'));};
      });
      return result;
    }finally{db.close();}
  }
  function id(){
    return (crypto.randomUUID?crypto.randomUUID():
      Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  }
  function extension(name){
    var clean=String(name||'').toLowerCase();
    var dot=clean.lastIndexOf('.');
    return dot<0?'':clean.slice(dot);
  }
  function normalizeType(file){
    var type=String(file.type||'').toLowerCase();
    var ext=extension(file.name);
    if(!type&&['.jpg','.jpeg'].includes(ext)) type='image/jpeg';
    if(!type&&ext==='.png') type='image/png';
    if(!type&&ext==='.heic') type='image/heic';
    if(!type&&ext==='.heif') type='image/heif';
    if(!type&&ext==='.pdf') type='application/pdf';
    return type;
  }
  function validateSelection(file){
    if(!file||file.size<=0) throw new Error('Choose a non-empty receipt file.');
    if(file.size>MAX_BYTES) throw new Error('Receipt files may not exceed 20 MB.');
    var type=normalizeType(file);
    var ext=extension(file.name);
    var allowed={
      'image/jpeg':['.jpg','.jpeg'],
      'image/png':['.png'],
      'image/heic':['.heic'],
      'image/heif':['.heif'],
      'application/pdf':['.pdf'],
    };
    if(!allowed[type]||!allowed[type].includes(ext)){
      throw new Error('Choose a JPEG, PNG, HEIC or PDF file with a matching extension.');
    }
    return type;
  }
  async function putFile(file,options){
    var type=validateSelection(file);
    var now=new Date().toISOString();
    var draft={
      id:'receipt_'+id().replace(/[^a-zA-Z0-9_-]/g,'_'),
      name:String(file.name).slice(0,255),
      type:type,
      size:file.size,
      blob:file.slice(0,file.size,type),
      createdAt:now,
      updatedAt:now,
      source:file.__captureSource||'file',
      autoSubmitAuthorized:Boolean(options&&options.autoSubmitAuthorized),
      transform:{rotation:0,crop:'original',quality:0.82},
      status:'unsynced',
    };
    await transaction('readwrite',function(store){return request(store.put(draft));});
    return draft;
  }
  async function list(){
    var rows=await transaction('readonly',function(store){return request(store.getAll());});
    return rows.sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));});
  }
  function get(draftId){
    return transaction('readonly',function(store){return request(store.get(draftId));});
  }
  function remove(draftId){
    return transaction('readwrite',function(store){return request(store.delete(draftId));});
  }
  function clear(){
    return transaction('readwrite',function(store){return request(store.clear());});
  }
  async function count(){return (await list()).length;}
  function canvasBlob(canvas,type,quality){
    return new Promise(function(resolve,reject){
      canvas.toBlob(function(blob){
        if(blob) resolve(blob); else reject(new Error('The edited image could not be encoded.'));
      },type,quality);
    });
  }
  async function transformImage(draftId,options){
    var draft=await get(draftId);
    if(!draft) throw new Error('Receipt draft is unavailable.');
    if(!['image/jpeg','image/png'].includes(draft.type)){
      throw new Error('This browser can edit JPEG and PNG images. HEIC and PDF stay original.');
    }
    var bitmap=await createImageBitmap(draft.blob);
    try{
      var crop=String(options.crop||'original');
      var sourceWidth=bitmap.width,sourceHeight=bitmap.height,sx=0,sy=0,sw=sourceWidth,sh=sourceHeight;
      if(crop==='square'){
        sw=sh=Math.min(sourceWidth,sourceHeight);
        sx=Math.floor((sourceWidth-sw)/2);sy=Math.floor((sourceHeight-sh)/2);
      }else if(crop==='receipt'){
        var target=3/4;
        if(sourceWidth/sourceHeight>target){
          sw=Math.floor(sourceHeight*target);sx=Math.floor((sourceWidth-sw)/2);
        }else{
          sh=Math.floor(sourceWidth/target);sy=Math.floor((sourceHeight-sh)/2);
        }
      }
      var rotation=((Number(options.rotation)||0)%360+360)%360;
      var scale=Math.min(1,2000/Math.max(sw,sh));
      var outputWidth=Math.max(1,Math.round(sw*scale));
      var outputHeight=Math.max(1,Math.round(sh*scale));
      var sideways=rotation===90||rotation===270;
      var canvas=document.createElement('canvas');
      canvas.width=sideways?outputHeight:outputWidth;
      canvas.height=sideways?outputWidth:outputHeight;
      var ctx=canvas.getContext('2d',{alpha:draft.type==='image/png'});
      if(!ctx) throw new Error('Image editing is unavailable in this browser.');
      ctx.translate(canvas.width/2,canvas.height/2);
      ctx.rotate(rotation*Math.PI/180);
      ctx.drawImage(bitmap,sx,sy,sw,sh,-outputWidth/2,-outputHeight/2,outputWidth,outputHeight);
      var quality=Math.min(0.95,Math.max(0.45,Number(options.quality)||0.82));
      var blob=await canvasBlob(canvas,draft.type,quality);
      if(blob.size>MAX_BYTES) throw new Error('The edited receipt still exceeds 20 MB.');
      draft.blob=blob;
      draft.size=blob.size;
      draft.updatedAt=new Date().toISOString();
      draft.transform={rotation:rotation,crop:crop,quality:quality};
      await transaction('readwrite',function(store){return request(store.put(draft));});
      return draft;
    }finally{bitmap.close();}
  }
  async function confirmAndClearBeforeLogout(){
    var total=await count().catch(function(){return 0;});
    if(!total) return true;

    var messages={
      en:'You have '+total+' unsynchronised receipt draft(s) on this device. Signing out will permanently clear them. Continue?',
      ms:'Anda mempunyai '+total+' draf resit belum disegerakkan pada peranti ini. Log keluar akan memadamkannya secara kekal. Teruskan?',
      zh:'此设备有 '+total+' 份尚未同步的收据草稿。登出会永久清除这些草稿。是否继续？',
      ja:'この端末に未同期の領収書下書きが '+total+' 件あります。サインアウトすると完全に削除されます。続行しますか？',
      vi:'Thiết bị này có '+total+' bản nháp biên lai chưa đồng bộ. Đăng xuất sẽ xóa vĩnh viễn các bản nháp này. Tiếp tục?',
    };
    if(!confirm(i18nLegacy(messages))) return false;
    await clear();
    return true;
  }
  window.ErpReceiptDrafts={
    MAX_BYTES:MAX_BYTES,
    putFile:putFile,
    list:list,
    get:get,
    remove:remove,
    clear:clear,
    count:count,
    transformImage:transformImage,
    confirmAndClearBeforeLogout:confirmAndClearBeforeLogout,
  };
})();
