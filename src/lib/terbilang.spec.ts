import { describe, expect, it } from 'vitest';
import { terbilang, terbilangRupiah } from './terbilang';

describe('terbilang', () => {
	it.each([
		[0, 'nol'],
		[1, 'satu'],
		[10, 'sepuluh'],
		[11, 'sebelas'],
		[12, 'dua belas'],
		[19, 'sembilan belas'],
		[20, 'dua puluh'],
		[21, 'dua puluh satu'],
		[100, 'seratus'],
		[101, 'seratus satu'],
		[115, 'seratus lima belas'],
		[999, 'sembilan ratus sembilan puluh sembilan'],
		[1_000, 'seribu'],
		[1_100, 'seribu seratus'],
		[2_000, 'dua ribu'],
		[11_000, 'sebelas ribu'],
		[100_000, 'seratus ribu'],
		[1_000_000, 'satu juta'],
		[1_250_000, 'satu juta dua ratus lima puluh ribu'],
		[5_000_000, 'lima juta'],
		[7_500_001, 'tujuh juta lima ratus ribu satu'],
		[1_001_000, 'satu juta seribu'],
		[2_000_000_000, 'dua miliar'],
		[1_000_000_000_000, 'satu triliun']
	])('%i → %s', (n, words) => {
		expect(terbilang(n)).toBe(words);
	});

	it('capitalises and adds "rupiah"; rejects invalid amounts', () => {
		expect(terbilangRupiah(5_000_000)).toBe('Lima juta rupiah');
		expect(() => terbilang(-1)).toThrow();
		expect(() => terbilang(1.5)).toThrow();
	});
});
