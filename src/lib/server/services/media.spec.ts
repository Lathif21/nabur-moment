import { describe, expect, it } from 'vitest';
import { ServiceError } from './errors';
import { imageSources, mediaKeys, parseEmbed } from './media';

describe('parseEmbed', () => {
	it.each([
		[
			'https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=abc',
			'instagram',
			'https://www.instagram.com/reel/C1a2B3c4D5e/'
		],
		['https://instagram.com/p/XyZ_123/', 'instagram', 'https://www.instagram.com/p/XyZ_123/'],
		[
			'https://www.tiktok.com/@naburmoment/video/7300000000000000000?lang=id',
			'tiktok',
			'https://www.tiktok.com/@naburmoment/video/7300000000000000000'
		],
		['https://youtu.be/dQw4w9WgXcQ?si=x', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
		[
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
			'youtube',
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
		],
		[
			'https://youtube.com/shorts/abcDEF12345',
			'youtube',
			'https://www.youtube.com/watch?v=abcDEF12345'
		]
	])('%s → %s', (raw, provider, url) => {
		expect(parseEmbed(raw)).toEqual({ provider, url });
	});

	it.each([
		'bukan tautan',
		'http://youtu.be/abc',
		'https://vimeo.com/123',
		'https://instagram.com/naburmoment'
	])('refuses %s', (raw) => {
		expect(() => parseEmbed(raw)).toThrow(ServiceError);
	});
});

describe('media helpers', () => {
	it('lists every key once', () => {
		expect(
			mediaKeys({
				key: 'm/1/w960.webp',
				posterKey: null,
				variants: [
					{ w: 480, key: 'm/1/w480.webp' },
					{ w: 960, key: 'm/1/w960.webp' }
				]
			})
		).toEqual(['m/1/w960.webp', 'm/1/w480.webp']);
	});

	it('builds src + srcset from the renditions', () => {
		const s = imageSources(
			{ publicUrl: (k) => `https://cdn/site-media/${k}` },
			{
				variants: [
					{ w: 480, key: 'a.webp' },
					{ w: 960, key: 'b.webp' }
				],
				width: 960,
				height: 640
			}
		);
		expect(s).toEqual({
			src: 'https://cdn/site-media/b.webp',
			srcset: 'https://cdn/site-media/a.webp 480w, https://cdn/site-media/b.webp 960w',
			width: 960,
			height: 640
		});
	});
});
