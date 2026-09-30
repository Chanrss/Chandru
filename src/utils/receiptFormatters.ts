import { Bill } from '../types';

/**
 * Resolves a concise Captain Number (e.g. '1', '2', '01') instead of full captain name
 * to save horizontal space on 58mm and 80mm thermal receipts.
 */
export function getCaptainNumber(bill: Partial<Bill> | null | undefined): string {
  if (!bill) return '1';
  const anyBill = bill as any;
  if (anyBill.captainNumber !== undefined && anyBill.captainNumber !== null && String(anyBill.captainNumber).trim() !== '') {
    return String(anyBill.captainNumber).trim();
  }
  if (anyBill.waiterNumber !== undefined && anyBill.waiterNumber !== null && String(anyBill.waiterNumber).trim() !== '') {
    return String(anyBill.waiterNumber).trim();
  }
  // Check if userId or userName contains digits (e.g., 'staff_1', 'waiter_02', 'u-3', 'C4')
  const str = `${bill.userId || ''} ${bill.userName || ''}`;
  const match = str.match(/\d+/);
  if (match) {
    return match[0];
  }
  if (bill.userName) {
    const knownMap: Record<string, string> = {
      'sivan': '1',
      'karthik': '2',
      'murugan': '3',
      'ravi': '4',
      'ganesh': '5',
      'ramesh': '6',
      'cashier': '1',
      'admin': '1',
      'staff': '1',
      'waiter': '1',
      'captain': '1'
    };
    const lower = bill.userName.toLowerCase().trim();
    if (knownMap[lower]) return knownMap[lower];
    let hash = 0;
    for (let i = 0; i < lower.length; i++) hash = (hash * 31 + lower.charCodeAt(i)) % 9 + 1;
    return String(hash || '1');
  }
  return '1';
}
