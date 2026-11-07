// What the admin UI gets for one media item (client-safe). Built on the server by
// `toMediaItem` in #lib/server/media-view.ts.

export type MediaKind = 'image' | 'video' | 'embed';

export type MediaItem = {
	id: string;
	kind: MediaKind;
	filename: string | null;
	/** Small preview for grids (≈480 px image or the video poster); null for embeds */
	thumb: string | null;
	/** Images: largest rendition; videos: the MP4; embeds: the provider URL */
	src: string | null;
	/** Images only */
	srcset: string | null;
	poster: string | null;
	width: number | null;
	height: number | null;
	durationS: number | null;
	bytes: number | null;
	alt: string;
	focalX: number;
	focalY: number;
	embedProvider: 'instagram' | 'tiktok' | 'youtube' | null;
	embedUrl: string | null;
	/** How many places use it; delete only at 0 */
	usage: number;
	createdAt: string;
};

export const KIND_LABELS: Record<MediaKind, string> = {
	image: 'Gambar',
	video: 'Video',
	embed: 'Embed'
};

export const PROVIDER_LABELS = {
	instagram: 'Instagram',
	tiktok: 'TikTok',
	youtube: 'YouTube'
} as const;

/** "12,4 MB" */
export function fileSize(bytes: number | null): string {
	if (bytes == null) return '';
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
}

/** "1:05" */
export function duration(s: number | null): string {
	if (s == null) return '';
	return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}
