import { MenuItem, Category } from '../types';

export type ServicePeriod = 'ALL' | 'TIFFIN' | 'LUNCH' | 'DINNER';

/**
 * Checks if a menu item is a Dosa item:
 * Matches items containing Dosa, Dosai, Roast, Uthappam, Rava, or Tamil equivalents.
 */
export function isDosaItem(item: Partial<MenuItem>): boolean {
  if (!item) return false;
  const name = (item.itemName || '').toLowerCase();
  const tamil = item.itemNameTamil || '';
  const cat = (item.categoryName || '').toLowerCase();
  const catId = (item.categoryId || '').toLowerCase();
  const code = (item.itemCode || '').toLowerCase();
  return (
    name.includes('dosa') ||
    name.includes('dosai') ||
    name.includes('roast') ||
    name.includes('uthappam') ||
    name.includes('rava') ||
    cat.includes('dosa') ||
    cat.includes('dosai') ||
    catId.includes('dosa') ||
    catId.includes('dosai') ||
    code.includes('dosa') ||
    tamil.includes('தோசை') ||
    tamil.includes('ரோஸ்ட்') ||
    tamil.includes('ஊத்தப்பம்')
  );
}

/**
 * Checks if a menu item is an Idly item:
 * Matches items containing Idly, Idli, or Tamil equivalent.
 */
export function isIdlyItem(item: Partial<MenuItem>): boolean {
  if (!item) return false;
  const name = (item.itemName || '').toLowerCase();
  const tamil = item.itemNameTamil || '';
  const cat = (item.categoryName || '').toLowerCase();
  const catId = (item.categoryId || '').toLowerCase();
  const code = (item.itemCode || '').toLowerCase();
  return (
    name.includes('idly') ||
    name.includes('idli') ||
    cat.includes('idly') ||
    cat.includes('idli') ||
    catId.includes('idly') ||
    catId.includes('idli') ||
    code.includes('idly') ||
    code.includes('idli') ||
    tamil.includes('இட்லி')
  );
}

/**
 * Checks if an item is available across Tiffin and Dinner service periods (Dosa & Idly only in Tiffin, Dinner).
 */
export function isTiffinAndDinnerSharedItem(item: Partial<MenuItem>): boolean {
  return isDosaItem(item) || isIdlyItem(item);
}

/**
 * Alias for shared service item (Dosa and Idly shared across Tiffin and Dinner only).
 */
export function isGlobalServiceItem(item: Partial<MenuItem>): boolean {
  return isTiffinAndDinnerSharedItem(item);
}

/**
 * Identifies if a category represents Tiffin / Breakfast
 */
export function isTiffinCategory(category?: Partial<Category> | string | null): boolean {
  if (!category) return false;
  const str = typeof category === 'string' ? category.toLowerCase() : '';
  const id = (typeof category === 'object' ? category.id || '' : str).toLowerCase();
  const name = (typeof category === 'object' ? category.categoryName || '' : str).toLowerCase();
  const code = (typeof category === 'object' ? category.categoryCode || '' : str).toLowerCase();
  return (
    id === 'cat_tiffin' ||
    id.includes('tiff') ||
    name.includes('tiffin') ||
    name.includes('breakfast') ||
    code.includes('tif') ||
    str.includes('tif') ||
    str.includes('breakf')
  );
}

/**
 * Identifies if a category represents Dinner / Evening Service
 */
export function isDinnerCategory(category?: Partial<Category> | string | null): boolean {
  if (!category) return false;
  const str = typeof category === 'string' ? category.toLowerCase() : '';
  const id = (typeof category === 'object' ? category.id || '' : str).toLowerCase();
  const name = (typeof category === 'object' ? category.categoryName || '' : str).toLowerCase();
  const code = (typeof category === 'object' ? category.categoryCode || '' : str).toLowerCase();
  return (
    id === 'cat_dinner' ||
    id.includes('dinn') ||
    name.includes('dinner') ||
    name.includes('parotta') ||
    code.includes('din') ||
    str.includes('din')
  );
}

/**
 * Identifies if a category represents Lunch / Meals
 */
export function isLunchCategory(category?: Partial<Category> | string | null): boolean {
  if (!category) return false;
  const str = typeof category === 'string' ? category.toLowerCase() : '';
  const id = (typeof category === 'object' ? category.id || '' : str).toLowerCase();
  const name = (typeof category === 'object' ? category.categoryName || '' : str).toLowerCase();
  const code = (typeof category === 'object' ? category.categoryCode || '' : str).toLowerCase();
  return (
    id === 'cat_meals' ||
    id.includes('lunc') ||
    name.includes('lunch') ||
    name.includes('meal') ||
    code.includes('lunc') ||
    code.includes('mls') ||
    str.includes('lunc') ||
    str.includes('meal')
  );
}

/**
 * Checks if a category is a meal / service period category (Tiffin, Lunch, Dinner, etc.)
 * where food dishes and all-day items (Dosa & Idly) are globally available.
 */
export function isServicePeriodCategory(category?: Partial<Category> | string | null): boolean {
  if (!category) return false;
  const str = typeof category === 'string' ? category.toLowerCase() : '';
  const id = (typeof category === 'object' ? category.id || '' : str).toLowerCase();
  const name = (typeof category === 'object' ? category.categoryName || '' : str).toLowerCase();
  const code = (typeof category === 'object' ? category.categoryCode || '' : str).toLowerCase();

  // Auxiliary non-meal categories like standalone beverages and ice creams
  if (
    id.includes('beve') ||
    name.includes('beverage') ||
    name.includes('drink') ||
    code.includes('bev') ||
    code.includes('hot') ||
    code.includes('col') ||
    id.includes('ice') ||
    name.includes('ice cream') ||
    code.includes('ice')
  ) {
    return false;
  }

  // Any meal/service period category
  return (
    isTiffinCategory(category) ||
    isDinnerCategory(category) ||
    isLunchCategory(category) ||
    id === 'cat_snacks' ||
    name.includes('snack') ||
    code.includes('snk') ||
    name.includes('rice') ||
    name.includes('noodel') ||
    name.includes('noodle') ||
    name.includes('starter') ||
    name.includes('bread') ||
    name.includes('gravy') ||
    str.includes('din') ||
    str.includes('tif') ||
    str.includes('lunc') ||
    str.includes('meal')
  );
}

/**
 * Consolidated POS category shortcuts
 */
export const CONSOLIDATED_POS_CATEGORIES = [
  { id: 'cat_dosa', categoryName: 'Dosa', categoryCode: 'DOSA', displayOrder: -2, active: true },
  { id: 'cat_idly', categoryName: 'Idly', categoryCode: 'IDLY', displayOrder: -1, active: true }
];

/**
 * Filters items for the POS Screen:
 * - 'Dosa' and 'Idly' items are included across only Tiffin and Dinner service periods.
 * - 'Dosa' and 'Idly' are strictly excluded from Lunch / Meals period.
 * - Direct Billing maintains strict category isolation without crossover.
 * - Dedicated consolidated tabs 'cat_dosa' and 'cat_idly' isolate respective items.
 */
export function filterPosMenuItems(
  menuItems: MenuItem[],
  selectedCategory: string,
  categories: Category[],
  searchQuery = '',
  activeServicePeriod: ServicePeriod = 'ALL'
): MenuItem[] {
  const normSelected = (selectedCategory || 'all').trim();
  const lowerSelected = normSelected.toLowerCase();

  // Find category object matching by id, lower-case id, name, or code
  const currentCategoryObj = categories.find(
    (c) =>
      c.id === normSelected ||
      c.id.toLowerCase() === lowerSelected ||
      (c.categoryName && c.categoryName.toLowerCase() === lowerSelected) ||
      (c.categoryCode && c.categoryCode.toLowerCase() === lowerSelected)
  );

  const isTiffin = isTiffinCategory(currentCategoryObj) || isTiffinCategory(normSelected) || activeServicePeriod === 'TIFFIN';
  const isDinner = isDinnerCategory(currentCategoryObj) || isDinnerCategory(normSelected) || activeServicePeriod === 'DINNER';
  const isLunch = isLunchCategory(currentCategoryObj) || isLunchCategory(normSelected) || activeServicePeriod === 'LUNCH';

  const q = searchQuery.toLowerCase().trim();

  const filtered = menuItems.filter((item) => {
    const isDosa = isDosaItem(item);
    const isIdly = isIdlyItem(item);
    const isTiffinDinnerItem = isDosa || isIdly;

    // 1. Consolidated Category Selection:
    if (lowerSelected === 'cat_dosa' || lowerSelected === 'dosa') {
      if (!isDosa) return false;
      // Dosa items are available only in Tiffin, Dinner (and ALL)
      if (activeServicePeriod === 'LUNCH') return false;
    } else if (lowerSelected === 'cat_idly' || lowerSelected === 'idly') {
      if (!isIdly) return false;
      // Idly items are available only in Tiffin, Dinner (and ALL)
      if (activeServicePeriod === 'LUNCH') return false;
    } else if (lowerSelected === 'cat_dosa_idly') {
      if (!isTiffinDinnerItem) return false;
      if (activeServicePeriod === 'LUNCH') return false;
    } else if (lowerSelected === 'all') {
      // If a specific active service period filter is selected
      if (activeServicePeriod === 'TIFFIN') {
        const itemCat = categories.find((c) => c.id === item.categoryId);
        const matchesTiffinPeriod = isTiffinCategory(itemCat) || isTiffinDinnerItem;
        if (!matchesTiffinPeriod) return false;
      } else if (activeServicePeriod === 'DINNER') {
        const itemCat = categories.find((c) => c.id === item.categoryId);
        const matchesDinnerPeriod = isDinnerCategory(itemCat) || isTiffinDinnerItem;
        if (!matchesDinnerPeriod) return false;
      } else if (activeServicePeriod === 'LUNCH') {
        const itemCat = categories.find((c) => c.id === item.categoryId);
        // Exclude Dosa & Idly from Lunch period
        const matchesLunchPeriod = isLunchCategory(itemCat) && !isTiffinDinnerItem;
        if (!matchesLunchPeriod) return false;
      }
    } else if (isTiffin || isDinner) {
      // For Tiffin and Dinner service categories: Dosa and Idly are persistent and included
      const matchesCategoryDirectly =
        item.categoryId === normSelected ||
        item.categoryId.toLowerCase() === lowerSelected ||
        (currentCategoryObj && item.categoryId === currentCategoryObj.id);

      const matchesPeriodOrShared = matchesCategoryDirectly || isTiffinDinnerItem;
      if (!matchesPeriodOrShared) return false;
    } else if (isLunch) {
      // For Lunch service category (Meals/Lunch):
      // Dosa and Idly items are strictly excluded
      const matchesCategoryDirectly =
        item.categoryId === normSelected ||
        item.categoryId.toLowerCase() === lowerSelected ||
        (currentCategoryObj && item.categoryId === currentCategoryObj.id);
      if (!matchesCategoryDirectly || isTiffinDinnerItem) return false;
    } else {
      // Non-service auxiliary category (e.g. Beverages, Ice Creams)
      const matchesCategoryDirectly =
        item.categoryId === normSelected ||
        item.categoryId.toLowerCase() === lowerSelected ||
        (currentCategoryObj && item.categoryId === currentCategoryObj.id);
      if (!matchesCategoryDirectly) return false;
    }

    // 2. Search Query Matching
    if (!q) return true;
    return (
      (item.itemCode && item.itemCode.toLowerCase().includes(q)) ||
      (item.itemName && item.itemName.toLowerCase().includes(q)) ||
      (item.itemNameTamil && item.itemNameTamil.includes(q))
    );
  });

  // Sort items numerically by itemCode where possible for clean cashier scanning
  return filtered.sort((a, b) => {
    const codeA = parseInt(a.itemCode, 10);
    const codeB = parseInt(b.itemCode, 10);
    if (!isNaN(codeA) && !isNaN(codeB)) {
      return codeA - codeB;
    }
    return (a.itemCode || '').localeCompare(b.itemCode || '');
  });
}

/**
 * Computes category dish count for POS pills, accounting for Dosa & Idly items
 * only in Tiffin and Dinner service periods.
 */
export function getPosCategoryDishCount(
  category: Category | { id: string; categoryName?: string; categoryCode?: string },
  menuItems: MenuItem[]
): number {
  if (category.id === 'cat_dosa' || category.id === 'dosa') {
    return menuItems.filter(isDosaItem).length;
  }
  if (category.id === 'cat_idly' || category.id === 'idly') {
    return menuItems.filter(isIdlyItem).length;
  }
  if (category.id === 'all') {
    return menuItems.length;
  }
  // Include Dosa & Idly shared items ONLY in Tiffin and Dinner categories
  if (isTiffinCategory(category) || isDinnerCategory(category)) {
    return menuItems.filter(
      (item) =>
        item.categoryId === category.id ||
        isDosaItem(item) ||
        isIdlyItem(item)
    ).length;
  }
  // Lunch and other categories do not include Dosa & Idly
  return menuItems.filter(
    (item) => item.categoryId === category.id && !isDosaItem(item) && !isIdlyItem(item)
  ).length;
}

