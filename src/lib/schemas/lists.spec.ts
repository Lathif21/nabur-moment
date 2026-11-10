import { describe, expect, it } from 'vitest';
import { packageSchema } from './lists';

const base = {
	categoryId: '0f8fad5b-d9cb-469f-a165-70867728950e',
	name: 'Gold',
	price: '8000000'
};

describe('packageSchema: Harga normal', () => {
	it('empty means no promo', () => {
		expect(packageSchema.parse({ ...base, normalPrice: '' }).normalPrice).toBeNull();
		expect(packageSchema.parse(base).normalPrice).toBeNull();
	});

	it('keeps a higher normal price', () => {
		expect(packageSchema.parse({ ...base, normalPrice: '10000000' }).normalPrice).toBe(10_000_000);
	});

	it('refuses a normal price at or below the price', () => {
		for (const normalPrice of ['8000000', '5000000']) {
			const r = packageSchema.safeParse({ ...base, normalPrice });
			expect(r.success).toBe(false);
			expect(r.error?.issues[0].path).toEqual(['normalPrice']);
		}
	});
});
