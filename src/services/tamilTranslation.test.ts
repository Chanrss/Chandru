import { describe, it, expect } from 'vitest';
import { getTamilItemName, suggestTamilName, TAMIL_MENU_DICTIONARY } from './tamilTranslation';

describe('TamilTranslation Engine', () => {
  it('translates common South Indian tiffin items from dictionary', () => {
    expect(getTamilItemName('idly')).toBe('இட்லி');
    expect(getTamilItemName('Idli')).toBe('இட்லி');
    expect(getTamilItemName('Masala Dosa')).toBe('மசால் தோசை');
    expect(getTamilItemName('Plain Dosa')).toBe('சாதா தோசை');
    expect(getTamilItemName('Ghee Roast')).toBe('நெய் ரோஸ்ட்');
    expect(getTamilItemName('Medu Vada')).toBe('மெது வடை');
    expect(getTamilItemName('Filter Coffee')).toBe('ஃபில்டர் காபி');
    expect(getTamilItemName('Tea')).toBe('டீ');
    expect(getTamilItemName('Poori Masala')).toBe('பூரி மசால்');
  });

  it('normalizes and preserves trailing quantity specifiers', () => {
    expect(getTamilItemName('Idly (2 pcs)')).toBe('இட்லி (2)');
    expect(getTamilItemName('Medu Vada (1 pc)')).toBe('மெது வடை (1)');
    expect(getTamilItemName('Poori (2 pcs)')).toBe('பூரி (2)');
  });

  it('respects explicitly provided custom Tamil name override', () => {
    expect(getTamilItemName('Special Dosa', 'ஸ்பெஷல் தோசை')).toBe('ஸ்பெஷல் தோசை');
    expect(getTamilItemName('Custom Meal', 'விசேஷ சாப்பாடு')).toBe('விசேஷ சாப்பாடு');
  });

  it('decomposes known sub-word tokens when full item name is not in dictionary', () => {
    // "onion" -> "வெங்காய", "dosa" -> "தோசை"
    const translated = getTamilItemName('onion dosa');
    expect(translated).toBe('வெங்காய தோசை');
  });

  it('preserves strings that already contain native Tamil Unicode characters', () => {
    const rawTamil = 'சாம்பார் சாதம்';
    expect(getTamilItemName(rawTamil)).toBe(rawTamil);
  });

  it('falls back gracefully to the original English name if unknown', () => {
    const unknownItem = 'Continental Bruschetta Deluxe';
    expect(getTamilItemName(unknownItem)).toBe(unknownItem);
  });

  it('handles null, undefined, and whitespace gracefully', () => {
    expect(getTamilItemName('')).toBe('');
    expect(getTamilItemName('   ')).toBe('');
    expect(getTamilItemName(null as unknown as string)).toBe('');
  });

  it('suggests Tamil name for menu item configuration in real-time', () => {
    expect(suggestTamilName('Pongal')).toBe('பொங்கல்');
    expect(suggestTamilName('Curd Rice')).toBe('தயிர் சாதம்');
    expect(suggestTamilName('')).toBe('');
  });
});
