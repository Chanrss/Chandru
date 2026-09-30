import { describe, it, expect } from 'vitest';
import { formatBillNumber, formatKotNumber, getBusinessDate } from './billNumberEngine';

describe('BillNumberEngine', () => {
  it('formats bill numbers with zero-padding (e.g. 1 -> "01", 9 -> "09", 10 -> "10", 105 -> "105")', () => {
    expect(formatBillNumber(1)).toBe('01');
    expect(formatBillNumber(5)).toBe('05');
    expect(formatBillNumber(9)).toBe('09');
    expect(formatBillNumber(10)).toBe('10');
    expect(formatBillNumber(42)).toBe('42');
    expect(formatBillNumber(100)).toBe('100');
  });

  it('formats KOT numbers with prefix (e.g. "KOT-01", "KOT-15")', () => {
    expect(formatKotNumber(1)).toBe('KOT-01');
    expect(formatKotNumber(15)).toBe('KOT-15');
  });

  it('computes business date correctly according to cutoff hour', () => {
    // Before 4:00 AM should count as previous calendar day
    const earlyMorning = new Date(2026, 7, 28, 2, 30, 0); // 2:30 AM on Aug 28
    const businessDateEarly = getBusinessDate('04:00', earlyMorning);
    expect(businessDateEarly).toBe('2026-08-27');

    // After 4:00 AM should count as current calendar day
    const afternoon = new Date(2026, 7, 28, 14, 30, 0); // 2:30 PM on Aug 28
    const businessDateAfternoon = getBusinessDate('04:00', afternoon);
    expect(businessDateAfternoon).toBe('2026-08-28');
  });
});
