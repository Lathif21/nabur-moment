import { describe, it, expect } from 'vitest';
import {
	countdown,
	dateID,
	dayKeyWib,
	nowWib,
	phoneDisplay,
	phoneNormalize,
	rupiah,
	rupiahShort
} from './format.ts';

describe('rupiah', () => {
	it('uses dot thousands and no decimals', () => {
		expect(rupiah(12_500_000)).toBe('Rp 12.500.000');
		expect(rupiah(7_500_000)).toBe('Rp 7.500.000');
		expect(rupiah(0)).toBe('Rp 0');
		expect(rupiah(-750_000)).toBe('−Rp 750.000');
	});
});

describe('rupiahShort', () => {
	it('shortens to jt / M / T with at most one decimal', () => {
		expect(rupiahShort(12_500_000)).toBe('Rp 12,5 jt');
		expect(rupiahShort(412_000_000)).toBe('Rp 412 jt');
		expect(rupiahShort(1_200_000_000)).toBe('Rp 1,2 M');
		expect(rupiahShort(3_000_000_000_000)).toBe('Rp 3 T');
	});

	it('keeps the full form below 1 jt and signs negatives', () => {
		expect(rupiahShort(750_000)).toBe('Rp 750.000');
		expect(rupiahShort(-31_200_000)).toBe('−Rp 31,2 jt');
	});
});

describe('dateID', () => {
	// 2026-11-22 07:00 UTC = Minggu 22 Nov 2026 14:00 WIB
	const instant = new Date('2026-11-22T07:00:00Z');

	it('formats instants in WIB with Indonesian names, 24-hour time', () => {
		expect(dateID(instant)).toBe('22 Nov 2026');
		expect(dateID(instant, 'datetime')).toBe('22 Nov 14:00');
		expect(dateID(instant, 'long')).toBe('Minggu, 22 Nov 2026');
		expect(dateID(instant, 'full')).toBe('22 November 2026');
		expect(dateID(instant, 'time')).toBe('14:00');
	});

	it('uses the WIB calendar day, not UTC, near midnight', () => {
		// 17:30 UTC on the 21st is already 00:30 on the 22nd in Jakarta
		expect(dateID(new Date('2026-10-21T17:30:00Z'), 'datetime')).toBe('22 Okt 00:30');
	});

	it('treats yyyy-MM-dd as a calendar day without shifting it', () => {
		expect(dateID('2026-05-01')).toBe('1 Mei 2026');
		expect(dateID('2026-12-31', 'long')).toBe('Kamis, 31 Des 2026');
		expect(() => dateID('2026-05-01', 'time')).toThrow();
	});
});

describe('WIB days', () => {
	it('rolls over to the next day at midnight WIB, not UTC', () => {
		expect(dayKeyWib(new Date('2026-01-31T16:59:00Z'))).toBe('2026-01-31');
		expect(dayKeyWib(new Date('2026-01-31T17:00:00Z'))).toBe('2026-02-01');
	});

	it('reads wall-clock fields in WIB', () => {
		const d = nowWib(new Date('2026-03-10T01:30:00Z'));
		expect(d.getHours()).toBe(8);
		expect(d.getMinutes()).toBe(30);
	});
});

describe('countdown', () => {
	it('counts down before, says Hari H on the day, counts up after', () => {
		expect(countdown('2026-11-22', '2026-11-10')).toBe('H-12');
		expect(countdown('2026-11-22', '2026-11-21')).toBe('H-1');
		expect(countdown('2026-11-22', '2026-11-22')).toBe('Hari H');
		expect(countdown('2026-11-22', '2026-11-25')).toBe('H+3');
	});

	it('counts calendar days across months, years and leap days', () => {
		expect(countdown('2027-01-02', '2026-12-31')).toBe('H-2');
		expect(countdown('2028-03-01', '2028-02-28')).toBe('H-2'); // leap year
	});

	it('defaults today to the WIB calendar day', () => {
		expect(countdown(dayKeyWib())).toBe('Hari H');
	});

	it('rejects malformed dates', () => {
		expect(() => countdown('22/11/2026', '2026-11-10')).toThrow();
	});
});

describe('phoneNormalize', () => {
	it.each([
		['0812-3456-7890', '6281234567890'],
		['+62 812 3456 7890', '6281234567890'],
		['+62 (0)812 3456 7890', '6281234567890'],
		['62 0812 3456 7890', '6281234567890'],
		['6281234567890', '6281234567890'],
		['812 3456 7890', '6281234567890'],
		['(021) 555-1234', '62215551234'],
		['+65 9123 4567', '6591234567']
	])('%s → %s', (raw, expected) => {
		expect(phoneNormalize(raw)).toBe(expected);
	});

	it('returns null for empty or implausible input', () => {
		expect(phoneNormalize('')).toBeNull();
		expect(phoneNormalize(null)).toBeNull();
		expect(phoneNormalize('  ')).toBeNull();
		expect(phoneNormalize('abc')).toBeNull();
		expect(phoneNormalize('0812')).toBeNull();
		expect(phoneNormalize('0812 3456 7890 1234 5678')).toBeNull();
	});
});

describe('phoneDisplay', () => {
	it('groups Indonesian numbers and prefixes others with +', () => {
		expect(phoneDisplay('6281234567890')).toBe('+62 812-3456-7890');
		expect(phoneDisplay('6591234567')).toBe('+6591234567');
	});
});
