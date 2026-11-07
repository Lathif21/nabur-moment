import { describe, expect, it } from 'vitest';
import { mediaRefs, PAGES, sectionSchema } from './sections.ts';

describe('section registry', () => {
	for (const page of PAGES) {
		for (const s of page.sections) {
			it(`${page.key}.${s.key}: defaults pass the schema unchanged`, () => {
				const parsed = sectionSchema(s).parse(s.defaults);
				expect(parsed).toEqual(s.defaults);
			});
		}
	}

	it('fills missing fields with defaults and enforces limits', () => {
		const hero = PAGES[0].sections[0];
		const parsed = sectionSchema(hero).parse({ headline: 'Halo' });
		expect(parsed).toMatchObject({ headline: 'Halo', media: null, tone: 'mono' });
		expect(() => sectionSchema(hero).parse({ headline: 'x'.repeat(81) })).toThrow();
		expect(() => sectionSchema(hero).parse({ media: 'not-a-uuid' })).toThrow();
	});

	it('refuses links that are not internal, https, mailto or tel', () => {
		const cta = PAGES[0].sections.find((s) => s.key === 'cta')!;
		expect(() =>
			sectionSchema(cta).parse({ button: { label: 'x', href: 'javascript:alert(1)' } })
		).toThrow();
		expect(
			sectionSchema(cta).parse({ button: { label: 'WA', href: 'https://wa.me/628' } })
		).toBeTruthy();
	});

	it('finds media ids in image, images and list fields', () => {
		const team = PAGES.find((p) => p.key === 'about')!.sections.find((s) => s.key === 'team')!;
		const a = '11111111-1111-4111-8111-111111111111';
		const b = '22222222-2222-4222-8222-222222222222';
		expect(mediaRefs(team, { members: [{ photo: a }, { photo: null }, { photo: b }] })).toEqual([
			{ field: 'members.0.photo', mediaId: a },
			{ field: 'members.2.photo', mediaId: b }
		]);
	});

	it('has unique section keys per page', () => {
		for (const p of PAGES) {
			const keys = p.sections.map((s) => s.key);
			expect(new Set(keys).size).toBe(keys.length);
		}
	});
});
