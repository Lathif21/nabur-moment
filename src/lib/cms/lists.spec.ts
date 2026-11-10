import { describe, expect, it } from 'vitest';
import { discountPercent } from './lists';

describe('discountPercent', () => {
	it('rounds down so the badge never overstates', () => {
		expect(discountPercent(450_000, 550_000)).toBe(18);
		expect(discountPercent(8_000_000, 10_000_000)).toBe(20);
		expect(discountPercent(700_000, 1_000_000)).toBe(30);
	});

	it('is 0 without a promo', () => {
		expect(discountPercent(450_000, null)).toBe(0);
		expect(discountPercent(450_000, undefined)).toBe(0);
		expect(discountPercent(450_000, 450_000)).toBe(0);
		expect(discountPercent(450_000, 400_000)).toBe(0);
	});
});
