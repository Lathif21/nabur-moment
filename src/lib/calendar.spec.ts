import { describe, expect, it } from 'vitest';
import { gridRange, isMonth, monthGrid, monthLabel, shiftMonth } from './calendar';

describe('calendar month math', () => {
	it('builds Monday-first full weeks', () => {
		// November 2026 starts on a Sunday and ends on a Monday
		const weeks = monthGrid('2026-11');
		expect(weeks).toHaveLength(6);
		expect(weeks.every((w) => w.length === 7)).toBe(true);
		expect(weeks[0][0]).toBe('2026-10-26');
		expect(weeks[0][6]).toBe('2026-11-01');
		expect(weeks[5][0]).toBe('2026-11-30');
		expect(weeks[5][6]).toBe('2026-12-06');
		expect(gridRange('2026-11')).toEqual({ from: '2026-10-26', to: '2026-12-06' });
	});

	it('February 2027 fits in exactly 4 weeks (starts Monday, 28 days)', () => {
		const weeks = monthGrid('2027-02');
		expect(weeks).toHaveLength(4);
		expect(weeks[0][0]).toBe('2027-02-01');
		expect(weeks[3][6]).toBe('2027-02-28');
	});

	it('shifts across years and labels in Indonesian', () => {
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
		expect(monthLabel('2026-08')).toBe('Agustus 2026');
		expect(isMonth('2026-13')).toBe(false);
		expect(isMonth('2026-07')).toBe(true);
		expect(() => monthGrid('2026-7')).toThrow();
	});
});
