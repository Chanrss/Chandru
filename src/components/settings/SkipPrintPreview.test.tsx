import { describe, it, expect, vi } from 'vitest';
import { RestaurantSettings } from '../../types';

describe('Skip Print Preview Feature', () => {
  it('has skipPrintPreview in default RestaurantSettings structure', () => {
    const settings: Partial<RestaurantSettings> = {
      restaurantName: 'Sri Saravana Bhavan',
      autoPrintOnSave: true,
      skipPrintPreview: true,
    };
    expect(settings.skipPrintPreview).toBe(true);
  });

  it('correctly determines whether preview is bypassed in fast rush mode or settings', () => {
    const shouldSkip = (
      settings?: Partial<RestaurantSettings>,
      fastRushMode: boolean = false
    ) => {
      return fastRushMode || Boolean(settings?.skipPrintPreview);
    };

    expect(shouldSkip(undefined, false)).toBe(false);
    expect(shouldSkip({ skipPrintPreview: false }, false)).toBe(false);
    expect(shouldSkip({ skipPrintPreview: true }, false)).toBe(true);
    expect(shouldSkip({ skipPrintPreview: false }, true)).toBe(true);
    expect(shouldSkip({ skipPrintPreview: true }, true)).toBe(true);
  });
});
