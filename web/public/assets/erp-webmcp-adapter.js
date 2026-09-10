/*
 * ERP-System WebMCP page adapter (TASK-229).
 *
 * This is deliberately a thin, session-bound browser seam. The normal ERP
 * data adapter remains the only business-operation entry point; the page
 * adapter never stores provider credentials and never accepts tenant scope
 * from a tool input. Native WebMCP is feature-detected at runtime. When it is
 * unavailable, this file is inert and the ordinary UI continues unchanged.
 */
(function installErpWebMcp(global){
  'use strict';

  var ACTIONS=[
    'receipt.search','receipt.get','receipt_pack.prepare',
    'receipt_pack.create','receipt_pack.get','receipt_pack.export',
  ];
  var READ_PERMISSIONS=[
    'expenses.company_receipts.read_company',
    'expenses.company_receipts.read_own',
  ];
  var LOCALES=['en','ms','zh','ja','vi'];
  var INPUT_SCHEMAS={
    'receipt.search':{
      type:'object',additionalProperties:false,properties:{
        limit:{type:'integer',minimum:1,maximum:100},
        afterId:{type:'integer',minimum:1},search:{type:'string',maxLength:200},
        dateFrom:{type:'string',format:'date'},dateTo:{type:'string',format:'date'},
      },
    },
    'receipt.get':{
      type:'object',additionalProperties:false,required:['receiptId'],properties:{
        receiptId:{type:'integer',minimum:1},
      },
    },
    'receipt_pack.prepare':{
      type:'object',additionalProperties:false,required:['dateFrom','dateTo'],properties:{
        search:{type:'string',maxLength:200},dateFrom:{type:'string',format:'date'},
        dateTo:{type:'string',format:'date'},locale:{type:'string',enum:LOCALES},
      },
    },
    'receipt_pack.create':{
      type:'object',additionalProperties:false,required:['packKey','dateFrom','dateTo'],properties:{
        packKey:{type:'string',minLength:8,maxLength:128},search:{type:'string',maxLength:200},
        dateFrom:{type:'string',format:'date'},dateTo:{type:'string',format:'date'},
        locale:{type:'string',enum:LOCALES},executionIntentId:{type:'integer',minimum:1},
        executionIntentKey:{type:'string',minLength:16,maxLength:200},
        selectionDigest:{type:'string',pattern:'^[a-f0-9]{64}$'},
        payloadDigest:{type:'string',pattern:'^[a-f0-9]{64}$'},
      },
    },
    'receipt_pack.get':{
      type:'object',additionalProperties:false,required:['packId'],properties:{
        packId:{type:'integer',minimum:1},
      },
    },
    'receipt_pack.export':{
      type:'object',additionalProperties:false,required:['packId','action'],properties:{
        packId:{type:'integer',minimum:1},action:{type:'string',enum:['view','download','print']},
      },
    },
  };
  var state={
    generation:0,
    registration:null,
    supported:false,
    reason:'not_initialized',
    lastSyncReason:null,
    lastError:null,
  };

  function modelContext(){
    var doc=global.document;
    var candidate=doc&&doc.modelContext;
    return candidate&&typeof candidate.registerTool==='function'?candidate:null;
  }

  function makeError(code,message){
    var error=new Error(message);
    error.code=code;
    return error;
  }

  function bodyIsLocked(){
    var body=global.document&&global.document.body;
    return Boolean(body&&body.classList&&body.classList.contains('auth-locked'));
  }

  function permissionKeys(user){
    var values=user&&(user.permissionKeys||user.permissions);
    return Array.isArray(values)?values.map(String):[];
  }

  function currentContext(){
    var db=global.DB||{};
    var user=db.user||null;
    var system=db.erpSystem||{};
    var scope=system.scope||{};
    var permissions=permissionKeys(user).sort();
    var modules=Array.isArray(system.modules)?system.modules:[];
    var expenseModule=modules.find(function(row){
      return String(row&&((row.moduleKey!=null&&row.moduleKey)||(row.module_key!=null&&row.module_key)||''))==='expenses_tax';
    });
    var moduleEnabled=Boolean(expenseModule&&expenseModule.enabled===true);
    var identity=user&&(user.userId||user.user_id||user.id||user.email||user.name)||null;
    var route=String(global.__ERP_CURRENT_ROUTE__||'');
    var authenticated=Boolean(user&&scope.masterFn&&scope.companyFn&&!bodyIsLocked());
    var canRead=permissions.some(function(key){return READ_PERMISSIONS.includes(key);});
    var context={
      route:route,masterFn:String(scope.masterFn||''),companyFn:String(scope.companyFn||''),
      identity:String(identity||''),permissions:permissions,moduleEnabled:moduleEnabled,
      authenticated:authenticated,canRead:canRead,
      onRoute:route==='company-receipts',
    };
    context.fingerprint=JSON.stringify({route:context.route,masterFn:context.masterFn,
      companyFn:context.companyFn,identity:context.identity,permissions:context.permissions,
      moduleEnabled:context.moduleEnabled});
    return context;
  }

  function invalidate(reason){
    var registration=state.registration;
    if(registration&&registration.controller){
      try{registration.controller.abort();}catch{}
    }
    state.generation+=1;
    state.registration=null;
    state.reason=reason||'invalidated';
    state.lastError=null;
    return state.generation;
  }

  function assertContext(generation){
    if(generation!==state.generation){
      throw makeError('webmcp_context_stale','This WebMCP tool registration is no longer current.');
    }
    var current=currentContext();
    if(!current.authenticated){
      invalidate('logout-or-unauthenticated');
      throw makeError('not_authenticated','An authenticated ERP session is required.');
    }
    if(!current.onRoute){
      invalidate('navigation');
      throw makeError('webmcp_route_unavailable','The Company Receipts route is no longer active.');
    }
    if(!current.moduleEnabled||!current.canRead){
      invalidate('capability-change');
      throw makeError('permission_denied','Current Company Receipt permission is required.');
    }
    var registration=state.registration;
    if(!registration||registration.fingerprint!==current.fingerprint){
      invalidate('scope-or-capability-change');
      throw makeError('webmcp_context_stale','The actor, Company or capability context changed.');
    }
    return current;
  }

  function ensureInput(input){
    if(!input||typeof input!=='object'||Array.isArray(input)){
      throw makeError('agent_action_input_invalid','WebMCP input must be a JSON object.');
    }
    return input;
  }

  function adapterOrFail(){
    var adapter=global.ErpSystemData;
    if(!adapter) throw makeError('webmcp_adapter_unavailable','The ERP data adapter is unavailable.');
    return adapter;
  }

  function normalizeExportResponse(response){
    var data=response&&response.data;
    var content=data&&data.content;
    if(content==null) return response;
    var bytes;
    if(typeof global.ArrayBuffer!=='undefined'&&global.ArrayBuffer.isView&&global.ArrayBuffer.isView(content)){
      bytes=new global.Uint8Array(content.buffer,content.byteOffset,content.byteLength);
    }else if(typeof global.ArrayBuffer!=='undefined'&&content instanceof global.ArrayBuffer){
      bytes=new global.Uint8Array(content);
    }else if(Array.isArray(content)){
      bytes=global.Uint8Array.from(content);
    }else if(typeof content==='string'){
      return response;
    }else{
      throw makeError('webmcp_export_unserializable','Receipt Pack export returned unsupported binary content.');
    }
    var binary='';
    for(var offset=0;offset<bytes.byteLength;offset+=0x8000){
      binary+=String.fromCharCode.apply(null,Array.from(bytes.subarray(offset,offset+0x8000)));
    }
    if(typeof global.btoa!=='function'){
      throw makeError('webmcp_export_unserializable','Receipt Pack export cannot be encoded in this browser.');
    }
    return Object.assign({},response,{data:Object.assign({},data,{
      content:global.btoa(binary),contentEncoding:'base64',byteLength:bytes.byteLength,
    })});
  }

  async function dispatch(action,input,signal,generation){
    ensureInput(input||{});
    assertContext(generation);
    if(signal&&signal.aborted) throw makeError('webmcp_execution_cancelled','The tool execution was cancelled.');
    var adapter=adapterOrFail();
    var response;
    if(action==='receipt.search'){
      if(typeof adapter.companyReceipts!=='function') throw makeError('webmcp_action_unavailable','Receipt search is unavailable.');
      response=await adapter.companyReceipts(input);
    }else if(action==='receipt.get'){
      if(typeof adapter.companyReceipt!=='function') throw makeError('webmcp_action_unavailable','Receipt detail is unavailable.');
      response=await adapter.companyReceipt(input.receiptId);
    }else if(action==='receipt_pack.prepare'){
      if(typeof adapter.companyReceiptPackPrepare!=='function') throw makeError('webmcp_action_unavailable','Receipt Pack preparation is unavailable.');
      response=await adapter.companyReceiptPackPrepare(input);
    }else if(action==='receipt_pack.create'){
      var confirmation=global.ErpWebMcpConfirmation;
      if(!confirmation||typeof confirmation.execute!=='function'){
        throw makeError('agent_action_confirmation_required','Visible human confirmation is required before Receipt Pack creation.');
      }
      response=await confirmation.execute(input,{signal:signal,assertCurrent:function(){return assertContext(generation);}});
    }else if(action==='receipt_pack.get'){
      if(typeof adapter.companyReceiptPackGet!=='function') throw makeError('webmcp_action_unavailable','Receipt Pack detail is unavailable.');
      response=await adapter.companyReceiptPackGet(input.packId);
    }else if(action==='receipt_pack.export'){
      if(typeof adapter.companyReceiptPackPdf!=='function') throw makeError('webmcp_action_unavailable','Receipt Pack export is unavailable.');
      response=await adapter.companyReceiptPackPdf(input.packId,input.action);
      response=normalizeExportResponse(response);
    }else{
      throw makeError('agent_action_unknown','Unknown WebMCP action.');
    }
    assertContext(generation);
    if(signal&&signal.aborted) throw makeError('webmcp_execution_cancelled','The tool execution was cancelled.');
    return response;
  }

  function annotations(action){
    if(action==='receipt_pack.create'){
      return {readOnlyHint:false,consequentialHint:true,untrustedContentHint:false};
    }
    return {readOnlyHint:true,consequentialHint:false,untrustedContentHint:true};
  }

  function toolDefinition(action,generation){
    var definitions={
      'receipt.search':{
        title:'Search Company Receipts',
        description:'Search authorized Company Receipts in the active Company.',
      },
      'receipt.get':{
        title:'Read Company Receipt',
        description:'Read one authorized Company Receipt in the active Company.',
      },
      'receipt_pack.prepare':{
        title:'Prepare Company Receipt Pack',
        description:'Prepare a read-only, bounded Receipt Pack selection for visible review.',
      },
      'receipt_pack.create':{
        title:'Create Company Receipt Pack',
        description:'Create or replay an immutable Receipt Pack only after visible human confirmation.',
      },
      'receipt_pack.get':{
        title:'Read Company Receipt Pack',
        description:'Read an authorized immutable Receipt Pack in the active Company.',
      },
      'receipt_pack.export':{
        title:'Export Company Receipt Pack',
        description:'Render an authorized immutable Receipt Pack PDF for view, download or print.',
      },
    }[action];
    return {
      name:action,title:definitions.title,description:definitions.description,
      inputSchema:INPUT_SCHEMAS[action],annotations:annotations(action),
      execute:function(input,options){
        return dispatch(action,input,options&&options.signal,generation);
      },
    };
  }

  async function sync(reason){
    invalidate(reason||'sync');
    state.lastSyncReason=reason||'sync';
    var context=modelContext();
    state.supported=Boolean(context);
    if(!context){
      state.reason='unsupported-browser';
      return {supported:false,registered:[]};
    }
    var live=currentContext();
    if(!live.authenticated||!live.onRoute||!live.moduleEnabled||!live.canRead){
      state.reason='current-context-not-authorized';
      return {supported:true,registered:[]};
    }
    var controller=new global.AbortController();
    var registration={controller:controller,generation:state.generation,
      fingerprint:live.fingerprint,names:[],modelContext:context};
    state.registration=registration;
    state.reason='registering';
    try{
      for(var i=0;i<ACTIONS.length;i+=1){
        if(registration.generation!==state.generation) return {supported:true,registered:[]};
        await context.registerTool(toolDefinition(ACTIONS[i],registration.generation),{
          signal:controller.signal,
        });
        if(registration.generation!==state.generation) return {supported:true,registered:[]};
        registration.names.push(ACTIONS[i]);
      }
      state.reason='registered';
      return {supported:true,registered:registration.names.slice()};
    }catch(error){
      if(registration.generation===state.generation){
        state.lastError=error;
        invalidate('registration-failed');
      }
      return {supported:true,registered:[]};
    }
  }

  function getState(){
    var registration=state.registration;
    return {
      generation:state.generation,supported:state.supported,reason:state.reason,
      lastSyncReason:state.lastSyncReason,lastError:state.lastError,
      registered:registration?registration.names.slice():[],
    };
  }

  global.ErpWebMcp={
    actions:ACTIONS.slice(),
    hasNativeSupport:function(){return Boolean(modelContext());},
    invalidate:invalidate,
    sync:sync,
    getState:getState,
  };
})(typeof window==='object'?window:globalThis);
