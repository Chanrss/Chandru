import { describe, it, expect } from 'vitest';
import {
  isDosaItem,
  isIdlyItem,
  isGlobalServiceItem,
  isTiffinCategory,
  isDinnerCategory,
  isLunchCategory,
  isServicePeriodCategory,
  filterPosMenuItems,
  getPosCategoryDishCount,
  CONSOLIDATED_POS_CATEGORIES
} from './menuItemHelpers';
import { MenuItem, Category } from '../types';

describe('menuItemHelpers - POS Global Dosa & Idly Across All Service Periods', () => {
  const sampleCategories: Category[] = [
    { id: 'cat_beve', categoryCode: 'BEVE', categoryName: 'Beverages', displayOrder: 1, active: true, createdAt: 1000, updatedAt: 1000 },
    { id: 'cat_tiff', categoryCode: 'TIFF', categoryName: 'Tiffin', displayOrder: 2, active: true, createdAt: 1000, updatedAt: 1000 },
    { id: 'cat_lunc', categoryCode: 'LUNC', categoryName: 'Lunch', displayOrder: 3, active: true, createdAt: 1000, updatedAt: 1000 },
    { id: 'cat_dinn', categoryCode: 'DINN', categoryName: 'dinner', displayOrder: 4, active: true, createdAt: 1000, updatedAt: 1000 },
  ];

  const now = Date.now();
  const sampleItems: MenuItem[] = [
    { id: '1', itemCode: '1', itemName: 'Tea', itemNameTamil: 'டீ', categoryId: 'cat_beve', categoryName: 'Beverages', acPrice: 15, nonAcPrice: 15, active: true, createdAt: now, updatedAt: now },
    { id: '17', itemCode: '17', itemName: 'Idly', itemNameTamil: 'இட்லி', categoryId: 'cat_tiff', categoryName: 'Tiffin', acPrice: 15, nonAcPrice: 15, active: true, createdAt: now, updatedAt: now },
    { id: '19', itemCode: '19', itemName: 'CHILLY IDLY', itemNameTamil: 'சில்லி இட்லி', categoryId: 'cat_tiff', categoryName: 'Tiffin', acPrice: 70, nonAcPrice: 70, active: true, createdAt: now, updatedAt: now },
    { id: '30', itemCode: '30', itemName: 'Dosa', itemNameTamil: 'தோசை', categoryId: 'cat_tiff', categoryName: 'Tiffin', acPrice: 50, nonAcPrice: 50, active: true, createdAt: now, updatedAt: now },
    { id: '31', itemCode: '31', itemName: 'Roast', itemNameTamil: 'ரோஸ்ட்', categoryId: 'cat_tiff', categoryName: 'Tiffin', acPrice: 60, nonAcPrice: 60, active: true, createdAt: now, updatedAt: now },
    { id: '32', itemCode: '32', itemName: 'Uthappam', itemNameTamil: 'ஊத்தப்பம்', categoryId: 'cat_tiff', categoryName: 'Tiffin', acPrice: 50, nonAcPrice: 50, active: true, createdAt: now, updatedAt: now },
    { id: '33', itemCode: '33', itemName: 'Masala Dosa', itemNameTamil: 'மசால் தோசை', categoryId: 'cat_tiff', categoryName: 'Tiffin', acPrice: 70, nonAcPrice: 70, active: true, createdAt: now, updatedAt: now },
    { id: '42', itemCode: '42', itemName: 'Rava Roast', itemNameTamil: 'ரவா ரோஸ்ட்', categoryId: 'cat_tiff', categoryName: 'Tiffin', acPrice: 70, nonAcPrice: 70, active: true, createdAt: now, updatedAt: now },
    { id: '45', itemCode: '45', itemName: 'PANEER DOSAI', itemNameTamil: 'பன்னீர் தோசை', categoryId: 'cat_tiff', categoryName: 'Tiffin', acPrice: 110, nonAcPrice: 110, active: true, createdAt: now, updatedAt: now },
    { id: '54', itemCode: '54', itemName: 'MEALS', itemNameTamil: 'சாப்பாடு', categoryId: 'cat_lunc', categoryName: 'Lunch', acPrice: 100, nonAcPrice: 100, active: true, createdAt: now, updatedAt: now },
    { id: '70', itemCode: '70', itemName: 'PAROTTA(1)', itemNameTamil: 'பரோட்டா (1)', categoryId: 'cat_dinn', categoryName: 'dinner', acPrice: 25, nonAcPrice: 25, active: true, createdAt: now, updatedAt: now },
    { id: '71', itemCode: '71', itemName: 'CHAPPATHI (1)', itemNameTamil: 'சப்பாத்தி (1)', categoryId: 'cat_dinn', categoryName: 'dinner', acPrice: 25, nonAcPrice: 25, active: true, createdAt: now, updatedAt: now },
  ];

  it('identifies service periods correctly', () => {
    expect(isServicePeriodCategory({ id: 'cat_tiff', categoryName: 'Tiffin', categoryCode: 'TIFF' })).toBe(true);
    expect(isServicePeriodCategory({ id: 'cat_dinn', categoryName: 'dinner', categoryCode: 'DINN' })).toBe(true);
    expect(isServicePeriodCategory({ id: 'cat_lunc', categoryName: 'Lunch', categoryCode: 'LUNC' })).toBe(true);
    expect(isServicePeriodCategory({ id: 'cat_beve', categoryName: 'Beverages', categoryCode: 'BEVE' })).toBe(false);
  });

  it('shows all dosa and idly items across Tiffin and Dinner only, and excludes them from Lunch', () => {
    // When Tiffin is selected:
    const tiffinItems = filterPosMenuItems(sampleItems, 'cat_tiff', sampleCategories);
    const tiffinCodes = tiffinItems.map(i => i.itemCode);
    expect(tiffinCodes).toContain('17'); // Idly
    expect(tiffinCodes).toContain('30'); // Dosa
    expect(tiffinCodes).toContain('33'); // Masala Dosa

    // When Dinner is selected:
    const dinnerItems = filterPosMenuItems(sampleItems, 'cat_dinn', sampleCategories);
    const dinnerCodes = dinnerItems.map(i => i.itemCode);
    expect(dinnerCodes).toContain('70'); // Parotta
    expect(dinnerCodes).toContain('17'); // Idly in Dinner
    expect(dinnerCodes).toContain('30'); // Dosa in Dinner
    expect(dinnerCodes).toContain('33'); // Masala Dosa in Dinner

    // When Lunch is selected: Dosa and Idly are EXCLUDED from Lunch
    const lunchItems = filterPosMenuItems(sampleItems, 'cat_lunc', sampleCategories);
    const lunchCodes = lunchItems.map(i => i.itemCode);
    expect(lunchCodes).toContain('54'); // Meals in Lunch
    expect(lunchCodes).not.toContain('17'); // No Idly in Lunch
    expect(lunchCodes).not.toContain('30'); // No Dosa in Lunch
    expect(lunchCodes).not.toContain('33'); // No Masala Dosa in Lunch
  });

  it('filters by consolidated categories cat_dosa and cat_idly', () => {
    const dosaOnly = filterPosMenuItems(sampleItems, 'cat_dosa', sampleCategories);
    expect(dosaOnly.every(isDosaItem)).toBe(true);
    expect(dosaOnly.map(i => i.itemCode)).toContain('30');
    expect(dosaOnly.map(i => i.itemCode)).not.toContain('17'); // No Idly
    expect(dosaOnly.map(i => i.itemCode)).not.toContain('70'); // No Parotta

    const idlyOnly = filterPosMenuItems(sampleItems, 'cat_idly', sampleCategories);
    expect(idlyOnly.every(isIdlyItem)).toBe(true);
    expect(idlyOnly.map(i => i.itemCode)).toContain('17');
    expect(idlyOnly.map(i => i.itemCode)).toContain('19');
    expect(idlyOnly.map(i => i.itemCode)).not.toContain('30'); // No Dosa
  });

  it('calculates proper dish count for consolidated and period categories in POS', () => {
    // Consolidated Dosa tab count
    expect(getPosCategoryDishCount({ id: 'cat_dosa' }, sampleItems)).toBe(6);
    // Consolidated Idly tab count
    expect(getPosCategoryDishCount({ id: 'cat_idly' }, sampleItems)).toBe(2);

    // Dinner period (2 dinner items + 8 global dosa/idly items = 10)
    const dinnerCat = sampleCategories.find(c => c.id === 'cat_dinn')!;
    expect(getPosCategoryDishCount(dinnerCat, sampleItems)).toBe(10);

    // Lunch period (1 lunch item, Dosa/Idly not included in Lunch = 1)
    const lunchCat = sampleCategories.find(c => c.id === 'cat_lunc')!;
    expect(getPosCategoryDishCount(lunchCat, sampleItems)).toBe(1);
  });

  it('ensures Dosa and Idly items are not filtered out by active service period selection', () => {
    // When activeServicePeriod is DINNER and category is 'all'
    const dinnerPeriodAll = filterPosMenuItems(sampleItems, 'all', sampleCategories, '', 'DINNER');
    const dinnerPeriodCodes = dinnerPeriodAll.map(i => i.itemCode);
    expect(dinnerPeriodCodes).toContain('17'); // Idly
    expect(dinnerPeriodCodes).toContain('30'); // Dosa
    expect(dinnerPeriodCodes).toContain('70'); // Parotta
    expect(dinnerPeriodCodes).not.toContain('54'); // Meals (Lunch item should be filtered out)

    // When activeServicePeriod is TIFFIN and category is 'all'
    const tiffinPeriodAll = filterPosMenuItems(sampleItems, 'all', sampleCategories, '', 'TIFFIN');
    const tiffinPeriodCodes = tiffinPeriodAll.map(i => i.itemCode);
    expect(tiffinPeriodCodes).toContain('17'); // Idly
    expect(tiffinPeriodCodes).toContain('30'); // Dosa
    expect(tiffinPeriodCodes).not.toContain('70'); // Parotta (Dinner item filtered out)

    // When selectedCategory is direct string 'DINNER' or 'dinner'
    const directDinner = filterPosMenuItems(sampleItems, 'DINNER', sampleCategories);
    expect(directDinner.map(i => i.itemCode)).toContain('30'); // Dosa
    expect(directDinner.map(i => i.itemCode)).toContain('17'); // Idly

    // When selectedCategory is direct string 'TIFFIN' or 'tiffin'
    const directTiffin = filterPosMenuItems(sampleItems, 'TIFFIN', sampleCategories);
    expect(directTiffin.map(i => i.itemCode)).toContain('30'); // Dosa
    expect(directTiffin.map(i => i.itemCode)).toContain('17'); // Idly
  });
});
