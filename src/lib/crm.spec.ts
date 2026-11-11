import { describe, expect, it } from 'vitest';
import { crewMatches, paymentChip } from './crm.ts';

const andi = { name: 'Andi Pratama', role: 'Fotografer', phone: '6281234567890' };

describe('crewMatches', () => {
	it('matches everything on an empty query', () => {
		expect(crewMatches(andi, '  ')).toBe(true);
	});

	it('matches name and role words, any case and order', () => {
		expect(crewMatches(andi, 'andi')).toBe(true);
		expect(crewMatches(andi, 'pratama FOTO')).toBe(true);
		expect(crewMatches(andi, 'video')).toBe(false);
		expect(crewMatches(andi, 'andi video')).toBe(false);
		// City and device are searchable too
		const sby = { ...andi, city: 'Surabaya', device: 'iPhone 15 Pro' };
		expect(crewMatches(sby, 'surabaya')).toBe(true);
		expect(crewMatches(sby, 'iphone andi')).toBe(true);
		expect(crewMatches(sby, 'bekasi')).toBe(false);
	});

	it('matches the WhatsApp number however it is typed', () => {
		expect(crewMatches(andi, '0812')).toBe(true);
		expect(crewMatches(andi, '62812')).toBe(true);
		expect(crewMatches(andi, '+62 812-3456')).toBe(true);
		expect(crewMatches(andi, '567890')).toBe(true);
		expect(crewMatches(andi, '0813')).toBe(false);
		// Too short, or no number on file
		expect(crewMatches(andi, '08')).toBe(false);
		expect(crewMatches({ ...andi, phone: null }, '0812')).toBe(false);
	});
});

describe('paymentChip', () => {
	const b = {
		stage: 'preparation' as const,
		bookedAt: new Date(),
		agreedPrice: 1_230_000,
		paid: 600_000
	};

	it('shows Lunas once payments cover the agreed price', () => {
		expect(paymentChip({ ...b, paid: 1_230_000 })?.label).toBe('Lunas');
		expect(paymentChip({ ...b, paid: 1_300_000 })?.label).toBe('Lunas');
	});

	it('shows DP lunas after the DP, Belum DP before it', () => {
		expect(paymentChip(b)?.label).toBe('DP lunas');
		expect(paymentChip({ ...b, stage: 'quotation', bookedAt: null, paid: 0 })).toEqual({
			label: 'Belum DP',
			tone: 'chip--warning'
		});
	});

	it('never says Lunas for a zero price, and shows nothing for Batal', () => {
		expect(paymentChip({ ...b, agreedPrice: 0, paid: 0, bookedAt: null })?.label).toBe('Belum DP');
		expect(paymentChip({ ...b, stage: 'lost', paid: 1_230_000 })).toBeNull();
	});
});
