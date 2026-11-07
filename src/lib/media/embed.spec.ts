import { describe, expect, it } from 'vitest';
import { embedSrc } from './embed.ts';

describe('embedSrc', () => {
	it('builds provider iframe URLs from the stored links', () => {
		expect(embedSrc('youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
			'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
		);
		expect(embedSrc('instagram', 'https://www.instagram.com/reel/C1a2B3/')).toBe(
			'https://www.instagram.com/reel/C1a2B3/embed'
		);
		expect(embedSrc('tiktok', 'https://www.tiktok.com/@nabur/video/7300000000000000000')).toBe(
			'https://www.tiktok.com/embed/v2/7300000000000000000'
		);
	});

	it('returns null for anything it does not recognise', () => {
		expect(embedSrc('youtube', 'https://www.youtube.com/')).toBeNull();
		expect(embedSrc('vimeo', 'https://vimeo.com/1')).toBeNull();
		expect(embedSrc(null, null)).toBeNull();
	});
});
