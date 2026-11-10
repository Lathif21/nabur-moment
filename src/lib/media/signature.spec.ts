import { describe, expect, it } from 'vitest';
import { inkOnly } from './signature.ts';

/** A w×h light-grey "paper" (like a phone photo) */
function paper(w: number, h: number, grey = 242) {
	const d = new Uint8ClampedArray(w * h * 4);
	for (let i = 0; i < d.length; i += 4) d.set([grey, grey, grey, 255], i);
	return d;
}
const set = (d: Uint8ClampedArray, w: number, x: number, y: number, v: number) =>
	d.set([v, v, v, 255], (y * w + x) * 4);
const alpha = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe('inkOnly', () => {
	it('makes the paper transparent, keeps the ink opaque and boxes it', () => {
		const w = 20;
		const d = paper(w, 10);
		set(d, w, 5, 3, 10); // black stroke
		set(d, w, 12, 6, 20);
		set(d, w, 8, 4, 225); // faint smudge, close to the paper
		const box = inkOnly(d, w, 10);
		expect(box).toEqual({ x: 5, y: 3, w: 8, h: 4 });
		expect(alpha(d, w, 0, 0)).toBe(0);
		expect(alpha(d, w, 8, 4)).toBe(0);
		expect(alpha(d, w, 5, 3)).toBe(255);
		expect(alpha(d, w, 12, 6)).toBe(255);
	});

	it('gives mid-grey edge pixels partial opacity', () => {
		const w = 4;
		const d = paper(w, 4);
		set(d, w, 1, 1, 160); // 82 darker than the paper: an anti-aliased edge
		inkOnly(d, w, 4);
		const a = alpha(d, w, 1, 1);
		expect(a).toBeGreaterThan(0);
		expect(a).toBeLessThan(255);
	});

	it('returns null for a blank picture', () => {
		const d = paper(8, 8);
		expect(inkOnly(d, 8, 8)).toBeNull();
		expect(alpha(d, 8, 3, 3)).toBe(0);
	});
});
