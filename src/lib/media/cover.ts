// Album covers on the site (client-safe): any media item that has a picture can be a cover.
import type { MediaItem } from './types.ts';

export type Picture = {
	src: string;
	srcset: string | null;
	/** Tried when `src` fails to load (YouTube HD stills are missing on old uploads) */
	fallback: string | null;
	width: number | null;
	height: number | null;
	focalX: number;
	focalY: number;
};

/** The still image of a media item: the photo, a video's poster frame, an embed's thumbnail */
export function pictureOf(m: MediaItem | null | undefined): Picture | null {
	if (!m) return null;
	const base = { width: m.width, height: m.height, focalX: m.focalX, focalY: m.focalY };
	if (m.kind === 'image') {
		const src = m.thumb ?? m.src;
		return src ? { ...base, src, srcset: m.srcset, fallback: null } : null;
	}
	if (m.kind === 'video')
		return m.poster ? { ...base, src: m.poster, srcset: null, fallback: null } : null;
	return m.thumb ? { ...base, src: m.thumb, srcset: null, fallback: m.poster } : null;
}

/**
 * The media id an album shows as its cover: the chosen cover when it has a picture, else the
 * first item that has one (a photo, a video poster, a YouTube still). Null when none has.
 */
export function albumCoverId(
	album: { cover: string | null; items: { media: string }[] },
	media: Record<string, MediaItem>
): string | null {
	for (const id of [album.cover, ...album.items.map((i) => i.media)]) {
		if (id && pictureOf(media[id])) return id;
	}
	return null;
}
