
import { SalesLineItem, SalesDocument, TaxCode, RunningNumberConfig } from '../types';

export const generateNextIdString = (config: RunningNumberConfig): string => {
  const date = new Date();
  let datePart = '';
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  if (config.dateFormat === 'YYYY') datePart = year;
  else if (config.dateFormat === 'YYMM') datePart = year.substr(-2) + month;
  else if (config.dateFormat === 'YYYYMM') datePart = year + month;
  else if (config.dateFormat === 'YYYYMMDD') datePart = year + month + day;
  
  const seq = config.nextSequence.toString().padStart(config.digits, '0');
  const parts = [config.prefix];
  if (datePart) parts.push(datePart);
  parts.push(seq);
  
  const mainId = parts.join(config.separator);
  if (config.suffix) {
      const suffixSep = config.suffixSeparator !== undefined ? config.suffixSeparator : config.separator;
      return `${mainId}${suffixSep}${config.suffix}`;
  }
  return mainId;
};

export const calculateTotals = (items: SalesLineItem[], taxCodes: TaxCode[]): Partial<SalesDocument> => {
    let subtotal = 0;
    let lineDiscountTotal = 0;
    let taxTotal = 0;
    let taxableAmount = 0;

    const updatedItems = items.map(item => {
        const gross = item.qty * item.unitPrice;
        
        let discountAmt = 0;
        if (item.discountType === 'PERCENT') {
           discountAmt = gross * (item.discountValue / 100);
        } else {
           discountAmt = item.discountValue;
        }
        discountAmt = Math.min(discountAmt, gross);
        
        const net = gross - discountAmt;
        
        const taxRate = taxCodes.find(t => t.code === item.taxCode)?.rate || 0;
        const taxAmt = net * taxRate;
        
        return {
            ...item,
            discount: discountAmt,
            taxAmount: taxAmt,
            lineTotal: net + taxAmt
        };
    });

    updatedItems.forEach(item => {
        subtotal += (item.qty * item.unitPrice);
        lineDiscountTotal += item.discount;
        taxTotal += item.taxAmount;
        const taxRate = taxCodes.find(t => t.code === item.taxCode)?.rate || 0;
        if (taxRate > 0) {
            taxableAmount += ((item.qty * item.unitPrice) - item.discount);
        }
    });

    const docDiscount = 0;
    const totalDisc = lineDiscountTotal + docDiscount;
    const netTotal = subtotal - totalDisc + taxTotal;
    // Fix floating point issues
    const grandTotal = Math.round((netTotal + Number.EPSILON) * 100) / 100;
    const rounding = grandTotal - netTotal;

    return { 
        items: updatedItems,
        subtotal, 
        taxTotal, 
        taxableAmount,
        discountTotal: totalDisc, 
        grandTotal, 
        rounding 
    };
};
