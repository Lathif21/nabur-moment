import { describe, expect, it } from 'vitest';
import { crewMatches } from './crm.ts';

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
