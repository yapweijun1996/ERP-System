/* ============================================================
   ARIA ERP — Purchasing module: hub, shared shell, list factory, reports
   Provides:  PUR_SECTIONS, purNav(), purPage(), makePurList()
   Screens:   purchasing-home, purchasing-reports, report-pur-supplier,
              report-pur-buyer, report-pur-price-var, report-pur-vendor,
              report-pur-generic
   Mirrors the Sales module so the two read-as-one product.
   ============================================================ */

/* ---- module map (drives the sub-nav strip + the hub directory) ---- */
const PUR_SECTIONS = [
  { group:'Overview', items:[
    { route:'purchasing-home', label:'Dashboard', icon:'grid', desc:'Spend & procure-to-pay status' },
  ]},
  { group:'Master Data', items:[
    { route:'suppliers', label:'Suppliers', icon:'truck', desc:'Vendor master & terms' },
  ]},
  { group:'Transactions', items:[
    { route:'purchase-requisitions', label:'Requisitions', icon:'list',    desc:'Internal purchase requests' },
    { route:'rfqs',                  label:'RFQs',         icon:'comment', desc:'Requests for quotation' },
    { route:'supplier-quotations',   label:'Quotations',   icon:'receipt', desc:'Supplier offers & comparison' },
    { route:'purchase-orders',       label:'Purchase Orders', icon:'cart', desc:'Confirmed supplier orders' },
    { route:'goods-receipts',        label:'Goods Receipts', icon:'receive', desc:'Receiving & putaway' },
    { route:'supplier-invoices',     label:'Supplier Invoices', icon:'receipt', desc:'AP invoices & 3-way match' },
    { route:'purchase-returns',      label:'Purchase Returns', icon:'refresh', desc:'Returns to supplier' },
    { route:'supplier-credit-notes', label:'Credit Notes', icon:'coins',   desc:'Supplier credit adjustments' },
    { route:'supplier-debit-notes',  label:'Debit Notes',  icon:'coins',   desc:'Claims against suppliers' },
  ]},
  { group:'Controls', items:[
    { route:'po-approvals',     label:'Approvals',         icon:'flow',   desc:'POs awaiting sign-off' },
    { route:'supplier-price-lists', label:'Price Lists',   icon:'tag',    desc:'Supplier pricing & contracts' },
    { route:'landed-cost',      label:'Landed Cost',       icon:'truck',  desc:'Freight, duty & allocation' },
    { route:'vendor-performance', label:'Vendor Performance', icon:'shield', desc:'Supplier scorecards' },
  ]},
  { group:'Reports', items:[
    { route:'purchasing-reports', label:'Reports', icon:'chart', desc:'Operational & management reports' },
  ]},
];
const PUR_FLAT = PUR_SECTIONS.flatMap(s=>s.items);
/* alias map: a deep-doc route highlights its list section in the sub-nav */
const PUR_ALIAS = { 'purchase-request':'purchase-requisitions', 'goods-receipt':'goods-receipts',
  'supplier-invoice':'supplier-invoices', 'po-approval':'po-approvals', 'new-purchase-order':'purchase-orders',
  'pur-txn-view':'purchase-orders' };

/* ---- status tone maps → TONES.* (defined in data-core.js): PR_TONE, RFQ_TONE,
   SQ_TONE, GRN_TONE, SINV_TONE, PRET_TONE, SCN_TONE, SDN_TONE, SPL_TONE ---- */

/* ---- sub-nav strip (shown on every Purchasing screen we build) ----
   Thin delegate to the generic moduleNav() (app.js) -- kept as a named function
   since several purchasing detail screens call purNav(active) directly rather
   than going through modulePage() (TASK-045: PUR_SECTIONS/PUR_ALIAS stay here as
   the single real source, referenced by MODULE_DEFS.purchasing in app.js). */
function purNav(active){
  return moduleNav('purchasing', active);
}

/* ---- standard Purchasing page shell (crumbs + sub-nav + title) ---- */
function purPage(o){
  const crumb = o.crumb || [DB.company.name,{label:'Purchasing',route:'purchasing-home'},{cur:o.title}];
  return `<div class="content full"><section class="master" data-screen-label="Purchasing · ${esc(o.title)}">
    <div class="scrollarea">
      <div class="pagehead">
        ${crumbs(crumb)}
        ${purNav(o.active||o.route)}
        <div class="h1row" style="margin-top:13px"><h1>${esc(o.title)}</h1>${o.count!=null?`<span class="countchip">${o.count}</span>`:''}<div class="grow"></div>${o.action||''}</div>
        ${o.sub?`<div class="h1sub">${o.sub}</div>`:''}
      </div>
      ${o.body||''}
    </div>
  </section></div>`;
}

/* ---- shared cells ---- */
function suppCell(name, code){
  const p=String(name).trim().split(/\s+/); const ini=(((p[0]||'')[0]||'')+((p[1]||'')[0]||'')).toUpperCase();
  return `<div class="partnercell"><span class="pmini">${esc(ini)}</span><span class="cellsub"><b>${esc(name)}</b><small>${esc(code||'')}</small></span></div>`;
}

/* Canonical procure-to-pay read model. The screens consume the same bounded
   resource pages in Demo and API modes; joins below are presentational only.
   Creation, receiving, stock movements and AP posting stay in shared domain
   commands and server transactions. */
function purchasingNumber(value){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:0;
}

async function prepareCanonicalPurchasingData(){
  const adapter=window.ErpSystemData;
  if(adapter&&adapter.mode==='fallback'){
    if(
      Array.isArray(DB.suppliers)
      &&Array.isArray(DB.purchaseOrders)
      &&Array.isArray(DB.goodsReceipts)
      &&Array.isArray(DB.supplierInvoices)
      &&Array.isArray(DB.purchaseOrderApprovals)
    ) return;
    throw new Error('The offline canonical purchasing snapshot is unavailable.');
  }
  const pages=await Promise.all([
    listPage('purchasing/suppliers'),
    listPage('purchasing/purchase-orders'),
    listPage('purchasing/purchase-order-lines'),
    listPage('purchasing/goods-receipts'),
    listPage('purchasing/supplier-invoices'),
    listPage('inventory/products'),
    listPage('inventory/stock-levels'),
    listPage('inventory/warehouses'),
    listPage('purchasing/purchase-requisitions'),
    listPage('purchasing/purchase-requisition-lines'),
    listPage('purchasing/rfqs'),
    listPage('purchasing/rfq-lines'),
    listPage('purchasing/rfq-suppliers'),
    listPage('purchasing/supplier-quotations'),
    listPage('purchasing/supplier-quotation-lines'),
    listPage('purchasing/purchase-returns'),
    listPage('purchasing/purchase-return-lines'),
    listPage('purchasing/supplier-credit-notes'),
    listPage('purchasing/supplier-credit-note-lines'),
    listPage('purchasing/supplier-debit-notes'),
    listPage('inventory/bins'),
    listPage('inventory/lots'),
    listPage('inventory/serials'),
    listPage('inventory/location-balances'),
    listPage('purchasing/landed-costs'),
    listPage('purchasing/landed-cost-lines'),
    listPage('purchasing/purchase-order-approvals'),
  ]);
  const [
    suppliers,purchaseOrders,purchaseOrderLines,goodsReceipts,supplierInvoices,
    products,stockLevels,warehouses,purchaseRequisitions,purchaseRequisitionLines,
    purchaseRfqs,purchaseRfqLines,purchaseRfqSuppliers,supplierQuotations,supplierQuotationLines,
    purchaseReturns,purchaseReturnLines,supplierCreditNotes,supplierCreditNoteLines,supplierDebitNotes,
    inventoryBins,inventoryLots,inventorySerials,locationBalances,landedCosts,landedCostLines,
    purchaseOrderApprovals,
  ]=pages.map(page=>page.data);
  const productById=new Map(products.map(row=>[row.id,row]));
  const supplierById=new Map(suppliers.map(row=>[row.id,row]));
  const orderById=new Map(purchaseOrders.map(row=>[row.id,row]));
  const warehouseById=new Map(warehouses.map(row=>[row.id,row]));
  const lineCountByOrder=new Map();
  const orderLinesByOrder=new Map();
  purchaseOrderLines.forEach(row=>{
    lineCountByOrder.set(row.orderId,(lineCountByOrder.get(row.orderId)||0)+1);
    const rows=orderLinesByOrder.get(row.orderId)||[];
    rows.push(row);
    orderLinesByOrder.set(row.orderId,rows);
  });
  const approvalByOrder=new Map(purchaseOrderApprovals.map(row=>[row.orderId,row]));
  const receiptByOrder=new Map(goodsReceipts.map(row=>[row.orderId,row]));
  const receiptById=new Map(goodsReceipts.map(row=>[row.id,row]));
  const payableBySupplier=new Map();
  supplierInvoices.forEach(row=>{
    if(row.status==='unpaid'){
      payableBySupplier.set(
        row.supplierId,
        (payableBySupplier.get(row.supplierId)||0)+purchasingNumber(row.totalAmount),
      );
    }
  });
  const onHandByProduct=new Map();
  stockLevels.forEach(row=>{
    onHandByProduct.set(
      row.productId,
      (onHandByProduct.get(row.productId)||0)+purchasingNumber(row.qty),
    );
  });

  DB.purchasingWarehouses=warehouses.map(row=>({
    id:row.id,code:row.code,name:row.name,
  }));
  DB.purchasingTracking={bins:inventoryBins,lots:inventoryLots,serials:inventorySerials,balances:locationBalances};
  DB.items=products.map(row=>({
    id:row.id,
    sku:row.sku,
    name:row.name,
    uom:row.uom,
    cost:purchasingNumber(row.averageCost==null?row.standardCost:row.averageCost),
    standardCost:purchasingNumber(row.standardCost),
    onHand:onHandByProduct.get(row.id)||0,
    alloc:0,
    reorder:0,
    roq:0,
    status:(onHandByProduct.get(row.id)||0)>0?'In stock':'No stock',
  }));
  DB.suppliers=suppliers.map(row=>({
    id:row.id,
    code:row.code,
    name:row.name,
    contact:'—',
    phone:'—',
    email:'—',
    country:DB.company.country||'—',
    currency:DB.company.currency,
    terms:'—',
    category:'Unclassified',
    leadTime:null,
    rating:null,
    onTime:null,
    approved:null,
    status:'Active',
    balance:payableBySupplier.get(row.id)||0,
  }));
  const PO_STATUS_UI={
    pending_approval:'Pending Approval',open:'Approved',received:'Completed',
    rejected:'Rejected',cancelled:'Cancelled',
  };
  DB.purchaseOrders=purchaseOrders.map(row=>{
    const supplier=supplierById.get(row.supplierId)||{};
    const lineCount=lineCountByOrder.get(row.id)||0;
    return {
      id:row.id,
      version:row.version,
      no:row.docNo,
      supp:supplier.name||`Supplier #${row.supplierId}`,
      suppCode:supplier.code||'—',
      supplierId:row.supplierId,
      date:dateValue(row.orderDate),
      expect:dateValue(row.orderDate),
      status:PO_STATUS_UI[row.status]||row.status,
      rawStatus:row.status,
      total:purchasingNumber(row.totalAmount),
      net:purchasingNumber(row.netAmount),
      tax:purchasingNumber(row.taxAmount),
      currency:row.currency,
      buyer:DB.user&&DB.user.name||'System',
      items:lineCount,
      recv:row.status==='received'?100:0,
      approval:approvalByOrder.get(row.id)||null,
    };
  });
  DB.goodsReceipts=goodsReceipts.map(row=>{
    const order=orderById.get(row.orderId)||{};
    const supplier=supplierById.get(order.supplierId)||{};
    const location=warehouseById.get(row.warehouseId)||{};
    return {
      id:row.id,
      no:row.docNo,
      date:dateValue(row.receivedDate),
      po:order.docNo||`PO #${row.orderId}`,
      orderId:row.orderId,
      warehouseId:row.warehouseId,
      supplier:supplier.name||'Unknown supplier',
      code:supplier.code||'—',
      warehouse:location.code||`Warehouse #${row.warehouseId}`,
      lines:lineCountByOrder.get(row.orderId)||0,
      recvPct:100,
      qc:'Not modeled',
      status:'Posted',
    };
  });
  DB.supplierInvoices=supplierInvoices.map(row=>{
    const order=orderById.get(row.orderId)||{};
    const supplier=supplierById.get(row.supplierId)||{};
    const receipt=receiptByOrder.get(row.orderId);
    const status={unpaid:'Posted',paid:'Paid',cancelled:'Cancelled'}[row.status]||row.status;
    return {
      id:row.id,
      version:row.version,
      no:row.docNo,
      date:dateValue(row.invoiceDate),
      supplier:supplier.name||'Unknown supplier',
      code:supplier.code||'—',
      po:order.docNo||`PO #${row.orderId}`,
      grn:receipt&&receipt.docNo||null,
      total:purchasingNumber(row.totalAmount),
      net:purchasingNumber(row.netAmount),
      tax:purchasingNumber(row.taxAmount),
      currency:row.currency,
      due:dateValue(row.invoiceDate),
      match:receipt?'Matched':'No GRN',
      status,
      rawStatus:row.status,
      supplierId:row.supplierId,
      orderId:row.orderId,
      projectId:row.projectId,
    };
  });
  DB.purchaseOrderLines=purchaseOrderLines.map(row=>{ const item=productById.get(row.productId)||{}; return {
    id:row.id,orderId:row.orderId,lineNo:row.lineNo,productId:row.productId,
    sku:item.sku||`#${row.productId}`,name:item.name||`Product #${row.productId}`,
    uom:item.uom||'',trackingType:item.trackingType||'none',qty:purchasingNumber(row.qty),
    unitCost:purchasingNumber(row.unitCost),net:purchasingNumber(row.netAmount),
    taxCode:row.taxCode,taxRate:purchasingNumber(row.taxRate),tax:purchasingNumber(row.taxAmount),
  }; });
  DB.purchaseOrderApprovals=purchaseOrderApprovals.map(row=>{
    const order=orderById.get(row.orderId)||{};
    const vendor=supplierById.get(order.supplierId)||{};
    const lines=(orderLinesByOrder.get(row.orderId)||[]).sort((a,b)=>a.lineNo-b.lineNo).map(line=>{
      const item=productById.get(line.productId)||{};
      return {
        id:line.id,lineNo:line.lineNo,productId:line.productId,
        sku:item.sku||`#${line.productId}`,name:item.name||`Product #${line.productId}`,
        uom:item.uom||'',qty:purchasingNumber(line.qty),unitCost:purchasingNumber(line.unitCost),
        net:purchasingNumber(line.netAmount),taxCode:line.taxCode,
        taxRate:purchasingNumber(line.taxRate),tax:purchasingNumber(line.taxAmount),
      };
    });
    return {
      id:row.id,version:row.version,orderId:row.orderId,no:order.docNo||`PO #${row.orderId}`,
      orderDate:dateValue(order.orderDate),currency:order.currency||DB.company.currency,
      supplierId:order.supplierId,supplier:vendor.name||`Supplier #${order.supplierId}`,
      supplierCode:vendor.code||'—',net:purchasingNumber(order.netAmount),
      tax:purchasingNumber(order.taxAmount),total:purchasingNumber(order.totalAmount),
      status:row.status,orderStatus:order.status,submittedAt:dateTimeValue(row.submittedAt),
      decidedAt:row.decidedAt?dateTimeValue(row.decidedAt):null,
      decidedByName:row.decidedByName||null,decisionNote:row.decisionNote||null,
      lines,
    };
  });
  const landedLinesByHeader=new Map();
  landedCostLines.forEach(row=>{
    const rows=landedLinesByHeader.get(row.landedCostId)||[];
    const item=productById.get(row.productId)||{};
    rows.push({
      id:row.id,lineNo:row.lineNo,purchaseOrderLineId:row.purchaseOrderLineId,
      productId:row.productId,sku:item.sku||`#${row.productId}`,
      name:item.name||`Product #${row.productId}`,uom:item.uom||'',
      qty:purchasingNumber(row.receivedQty),goods:purchasingNumber(row.goodsValue),
      allocated:purchasingNumber(row.allocatedAmount),
      onHand:row.onHandQtyAtAllocation==null?null:purchasingNumber(row.onHandQtyAtAllocation),
      costBefore:row.averageCostBefore==null?null:purchasingNumber(row.averageCostBefore),
      costAfter:row.averageCostAfter==null?null:purchasingNumber(row.averageCostAfter),
    });
    landedLinesByHeader.set(row.landedCostId,rows);
  });
  DB.landedCosts=landedCosts.map(row=>{
    const receipt=receiptById.get(row.goodsReceiptId)||{};
    const vendor=supplierById.get(row.supplierId)||{};
    return {
      id:row.id,version:row.version,no:row.docNo,date:dateValue(row.costDate),
      goodsReceiptId:row.goodsReceiptId,orderId:row.orderId,supplierId:row.supplierId,
      ref:receipt.docNo||`GR #${row.goodsReceiptId}`,
      supplier:vendor.name||`Supplier #${row.supplierId}`,code:vendor.code||'—',
      basis:row.allocationBasis,goods:purchasingNumber(row.goodsValue),
      freight:purchasingNumber(row.freightAmount),duty:purchasingNumber(row.dutyAmount),
      handling:purchasingNumber(row.handlingAmount),other:purchasingNumber(row.otherAmount),
      added:purchasingNumber(row.totalAddedCost),currency:row.currency,
      status:{draft:'Draft',allocated:'Allocated',cancelled:'Cancelled'}[row.status]||row.status,
      rawStatus:row.status,allocatedAt:row.allocatedAt?dateTimeValue(row.allocatedAt):null,
      lines:(landedLinesByHeader.get(row.id)||[]).sort((a,b)=>a.lineNo-b.lineNo),
    };
  });
  const requisitionLinesByReq=new Map();
  purchaseRequisitionLines.forEach(row=>{
    const arr=requisitionLinesByReq.get(row.requisitionId)||[];
    arr.push(row);
    requisitionLinesByReq.set(row.requisitionId,arr);
  });
  const convertedByRequisition=new Map();
  purchaseOrders.forEach(row=>{
    if(row.requisitionId!=null) convertedByRequisition.set(row.requisitionId,row);
  });
  const PR_STATUS_UI={submitted:'Submitted',approved:'Approved',rejected:'Rejected'};
  DB.purchaseReqs=purchaseRequisitions.map(row=>{
    const lines=requisitionLinesByReq.get(row.id)||[];
    const convertedOrder=convertedByRequisition.get(row.id);
    return {
      id:row.id,
      no:row.reqNo,
      date:dateValue(row.createdAt),
      requestedBy:row.requestedByName,
      dept:row.department,
      need:dateValue(row.neededByDate),
      lines:lines.length,
      lineItems:lines.map(line=>{
        const product=productById.get(line.productId)||{};
        return {
          productId:line.productId,
          sku:product.sku||`#${line.productId}`,
          name:product.name||`Product #${line.productId}`,
          uom:product.uom||'',
          qty:purchasingNumber(line.qty),
          estimatedUnitCost:purchasingNumber(line.estimatedUnitCost),
        };
      }),
      value:purchasingNumber(row.estimatedValue),
      priority:row.priority,
      justification:row.justification||'',
      status:convertedOrder?'Converted':(PR_STATUS_UI[row.status]||row.status),
      rawStatus:row.status,
      rejectionReason:row.rejectionReason||'',
      decidedAt:row.decidedAt?dateTimeValue(row.decidedAt):null,
      ref:convertedOrder?convertedOrder.docNo:'',
      convertedOrderId:convertedOrder?convertedOrder.id:null,
    };
  });
  const requisitionById=new Map(purchaseRequisitions.map(row=>[row.id,row]));
  const rfqLineById=new Map(purchaseRfqLines.map(row=>[row.id,row]));
  const rfqLinesByRfq=new Map();
  purchaseRfqLines.forEach(row=>{
    const rows=rfqLinesByRfq.get(row.rfqId)||[];
    rows.push(row);
    rfqLinesByRfq.set(row.rfqId,rows);
  });
  const invitedByRfq=new Map();
  purchaseRfqSuppliers.forEach(row=>{
    const rows=invitedByRfq.get(row.rfqId)||[];
    rows.push(row);
    invitedByRfq.set(row.rfqId,rows);
  });
  const quoteLinesByQuote=new Map();
  supplierQuotationLines.forEach(row=>{
    const rows=quoteLinesByQuote.get(row.quotationId)||[];
    rows.push(row);
    quoteLinesByQuote.set(row.quotationId,rows);
  });
  const quotesByRfq=new Map();
  supplierQuotations.forEach(row=>{
    const rows=quotesByRfq.get(row.rfqId)||[];
    rows.push(row);
    quotesByRfq.set(row.rfqId,rows);
  });
  const RFQ_STATUS_UI={draft:'Draft',sent:'Sent',responded:'Responded',awarded:'Awarded',closed:'Closed'};
  DB.rfqs=purchaseRfqs.map(row=>{
    const lines=(rfqLinesByRfq.get(row.id)||[]).sort((a,b)=>a.lineNo-b.lineNo);
    const invitations=invitedByRfq.get(row.id)||[];
    const responses=quotesByRfq.get(row.id)||[];
    const requisition=requisitionById.get(row.requisitionId);
    const rawStatus=row.status;
    const status=rawStatus==='sent'&&responses.length>0?'Partially Responded':(RFQ_STATUS_UI[rawStatus]||rawStatus);
    return {
      id:row.id,version:row.version,no:row.docNo,date:dateValue(row.rfqDate),subject:row.subject,
      requisitionId:row.requisitionId,pr:requisition&&requisition.reqNo||'',due:dateValue(row.responseDueDate),
      suppliers:invitations.length,responded:responses.length,status,rawStatus,
      supplierIds:invitations.map(invitation=>invitation.supplierId),
      lines:lines.map(line=>{ const item=productById.get(line.productId)||{}; return {
        id:line.id,productId:line.productId,sku:item.sku||`#${line.productId}`,
        name:item.name||`Product #${line.productId}`,uom:item.uom||'',qty:purchasingNumber(line.qty),
      }; }),
    };
  });
  const rfqById=new Map(DB.rfqs.map(row=>[row.id,row]));
  const SQ_STATUS_UI={received:'Received',converted:'Converted',rejected:'Rejected'};
  DB.supplierQuotes=supplierQuotations.map(row=>{
    const rfq=rfqById.get(row.rfqId)||{};
    const vendor=supplierById.get(row.supplierId)||{};
    const lines=(quoteLinesByQuote.get(row.id)||[]).sort((a,b)=>a.lineNo-b.lineNo);
    const first=lines[0]||{};
    const firstItem=productById.get(first.productId)||{};
    return {
      id:row.id,version:row.version,no:row.docNo,rfqId:row.rfqId,rfq:rfq.no||`RFQ #${row.rfqId}`,
      supplierId:row.supplierId,supplier:vendor.name||`Supplier #${row.supplierId}`,code:vendor.code||'—',
      item:lines.length>1?`${firstItem.name||'Item'} +${lines.length-1}`:(firstItem.name||'Item'),
      qty:lines.reduce((sum,line)=>sum+purchasingNumber(line.qty),0),price:purchasingNumber(first.unitCost),
      currency:row.currency,leadTime:row.leadTimeDays,validity:dateValue(row.validUntil),quoteDate:dateValue(row.quoteDate),
      terms:row.paymentTerms,warranty:row.warranty||'—',net:purchasingNumber(row.netAmount),
      tax:purchasingNumber(row.taxAmount),total:purchasingNumber(row.totalAmount),
      status:SQ_STATUS_UI[row.status]||row.status,rawStatus:row.status,
      lines:lines.map(line=>{ const item=productById.get(line.productId)||{}; const request=rfqLineById.get(line.rfqLineId)||{}; return {
        id:line.id,rfqLineId:line.rfqLineId,productId:line.productId,sku:item.sku||`#${line.productId}`,
        name:item.name||`Product #${line.productId}`,uom:item.uom||'',qty:purchasingNumber(line.qty||request.qty),
        unitCost:purchasingNumber(line.unitCost),taxCode:line.taxCode,net:purchasingNumber(line.netAmount),
        tax:purchasingNumber(line.taxAmount),
      }; }),
    };
  });
  const invoiceById=new Map(supplierInvoices.map(row=>[row.id,row]));
  const returnLinesByReturn=new Map();
  purchaseReturnLines.forEach(row=>{
    const rows=returnLinesByReturn.get(row.returnId)||[];
    const item=productById.get(row.productId)||{};
    rows.push({
      id:row.id,returnId:row.returnId,lineNo:row.lineNo,purchaseOrderLineId:row.purchaseOrderLineId,
      productId:row.productId,sku:item.sku||`#${row.productId}`,name:item.name||`Product #${row.productId}`,
      uom:item.uom||'',trackingType:item.trackingType||'none',qty:purchasingNumber(row.qty),
      unitCost:purchasingNumber(row.unitCost),net:purchasingNumber(row.netAmount),
      taxCode:row.taxCode,taxRate:purchasingNumber(row.taxRate),tax:purchasingNumber(row.taxAmount),
    });
    returnLinesByReturn.set(row.returnId,rows);
  });
  const RETURN_STATUS_UI={requested:'Requested',credited:'Credited',rejected:'Rejected'};
  DB.purchaseReturns=purchaseReturns.map(row=>{
    const invoice=invoiceById.get(row.supplierInvoiceId)||{};
    const vendor=supplierById.get(invoice.supplierId)||{};
    const receipt=receiptById.get(row.goodsReceiptId)||{};
    const lines=(returnLinesByReturn.get(row.id)||[]).sort((a,b)=>a.lineNo-b.lineNo);
    return {
      id:row.id,version:row.version,no:row.docNo,date:dateValue(row.returnDate),
      goodsReceiptId:row.goodsReceiptId,supplierInvoiceId:row.supplierInvoiceId,
      warehouseId:row.warehouseId,grn:receipt.docNo||`GR #${row.goodsReceiptId}`,
      invoice:invoice.docNo||`Invoice #${row.supplierInvoiceId}`,
      supplierId:invoice.supplierId,supplier:vendor.name||'Unknown supplier',code:vendor.code||'—',
      reason:row.reason,status:RETURN_STATUS_UI[row.status]||row.status,rawStatus:row.status,
      qty:lines.reduce((sum,line)=>sum+line.qty,0),value:purchasingNumber(row.totalAmount),
      net:purchasingNumber(row.netAmount),tax:purchasingNumber(row.taxAmount),
      currency:invoice.currency||DB.company.currency,lines,
    };
  });
  const purchaseReturnById=new Map(DB.purchaseReturns.map(row=>[row.id,row]));
  const creditLinesByCredit=new Map();
  supplierCreditNoteLines.forEach(row=>{
    const rows=creditLinesByCredit.get(row.creditNoteId)||[];
    const item=productById.get(row.productId)||{};
    rows.push({
      id:row.id,lineNo:row.lineNo,returnLineId:row.returnLineId,productId:row.productId,
      sku:item.sku||`#${row.productId}`,name:item.name||`Product #${row.productId}`,
      qty:purchasingNumber(row.qty),net:purchasingNumber(row.netAmount),tax:purchasingNumber(row.taxAmount),
    });
    creditLinesByCredit.set(row.creditNoteId,rows);
  });
  DB.supplierCreditNotes=supplierCreditNotes.map(row=>{
    const vendor=supplierById.get(row.supplierId)||{};
    const originalReturn=purchaseReturnById.get(row.returnId)||{};
    return {
      id:row.id,no:row.docNo,date:dateValue(row.noteDate),returnId:row.returnId,
      supplierInvoiceId:row.supplierInvoiceId,supplierId:row.supplierId,
      supplier:vendor.name||'Unknown supplier',code:vendor.code||'—',
      ref:originalReturn.no||`Return #${row.returnId}`,reason:originalReturn.reason||'Purchase return',
      amount:purchasingNumber(row.totalAmount),net:purchasingNumber(row.netAmount),
      tax:purchasingNumber(row.taxAmount),currency:row.currency,status:'Posted',rawStatus:row.status,
      lines:(creditLinesByCredit.get(row.id)||[]).sort((a,b)=>a.lineNo-b.lineNo),
    };
  });
  DB.supplierDebitNotes=supplierDebitNotes.map(row=>{
    const vendor=supplierById.get(row.supplierId)||{};
    const invoice=invoiceById.get(row.supplierInvoiceId)||{};
    return {
      id:row.id,version:row.version,no:row.docNo,date:dateValue(row.noteDate),
      supplierInvoiceId:row.supplierInvoiceId,supplierId:row.supplierId,
      supplier:vendor.name||'Unknown supplier',code:vendor.code||'—',
      ref:invoice.docNo||`Invoice #${row.supplierInvoiceId}`,reason:row.reason,
      amount:purchasingNumber(row.totalAmount),net:purchasingNumber(row.netAmount),
      tax:purchasingNumber(row.taxAmount),taxCode:row.taxCode,taxRate:purchasingNumber(row.taxRate),
      currency:row.currency,status:{draft:'Draft',posted:'Posted',cancelled:'Cancelled'}[row.status]||row.status,
      rawStatus:row.status,
    };
  });
  const adjustmentByInvoice=new Map();
  [...supplierCreditNotes.filter(row=>row.status==='posted'),...supplierDebitNotes.filter(row=>row.status==='posted')]
    .forEach(row=>adjustmentByInvoice.set(
      row.supplierInvoiceId,
      (adjustmentByInvoice.get(row.supplierInvoiceId)||0)+purchasingNumber(row.totalAmount),
    ));
  DB.supplierInvoices.forEach(row=>{
    row.outstanding=row.rawStatus==='unpaid'?Math.max(0,row.total-(adjustmentByInvoice.get(row.id)||0)):0;
  });
  DB.suppliers.forEach(row=>{
    row.balance=DB.supplierInvoices
      .filter(invoice=>invoice.supplierId===row.id&&invoice.rawStatus==='unpaid')
      .reduce((sum,invoice)=>sum+invoice.outstanding,0);
  });
  DB.purchasingReadMeta={
    truncated:pages.some(page=>Boolean(page.nextCursor)),
    nextCursors:pages.map(page=>page.nextCursor),
  };
}

async function prepareCanonicalSupplierPriceData(){
  await prepareCanonicalPurchasingData();
  const pages=await Promise.all([
    listPage('purchasing/supplier-price-lists'),
    listPage('purchasing/supplier-price-list-lines'),
  ]);
  const [supplierPriceLists,supplierPriceListLines]=pages.map(page=>page.data||[]);
  const productById=new Map((DB.items||[]).map(row=>[row.id,row]));
  const supplierById=new Map((DB.suppliers||[]).map(row=>[row.id,row]));
  const linesByHeader=new Map();
  supplierPriceListLines.forEach(row=>{
    const rows=linesByHeader.get(row.priceListId)||[];
    const item=productById.get(row.productId)||{};
    rows.push({id:row.id,lineNo:row.lineNo,productId:row.productId,sku:item.sku||`#${row.productId}`,
      name:item.name||`Product #${row.productId}`,uom:item.uom||'',
      minQty:purchasingNumber(row.minQty),unitCost:purchasingNumber(row.unitCost)});
    linesByHeader.set(row.priceListId,rows);
  });
  DB.supplierPriceLists=supplierPriceLists.map(row=>{
    const vendor=supplierById.get(row.supplierId)||{};
    const lines=(linesByHeader.get(row.id)||[]).sort((a,b)=>a.lineNo-b.lineNo);
    const isExpired=row.status==='active'&&row.effectiveTo&&row.effectiveTo<new Date().toISOString().slice(0,10);
    return {id:row.id,version:row.version,code:row.code,name:row.name,supplierId:row.supplierId,
      supplier:vendor.name||`Supplier #${row.supplierId}`,supplierCode:vendor.code||'—',currency:row.currency,
      effective:dateValue(row.effectiveFrom),expiry:row.effectiveTo?dateValue(row.effectiveTo):null,
      leadTime:row.leadTimeDays,paymentTerms:row.paymentTerms||'—',preferred:Boolean(row.isPreferred),
      status:isExpired?'Expired':({draft:'Draft',active:'Active',archived:'Archived'}[row.status]||row.status),
      rawStatus:row.status,lines,scope:lines.map(line=>line.name).slice(0,2).join(', ')||'—',
      moq:lines.length?Math.min(...lines.map(line=>line.minQty)):0};
  });
}

async function prepareCanonicalVendorPerformanceData(){
  await prepareCanonicalPurchasingData();
  const page=await listPage('purchasing/vendor-performance');
  DB.vendorPerf=(page.data||[]).map(row=>({
    id:row.id,code:row.supplierCode,supplier:row.supplierName,
    orders:row.orderCount,received:row.receivedCount,receivedPct:row.receivedPct==null?null:purchasingNumber(row.receivedPct),
    spend:purchasingNumber(row.invoicedSpend),leadTime:row.avgLeadDays==null?null:purchasingNumber(row.avgLeadDays),
    onTime:row.onTimePct==null?null:purchasingNumber(row.onTimePct),
    returnRate:purchasingNumber(row.returnRatePct),invoiceMatch:row.invoiceMatchPct==null?null:purchasingNumber(row.invoiceMatchPct),
    contractCoverage:row.contractCoveragePct==null?null:purchasingNumber(row.contractCoveragePct),
    rating:purchasingNumber(row.rating),
  }));
}

/* ============================================================
   GENERIC PURCHASING LIST FACTORY  (mirror of makeSalesList)
   ============================================================ */
function makePurList(cfg){
  SCREENS[cfg.route] = async function(root){
    if(cfg.prepare) await cfg.prepare();
    const value=(candidate,...args)=>typeof candidate==='function'?candidate(...args):candidate;
    let filter = 'all';
    const allRows = () => (typeof cfg.rows==='function' ? cfg.rows() : cfg.rows);
    const rows = () => { const r=allRows(); return filter==='all' ? r : r.filter(x=>cfg.filterFn(x,filter)); };

    function kpibar(){
      if(!cfg.kpis) return '';
      return `<div class="so-kpibar">`+cfg.kpis(allRows()).map(k=>
        `<button class="so-kpi ${k.neg?'neg':''} ${k.accent?'accent':''} ${k.f?'clickable':''}" ${k.f?`data-f="${k.f}"`:'disabled'}>
          <small>${esc(value(k.label))}</small><b class="tnum">${k.val}</b></button>`).join('')+`</div>`;
    }
    function toolbar(){
      const chips = cfg.chips ? `<div class="filterchips" id="plChips">${cfg.chips.map(c=>`<button class="chip ${c[0]===filter?'on':''}" data-f="${c[0]}">${esc(value(c[1]))}</button>`).join('')}</div>` : '<div></div>';
      const right = `${btn('Filter',{icon:'filter',cls:'soft'})}${btn('Export',{icon:'download',cls:'soft',attrs:'data-export'})}${cfg.newBtn?btn(value(cfg.newBtn.label),{icon:'plus',cls:'primary',attrs:'data-new'}):''}`;
      return `<div class="toolbar">${chips}<div class="grow"></div>${value(cfg.actions)||''}${right}</div>`;
    }
    function table(){ return buildTable({ checkable:true, rowId:cfg.rowId, columns:cfg.columns.map(column=>({...column,label:value(column.label)})), rows:rows() }); }
    function body(){ return `<div class="sales-body">${kpibar()}${toolbar()}<div class="sales-tablewrap" id="plTable">${table()}</div></div>`; }

    function render(){
      root.innerHTML = purPage({ active:cfg.active||cfg.route, title:value(cfg.title), crumb:cfg.crumb, sub:value(cfg.sub),
        count: rows().length
          +(cfg.prepare&&DB.purchasingReadMeta&&DB.purchasingReadMeta.truncated?'+':'')
          +(cfg.unit?(' '+value(cfg.unit)):''), body: body() });
      wire();
    }
    function setFilter(f){ filter=f; render(); }
    function openRowMenu(btnEl,row){
      closeAllPops();
      const items=cfg.rowMenu(row); const r=btnEl.getBoundingClientRect();
      const m=document.createElement('div'); m.className='pop show somenu';
      m.style.cssText=`width:212px;top:${r.bottom+6}px;left:auto;right:${Math.max(8,window.innerWidth-r.right)}px;padding:6px;transform-origin:top right`;
      m.innerHTML=items.map(x=>`${x.sep?'<div class="menusep"></div>':''}<button class="menu-item ${x.danger?'danger':''}" data-id="${x.id}">${ic(x.icon)}<span>${esc(x.label)}</span></button>`).join('');
      document.body.appendChild(m);
      const close=()=>{m.remove();document.removeEventListener('click',out);};
      const out=e=>{ if(!m.contains(e.target)&&e.target!==btnEl) close(); };
      m.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>{ const it=items.find(i=>i.id===b.dataset.id); it&&it.run&&it.run(); close(); }));
      setTimeout(()=>document.addEventListener('click',out),10);
    }
    function wire(){
      wireTable($('#plTable'),{ onRow: cfg.onOpen ? (id)=>cfg.onOpen(allRows().find(r=>String(cfg.rowId(r))===String(id))) : null });
      if(cfg.onOpen) $('#plTable').querySelectorAll('.linknum').forEach(el=>el.addEventListener('click',e=>{
        e.stopPropagation(); const tr=el.closest('[data-row]'); if(tr) cfg.onOpen(allRows().find(r=>String(cfg.rowId(r))===String(tr.dataset.row)));
      }));
      $('#plChips') && $$('#plChips .chip').forEach(c=>c.addEventListener('click',()=>setFilter(c.dataset.f)));
      $$('#viewRoot .so-kpi.clickable').forEach(k=>k.addEventListener('click',()=>setFilter(k.dataset.f)));
      const nb=$('#viewRoot [data-new]'); nb&&cfg.newBtn&&nb.addEventListener('click',cfg.newBtn.onClick);
      const ex=$('#viewRoot [data-export]'); ex&&ex.addEventListener('click',()=>toast(value(cfg.title)+' exported to Excel','ok'));
      if(cfg.rowMenu) $('#plTable').querySelectorAll('.row-menu').forEach(b=>b.addEventListener('click',e=>{
        e.stopPropagation(); const tr=b.closest('[data-row]'); const row=allRows().find(r=>String(cfg.rowId(r))===String(tr.dataset.row)); openRowMenu(b,row);
      }));
      if(cfg.wire) cfg.wire(root,allRows());
    }
    render();
  };
}

/* ============================================================
   PURCHASING DASHBOARD (module landing)
   ============================================================ */
SCREENS['purchasing-home'] = function(root){
  const PO=DB.purchaseOrders, SI=DB.supplierInvoices, GRN=DB.goodsReceipts;
  const openPO=PO.filter(p=>!['Completed','Cancelled'].includes(p.status));
  const openVal=openPO.reduce((a,p)=>a+p.total,0);
  const pending=PO.filter(p=>p.status==='Pending Approval').length;
  const pendingGRN=PO.filter(p=>['Approved','Partially Completed'].includes(p.status)).length;
  const grnNotInv=GRN.filter(g=>g.status==='Posted').length - SI.filter(i=>i.grn&&i.status!=='Draft').length + 1;
  const invPendingMatch=SI.filter(i=>['Pending Matching','Mismatch'].includes(i.status)).length;
  const overdueAP=SI.filter(i=>['Posted','Partially Paid','Overdue'].includes(i.status)).reduce((a,i)=>a+i.total,0);
  const overdueDel=openPO.filter(p=>new Date(p.expect)<new Date('2026-06-21')).length;

  const kpis=[
    {label:'Open POs', val:openPO.length, route:'purchase-orders'},
    {label:'Open PO value', val:money0(openVal), route:'purchase-orders'},
    {label:'Pending approval', val:pending, route:'po-approvals', accent:pending>0},
    {label:'Pending receipt', val:pendingGRN, route:'goods-receipts'},
    {label:'Overdue deliveries', val:overdueDel, route:'purchase-orders', neg:overdueDel>0},
    {label:'Invoices to match', val:invPendingMatch, route:'supplier-invoices', neg:invPendingMatch>0},
    {label:'Outstanding AP', val:money0(overdueAP), route:'supplier-invoices', neg:overdueAP>0},
  ];
  const kpibar=`<div class="so-kpibar">`+kpis.map(k=>`<button class="so-kpi ${k.neg?'neg':''} ${k.accent?'accent':''} clickable" onclick="navigate('${k.route}')"><small>${esc(k.label)}</small><b class="tnum">${k.val}</b></button>`).join('')+`</div>`;

  /* spend chart */
  const maxM=Math.max(...DB.purByMonth.map(m=>m.val));
  const ytd=DB.purByMonth.filter(m=>!m.fc).reduce((a,m)=>a+m.val,0);
  const monthBars=`<div class="mbars">`+DB.purByMonth.map(m=>{
    const h=Math.round(m.val/maxM*100);
    return `<div class="mbar" data-tip="${m.m} · ${m.fc?'forecast ':''}${money0(m.val)}"><span class="mbar-track"><i class="${m.fc?'fc':''}" style="height:${h}%"></i></span><span class="mbar-l">${m.m[0]}</span></div>`;
  }).join('')+`</div>`;

  /* buyer bars */
  const maxB=Math.max(...DB.purByBuyer.map(b=>Math.max(b.spend,b.target)));
  const buyerBars=`<div class="repbars">`+DB.purByBuyer.map(b=>{
    const pct=Math.round(b.spend/maxB*100), tpct=Math.round(b.target/maxB*100), under=b.spend<=b.target;
    return `<div class="repbar"><div class="rb-top"><span>${esc(b.buyer)}</span><b class="tnum">${money0(b.spend)}</b></div>
      <div class="rb-track"><i style="width:${pct}%;background:${under?'var(--accent)':'var(--warn)'}"></i><span class="rb-tick" style="left:${tpct}%" data-tip="Budget ${money0(b.target)}"></span></div>
      <div class="rb-sub">${under?`${Math.round(b.spend/b.target*100)}% of ${money0(b.target)} budget`:`<span style="color:var(--warn)">Over budget</span>`} · ${b.orders} orders</div></div>`;
  }).join('')+`</div>`;

  const topSupp=barList(DB.topSuppliers.map(s=>({label:s.supplier, value:s.ytd, text:money0(s.ytd), clr:'var(--accent)'})));

  /* module directory tiles */
  function counts(route){
    switch(route){
      case 'suppliers': return DB.suppliers.filter(s=>s.status==='Active').length;
      case 'purchase-requisitions': return DB.purchaseReqs.filter(r=>['Submitted','Approved'].includes(r.status)).length;
      case 'rfqs': return DB.rfqs.filter(r=>!['Closed','Cancelled'].includes(r.status)).length;
      case 'supplier-quotations': return DB.supplierQuotes.filter(q=>q.status==='Received').length;
      case 'purchase-orders': return openPO.length;
      case 'goods-receipts': return GRN.filter(g=>!['Posted','Cancelled'].includes(g.status)).length;
      case 'supplier-invoices': return SI.filter(i=>['Pending Matching','Mismatch','Posted','Partially Paid','Overdue'].includes(i.status)).length;
      case 'purchase-returns': return DB.purchaseReturns.filter(r=>!['Credited','Closed','Cancelled'].includes(r.status)).length;
      case 'supplier-credit-notes': return DB.supplierCreditNotes.filter(c=>c.status==='Draft').length;
      case 'supplier-debit-notes': return DB.supplierDebitNotes.filter(d=>d.status==='Draft').length;
      case 'po-approvals': return pending;
      case 'supplier-price-lists': return DB.supplierPriceLists.filter(p=>p.status==='Active').length;
      case 'landed-cost': return DB.landedCosts.filter(l=>l.status==='Draft').length;
      case 'vendor-performance': return DB.vendorPerf.length;
      case 'purchasing-reports': return DB.purReportsCatalog.flatMap(g=>g.items).length;
      default: return null;
    }
  }
  function tile(it){ const c=counts(it.route);
    return `<button class="stile" onclick="navigate('${it.route}')">
      <span class="stile-ic">${ic(it.icon)}</span>
      <span class="stile-main"><b>${esc(it.label)}</b><small>${esc(it.desc)}</small></span>
      ${c!=null?`<span class="stile-meta">${c}</span>`:''}
      <span class="stile-go">${ic('chevR')}</span></button>`;
  }
  function group(name){ const sec=PUR_SECTIONS.find(s=>s.group===name); return `<div class="stile-grid">${sec.items.map(tile).join('')}</div>`; }

  root.innerHTML = purPage({
    active:'purchasing-home', title:'Purchasing',
    crumb:[DB.company.name,{cur:'Purchasing'}],
    sub:'Procure-to-pay command centre — from requisition and RFQ through purchase order, receipt, supplier invoice and payment.',
    action: btn('New purchase order',{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-purchase-order\')"'}),
    body:`<div class="sales-body">
      ${kpibar}
      <div class="sb-grid">
        <div class="wcard sb-span2"><div class="sb-h"><h3>Purchase spend — FY2026</h3><div class="sb-h-r"><b class="tnum">${money0(ytd)}</b><small>YTD · 6 mo</small></div></div>${monthBars}<div class="sb-legend"><span><i style="background:var(--accent)"></i>Actual</span><span><i class="fc-swatch"></i>Forecast</span></div></div>
        <div class="wcard"><div class="sb-h"><h3>3-way match</h3></div>
          <div class="sb-stat"><div><small>To match</small><b class="tnum">${invPendingMatch}</b><span>invoices</span></div><div><small>GRN not invoiced</small><b class="tnum">${Math.max(0,grnNotInv)}</b><span>receipts</span></div></div>
          ${btn('Open supplier invoices',{icon:'receipt',cls:'soft',sm:false,attrs:'onclick="navigate(\'supplier-invoices\')"'})}
        </div>
        <div class="wcard"><div class="sb-h"><h3>Top suppliers</h3><a class="sb-link" onclick="navigate('report-pur-supplier')">Report</a></div>${topSupp}</div>
        <div class="wcard sb-span2"><div class="sb-h"><h3>Spend by buyer</h3><a class="sb-link" onclick="navigate('report-pur-buyer')">Report</a></div>${buyerBars}</div>
      </div>

      <div class="dash-sectitle"><span>Master Data</span><span class="ln"></span></div>
      ${group('Master Data')}
      <div class="dash-sectitle"><span>Transactions</span><span class="ln"></span></div>
      ${group('Transactions')}
      <div class="dash-sectitle"><span>Controls</span><span class="ln"></span></div>
      ${group('Controls')}
      <div class="dash-sectitle"><span>Reports</span><span class="ln"></span></div>
      ${group('Reports')}
    </div>`
  });
};

/* ============================================================
   REPORTS HUB
   ============================================================ */
let PUR_REPORT_PENDING = null;
function openPurReport(id){
  const meta = DB.purReportsCatalog.flatMap(g=>g.items).find(r=>r.id===id);
  if(meta && meta.built) navigate(id);
  else { PUR_REPORT_PENDING = meta; navigate('report-pur-generic'); }
}
SCREENS['purchasing-reports'] = function(root){
  function card(r){ return `<button class="rep-card ${r.built?'built':''}" onclick="openPurReport('${r.id}')">
    <span class="rep-ic">${ic(r.icon)}</span>
    <span class="rep-main"><b>${esc(r.name)}</b><small>${esc(r.desc)}</small></span>
    ${r.built?`<span class="rep-tag">Live</span>`:''}${ic('chevR')}</button>`; }
  const groups=DB.purReportsCatalog.map(g=>`<div class="dash-sectitle"><span>${esc(g.group)}</span><span class="ln"></span></div><div class="rep-grid">${g.items.map(card).join('')}</div>`).join('');
  root.innerHTML = purPage({
    active:'purchasing-reports', title:'Reports', sub:'Operational and management reports across the procure-to-pay lifecycle. Filter by date, supplier, item, buyer, warehouse and status; export to Excel or PDF.',
    body:`<div class="sales-body">${groups}</div>`
  });
};

/* ---- report shell (purchasing) ---- */
function purReportShell({title, meta, params, result}){
  return `<div class="content full"><section class="master" data-screen-label="Report · ${esc(title)}"><div class="report">
    <aside class="report-params">
      <h3>Parameters</h3>
      ${params}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:6px;display:flex;flex-direction:column;gap:8px">
        ${btn('Run report',{icon:'refresh',cls:'primary',sm:false,attrs:'onclick="toast(\'Report refreshed\',\'ok\')"'})}
        ${btn('Back to reports',{icon:'chevL',cls:'soft',attrs:'onclick="navigate(\'purchasing-reports\')"'})}
      </div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">${esc(title)}</b><div class="report-meta">${meta}</div></div>
        <div class="grow"></div>
        ${btn('Excel',{icon:'filexls',cls:'soft'})}${btn('Print',{icon:'print',cls:'soft'})}
      </div>
      <div style="padding:16px 22px;overflow:auto">${result}</div>
    </div>
  </div></section></div>`;
}
const PUR_REPORT_PARAMS = `
  <div class="fld"><span>Period</span><select><option>FY2026 · YTD</option><option>P06 · June 2026</option><option>Q2 2026</option><option>FY2025</option></select></div>
  <div class="fld"><span>Supplier</span><select><option>All suppliers</option><option>Daido Precision Ltd</option><option>EuroSteel Trading</option><option>Shenzhen Microcircuit</option></select></div>
  <div class="fld"><span>Buyer</span><select><option>All buyers</option><option>R. Haddad</option><option>A. Bauer</option><option>S. Kaur</option></select></div>`;

/* ---- Purchase by Supplier ---- */
SCREENS['report-pur-supplier'] = function(root){
  const data=DB.topSuppliers, tot=data.reduce((a,c)=>a+c.ytd,0);
  const rows=data.map((c,i)=>`<tr><td class="lineno">${i+1}</td><td class="l li-name"><b>${esc(c.supplier)}</b><small>${esc(c.code)}</small></td>
    <td class="tnum">${money0(c.ytd)}</td><td class="tnum">${c.share}%</td>
    <td class="l"><span class="bartrack" style="width:140px;display:inline-block;vertical-align:middle"><i style="width:${Math.round(c.ytd/data[0].ytd*100)}%"></i></span></td></tr>`).join('');
  root.innerHTML=purReportShell({
    title:'Purchase by Supplier', meta:`FY2026 YTD · ${money0(tot)} spend · ${data.length} suppliers`,
    params:PUR_REPORT_PARAMS,
    result:`<div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Spend by supplier</h3></div><div class="panel-body" style="padding:14px 18px">${barList(data.map(c=>({label:c.supplier,value:c.ytd,text:money0(c.ytd),clr:'var(--accent)'})))}</div></div>
      <div class="panel"><div class="panel-h"><h3>Detail</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${data.length} suppliers</span></div>
      <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Supplier</th><th>Spend YTD</th><th>Share</th><th class="l">Distribution</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td class="l" style="font-weight:600">Total</td><td class="tnum"><b>${money0(tot)}</b></td><td class="tnum">100%</td><td></td></tr></tfoot></table></div>`
  });
};

/* ---- Purchase by Buyer ---- */
SCREENS['report-pur-buyer'] = function(root){
  const data=DB.purByBuyer, tot=data.reduce((a,r)=>a+r.spend,0), totT=data.reduce((a,r)=>a+r.target,0);
  const rows=data.map((r,i)=>{ const pct=Math.round(r.spend/r.target*100), under=r.spend<=r.target;
    return `<tr><td class="lineno">${i+1}</td><td class="l li-name"><b>${esc(r.buyer)}</b><small>${r.orders} orders</small></td>
    <td class="tnum">${money0(r.spend)}</td><td class="tnum">${money0(r.target)}</td>
    <td class="tnum" style="color:${under?'var(--ok)':'var(--warn)'}">${pct}%</td>
    <td class="l">${under?cap('On budget','ok'):cap('Over','warn')}</td></tr>`;}).join('');
  root.innerHTML=purReportShell({
    title:'Purchase by Buyer', meta:`FY2026 YTD · ${money0(tot)} of ${money0(totT)} budget`,
    params:PUR_REPORT_PARAMS,
    result:`<div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Spend vs. budget</h3></div><div class="panel-body" style="padding:14px 18px">${barList(data.map(r=>({label:r.buyer,value:r.spend,text:money0(r.spend),clr:r.spend<=r.target?'var(--accent)':'var(--warn)'})))}</div></div>
      <div class="panel"><div class="panel-h"><h3>Detail</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${data.length} buyers</span></div>
      <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Buyer</th><th>Spend</th><th>Budget</th><th>Used</th><th class="l">Status</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td class="l" style="font-weight:600">Total</td><td class="tnum"><b>${money0(tot)}</b></td><td class="tnum">${money0(totT)}</td><td class="tnum">${Math.round(tot/totT*100)}%</td><td></td></tr></tfoot></table></div>`
  });
};

/* ---- Price Variance ---- */
SCREENS['report-pur-price-var'] = function(root){
  const d=DB.suppInvoice0615;
  const rows=d.lines.map((l,i)=>{ const v=l.invQty*(l.invPrice-l.poPrice);
    return `<tr><td class="lineno">${i+1}</td><td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)}</small></td>
    <td class="tnum">${money(l.poPrice)}</td><td class="tnum" style="${l.invPrice!==l.poPrice?'color:var(--warn)':''}">${money(l.invPrice)}</td>
    <td class="tnum">${num(l.invQty)}</td><td class="tnum" style="color:${v?'var(--danger)':'var(--muted)'}">${v?'+'+money(v):'—'}</td></tr>`;}).join('');
  const varTot=d.lines.reduce((a,l)=>a+l.invQty*(l.invPrice-l.poPrice),0);
  root.innerHTML=purReportShell({
    title:'Price Variance Report', meta:`Invoice vs PO price · ${money(varTot)} total variance flagged`,
    params:PUR_REPORT_PARAMS,
    result:`<div class="alert warn" style="margin:0 0 14px"><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span class="grow"><b>1 line over tolerance.</b> Control Module PCB v3 invoiced ${money(2)}/ea over PO — routed for variance approval.</span></div>
      <div class="panel"><div class="panel-h"><h3>Variance by line — ${esc(d.no)}</h3></div>
      <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>PO price</th><th>Inv price</th><th>Inv qty</th><th>Variance</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td class="l" style="font-weight:600">Total variance</td><td></td><td></td><td></td><td class="tnum"><b style="color:var(--warn)">+${money(varTot)}</b></td></tr></tfoot></table></div>`
  });
};

/* ---- Supplier Performance ---- */
SCREENS['report-pur-vendor'] = function(root){
  const data=DB.vendorPerf.slice().sort((a,b)=>b.rating-a.rating);
  const rows=data.map((v,i)=>`<tr><td class="lineno">${i+1}</td><td class="l li-name"><b>${esc(v.supplier)}</b><small>${esc(v.code)}</small></td>
    <td class="tnum" style="color:${v.onTime>=90?'var(--ok)':v.onTime>=80?'var(--warn)':'var(--danger)'}">${v.onTime}%</td>
    <td class="tnum">${v.leadTime}d</td>
    <td class="tnum" style="color:${v.qualityReject<=1?'var(--ok)':v.qualityReject<=3?'var(--warn)':'var(--danger)'}">${v.qualityReject}%</td>
    <td class="tnum" style="color:${v.mismatch<=2?'var(--ok)':'var(--warn)'}">${v.mismatch}%</td>
    <td class="tnum">${money0(v.spend)}</td>
    <td class="l"><b class="tnum">${v.rating.toFixed(1)}</b> ${v.rating>=4.5?cap('Preferred','ok'):v.rating>=4?cap('Approved','accent'):v.rating>=3.6?cap('Watch','warn'):cap('Review','danger')}</td></tr>`).join('');
  root.innerHTML=purReportShell({
    title:'Supplier Performance Report', meta:`${data.length} active suppliers · scored on delivery, quality, lead-time & match`,
    params:PUR_REPORT_PARAMS,
    result:`<div class="panel"><div class="panel-h"><h3>Supplier scorecard</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${data.length} suppliers</span></div>
      <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Supplier</th><th>On-time</th><th>Lead</th><th>Reject</th><th>Mismatch</th><th>Spend</th><th class="l">Rating</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`
  });
};

/* ---- generic (not-yet-configured) report ---- */
SCREENS['report-pur-generic'] = function(root){
  const m=PUR_REPORT_PENDING || {name:'Report', desc:'', icon:'chart'};
  root.innerHTML=purReportShell({
    title:m.name, meta:'Configure parameters, then run',
    params:PUR_REPORT_PARAMS + `<div class="fld"><span>Status</span><select><option>All</option><option>Open</option><option>Closed</option></select></div><div class="fld"><span>Group by</span><select><option>Supplier</option><option>Item</option><option>Buyer</option><option>Month</option></select></div>`,
    result:`<div class="rep-empty">${ic(m.icon)}<h3>${esc(m.name)}</h3><p>${esc(m.desc||'')}</p><p style="color:var(--faint);font-size:13px">Set the parameters on the left and run the report. This report shares the standard purchasing report engine — results render as a chart plus an exportable table.</p>${btn('Run report',{icon:'refresh',cls:'primary',sm:false,attrs:'onclick="toast(\'Report queued — results ready shortly\',\'info\')"'})}</div>`
  });
};
