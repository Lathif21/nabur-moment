import { describe, expect, it } from 'vitest';
import { plannedWidths } from './upload.ts';

describe('plannedWidths', () => {
	it('makes every standard width below the original, plus the original', () => {
		expect(plannedWidths(1200)).toEqual([480, 960, 1200]);
		expect(plannedWidths(300)).toEqual([300]);
		expect(plannedWidths(480)).toEqual([480]);
	});

	it('caps at 2400 for big photos', () => {
		expect(plannedWidths(6000)).toEqual([480, 960, 1600, 2400]);
		expect(plannedWidths(2400)).toEqual([480, 960, 1600, 2400]);
	});
});
