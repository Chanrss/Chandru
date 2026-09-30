import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateChecksum,
  calculateCoreBillingMetrics,
  getAutomatedDailyBackupConfig,
  saveAutomatedDailyBackupConfig,
  getDailyBackupHistory,
  saveDailyBackupRecord,
  checkAndExecuteAutomatedDailyBackup,
  DEFAULT_AUTOMATED_BACKUP_CONFIG
} from './backupService';
import { Bill, BillItem, BillingDraft, Kot, Category, MenuItem, DailyBackupRecord } from '../types';

describe('backupService: Automated Daily Backup & Core Billing Archiving', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('calculateChecksum', () => {
    it('generates consistent 32-bit FNV-1a hex checksum', () => {
      const data1 = '{"bills":[{"id":"b1","grandTotal":150}]}';
      const checksum1 = calculateChecksum(data1);
      expect(checksum1).toBeDefined();
      expect(typeof checksum1).toBe('string');
      expect(checksum1.length).toBe(8);

      // Deterministic
      expect(calculateChecksum(data1)).toBe(checksum1);

      // Changes when data changes
      const data2 = '{"bills":[{"id":"b1","grandTotal":200}]}';
      expect(calculateChecksum(data2)).not.toBe(checksum1);
    });
  });

  describe('calculateCoreBillingMetrics', () => {
    const mockBills: Bill[] = [
      {
        id: 'bill-1',
        billNumber: 'BN-001',
        businessDate: '2026-09-19',
        orderType: 'DINE_IN',
        priceType: 'NON_AC',
        paymentMethod: 'CASH',
        subtotal: 150,
        discount: 10,
        grandTotal: 140,
        status: 'COMPLETED',
        reprintCount: 0,
        createdAt: 1700000000000
      },
      {
        id: 'bill-2',
        billNumber: 'BN-002',
        businessDate: '2026-09-19',
        orderType: 'TAKE_AWAY',
        priceType: 'NON_AC',
        paymentMethod: 'UPI',
        subtotal: 200,
        discount: 0,
        grandTotal: 200,
        status: 'COMPLETED',
        reprintCount: 0,
        createdAt: 1700000060000
      },
      {
        id: 'bill-3',
        billNumber: 'BN-003',
        businessDate: '2026-09-19',
        orderType: 'DINE_IN',
        priceType: 'NON_AC',
        paymentMethod: 'CASH',
        subtotal: 90,
        discount: 0,
        grandTotal: 90,
        status: 'CANCELLED',
        reprintCount: 0,
        createdAt: 1700000120000
      }
    ];

    const mockBillItems: BillItem[] = [
      {
        id: 'bi-1',
        billId: 'bill-1',
        itemId: 'm-1',
        itemCode: '101',
        itemName: 'Ghee Roast',
        quantity: 2,
        unitPrice: 70,
        totalPrice: 140,
        priceType: 'NON_AC',
        createdAt: 1700000000000
      }
    ];

    const mockKots: Kot[] = [
      {
        id: 'kot-1',
        kotNumber: '01',
        tableNumber: 'T1',
        waiterId: 'w1',
        businessDate: '2026-09-19',
        orderType: 'DINE_IN',
        status: 'COMPLETED',
        createdBy: 'user1',
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }
    ];

    const mockDrafts: BillingDraft[] = [];
    const mockCategories: Category[] = [
      { id: 'cat-1', name: 'Tiffin', active: true, displayOrder: 1, createdAt: 1700000000000 }
    ];
    const mockMenuItems: MenuItem[] = [
      {
        id: 'm-1',
        itemCode: '101',
        categoryId: 'cat-1',
        itemName: 'Ghee Roast',
        nonAcPrice: 70,
        acPrice: 85,
        active: true,
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }
    ];

    it('calculates accurate financial and operational metrics', () => {
      const metrics = calculateCoreBillingMetrics(
        mockBills,
        mockBillItems,
        mockKots,
        mockDrafts,
        mockCategories,
        mockMenuItems
      );

      expect(metrics.totalBills).toBe(3);
      expect(metrics.completedBills).toBe(2);
      expect(metrics.cancelledBills).toBe(1);
      expect(metrics.totalRevenue).toBe(340); // 140 + 200
      expect(metrics.cashRevenue).toBe(140);
      expect(metrics.upiRevenue).toBe(200);
      expect(metrics.totalDiscount).toBe(10);
      expect(metrics.dineInBills).toBe(1); // only completed count
      expect(metrics.takeAwayBills).toBe(1);
      expect(metrics.averageBillValue).toBe(170); // 340 / 2
      expect(metrics.totalBillItems).toBe(1);
      expect(metrics.totalKots).toBe(1);
      expect(metrics.totalCategories).toBe(1);
      expect(metrics.totalMenuItems).toBe(1);
      expect(metrics.earliestBillTimestamp).toBe(1700000000000);
      expect(metrics.latestBillTimestamp).toBe(1700000120000);
    });
  });

  describe('AutomatedDailyBackupConfig local storage operations', () => {
    it('returns default configuration if none saved', () => {
      const config = getAutomatedDailyBackupConfig();
      expect(config.enabled).toBe(true);
      expect(config.scheduledTime).toBe('22:00');
      expect(config.autoDownload).toBe(true);
      expect(config.scope).toBe('CORE_BILLING');
    });

    it('saves and reads modified configuration', async () => {
      await saveAutomatedDailyBackupConfig({
        scheduledTime: '23:30',
        autoDownload: false
      });

      const updated = getAutomatedDailyBackupConfig();
      expect(updated.scheduledTime).toBe('23:30');
      expect(updated.autoDownload).toBe(false);
      expect(updated.enabled).toBe(true);
    });
  });

  describe('DailyBackupRecord history operations', () => {
    it('saves and retrieves backup records in descending chronological order', async () => {
      const record1: DailyBackupRecord = {
        id: 'rec-1',
        businessDate: '2026-09-18',
        timestamp: 1700000000000,
        exportedAt: new Date(1700000000000).toISOString(),
        filename: 'backup_2026-09-18.json',
        triggerType: 'AUTOMATED',
        status: 'SUCCESS',
        scope: 'CORE_BILLING',
        billCount: 45,
        totalRevenue: 15600,
        cashTotal: 10000,
        upiTotal: 5600,
        kotCount: 40,
        totalDocuments: 120
      };

      const record2: DailyBackupRecord = {
        id: 'rec-2',
        businessDate: '2026-09-19',
        timestamp: 1700086400000,
        exportedAt: new Date(1700086400000).toISOString(),
        filename: 'backup_2026-09-19.json',
        triggerType: 'MANUAL',
        status: 'SUCCESS',
        scope: 'CORE_BILLING',
        billCount: 50,
        totalRevenue: 18200,
        cashTotal: 12000,
        upiTotal: 6200,
        kotCount: 48,
        totalDocuments: 140
      };

      await saveDailyBackupRecord(record1);
      await saveDailyBackupRecord(record2);

      const history = getDailyBackupHistory();
      expect(history.length).toBe(2);
      expect(history[0].id).toBe('rec-2'); // More recent first
      expect(history[1].id).toBe('rec-1');
      expect(localStorage.getItem('pos_last_daily_backup_date')).toBe('2026-09-19');
    });
  });

  describe('checkAndExecuteAutomatedDailyBackup scheduling logic', () => {
    it('returns null if automated backup is disabled and not forced', async () => {
      await saveAutomatedDailyBackupConfig({ enabled: false });
      const result = await checkAndExecuteAutomatedDailyBackup(undefined, false);
      expect(result).toBeNull();
    });

    it('returns null if today was already backed up and not forced', async () => {
      await saveAutomatedDailyBackupConfig({ enabled: true });
      localStorage.setItem('pos_last_daily_backup_date', '2026-09-19');

      // Default mock date will match
      const mockSettings = {
        restaurantName: 'Sri Saravana Bhavan',
        address: '123 Main Rd',
        phone: '9876543210',
        businessDayStartHour: '04:00'
      };
      const result = await checkAndExecuteAutomatedDailyBackup(mockSettings, false);
      expect(result).toBeNull();
    });
  });
});
