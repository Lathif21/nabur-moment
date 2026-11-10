import { describe, expect, it } from 'vitest';
import { albumCoverId, pictureOf } from './cover.ts';
import type { MediaItem } from './types.ts';

function item(id: string, patch: Partial<MediaItem>): MediaItem {
	return {
		id,
		kind: 'image',
		filename: null,
		thumb: null,
		src: null,
		srcset: null,
		poster: null,
		width: null,
		height: null,
		durationS: null,
		bytes: null,
		alt: '',
		focalX: 0.5,
		focalY: 0.5,
		embedProvider: null,
		embedUrl: null,
		usage: 0,
		createdAt: '2026-11-10T00:00:00.000Z',
		...patch
	};
}

const photo = item('photo', { thumb: 'https://cdn/w480.webp', src: 'https://cdn/w1600.webp' });
const video = item('video', {
	kind: 'video',
	src: 'https://cdn/v.mp4',
	poster: 'https://cdn/p.webp'
});
const youtube = item('yt', {
	kind: 'embed',
	embedProvider: 'youtube',
	thumb: 'https://i.ytimg.com/vi/x/maxresdefault.jpg',
	poster: 'https://i.ytimg.com/vi/x/mqdefault.jpg'
});
const reel = item('reel', { kind: 'embed', embedProvider: 'instagram' });
const media = Object.fromEntries([photo, video, youtube, reel].map((m) => [m.id, m]));

describe('pictureOf', () => {
	it('uses the photo, the video poster or the embed still', () => {
		expect(pictureOf(photo)?.src).toBe('https://cdn/w480.webp');
		expect(pictureOf(video)?.src).toBe('https://cdn/p.webp');
		expect(pictureOf(youtube)).toMatchObject({
			src: 'https://i.ytimg.com/vi/x/maxresdefault.jpg',
			fallback: 'https://i.ytimg.com/vi/x/mqdefault.jpg'
		});
	});

	it('has none for an embed without a still, or a missing item', () => {
		expect(pictureOf(reel)).toBeNull();
		expect(pictureOf(undefined)).toBeNull();
	});
});

describe('albumCoverId', () => {
	const items = (...ids: string[]) => ids.map((media) => ({ media }));

	it('keeps a chosen cover that has a picture', () => {
		expect(albumCoverId({ cover: 'video', items: items('photo', 'video') }, media)).toBe('video');
	});

	it('falls back to the first item with a picture', () => {
		expect(albumCoverId({ cover: 'reel', items: items('reel', 'yt', 'photo') }, media)).toBe('yt');
		expect(albumCoverId({ cover: null, items: items('reel', 'photo') }, media)).toBe('photo');
		expect(albumCoverId({ cover: 'gone', items: items('video') }, media)).toBe('video');
	});

	it('is null when nothing in the album has a picture', () => {
		expect(albumCoverId({ cover: 'reel', items: items('reel') }, media)).toBeNull();
		expect(albumCoverId({ cover: null, items: [] }, media)).toBeNull();
	});
});
