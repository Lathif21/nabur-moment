import { describe, expect, it } from 'vitest';
import { DP_PERCENT, splitPrice } from './finance';

describe('splitPrice', () => {
	it('splits 50 / 50; the pelunasan absorbs the odd rupiah', () => {
		expect(DP_PERCENT).toBe(50);
		expect(splitPrice(10_000_000)).toEqual({ dp: 5_000_000, pelunasan: 5_000_000 });
		expect(splitPrice(7_500_001)).toEqual({ dp: 3_750_000, pelunasan: 3_750_001 });
		expect(splitPrice(0)).toEqual({ dp: 0, pelunasan: 0 });
	});
});
