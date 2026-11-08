import { describe, expect, it } from 'vitest';
import {
	DP_PERCENT,
	addDays,
	counterKey,
	docNumber,
	itemsTotal,
	splitPrice,
	suggestedDueDate
} from './finance';

describe('splitPrice', () => {
	it('splits 50 / 50; the pelunasan absorbs the odd rupiah', () => {
		expect(DP_PERCENT).toBe(50);
		expect(splitPrice(10_000_000)).toEqual({ dp: 5_000_000, pelunasan: 5_000_000 });
		expect(splitPrice(7_500_001)).toEqual({ dp: 3_750_000, pelunasan: 3_750_001 });
		expect(splitPrice(0)).toEqual({ dp: 0, pelunasan: 0 });
	});
});

describe('document numbers', () => {
	it('formats INV / KW numbers per month with 3-digit padding', () => {
		expect(docNumber('INV', '2026-11-08', 1)).toBe('INV/NM/2026/11/001');
		expect(docNumber('KW', '2027-01-31', 42)).toBe('KW/NM/2027/01/042');
		expect(docNumber('INV', '2026-11-08', 1234)).toBe('INV/NM/2026/11/1234');
		expect(counterKey('INV', '2026-11-08')).toBe('INV-2026-11');
		expect(
			itemsTotal([
				{ qty: 1, unitPrice: 9_000_000 },
				{ qty: 2, unitPrice: 500_000 }
			])
		).toBe(10_000_000);
	});
});

describe('due dates', () => {
	it('adds days across months and suggests DP +7 / pelunasan on Hari H', () => {
		expect(addDays('2026-11-28', 7)).toBe('2026-12-05');
		expect(suggestedDueDate('dp', null, '2026-11-08')).toBe('2026-11-15');
		expect(suggestedDueDate('pelunasan', '2027-02-14', '2026-11-08')).toBe('2027-02-14');
		// Hari H already passed: due today, never before the invoice date
		expect(suggestedDueDate('pelunasan', '2026-10-01', '2026-11-08')).toBe('2026-11-08');
		expect(suggestedDueDate('pelunasan', null, '2026-11-08')).toBe('2026-11-15');
	});
});
