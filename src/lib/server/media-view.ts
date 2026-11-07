// Shapes media rows for the admin UI (public URLs from the bucket client).
import type { MediaItem } from '#lib/media/types.ts';
import type { listMedia } from './services/media.ts';
import type { FileStorage } from './storage/files.ts';

type Row = Awaited<ReturnType<typeof listMedia>>[number];

export function toMediaItem(row: Row, storage: Pick<FileStorage, 'publicUrl'>): MediaItem {
	const url = (k: string | null) => (k ? storage.publicUrl(k) : null);
	// Grid preview: the first rendition of at least 480 px, else the largest
	const thumbVariant = row.variants.find((v) => v.w >= 480) ?? row.variants.at(-1);
	return {
		id: row.id,
		kind: row.kind,
		filename: row.filename,
		thumb:
			row.kind === 'image'
				? url(thumbVariant?.key ?? null)
				: row.kind === 'video'
					? url(row.posterKey)
					: null,
		src: row.kind === 'embed' ? row.embedUrl : url(row.key),
		srcset:
			row.kind === 'image'
				? row.variants.map((v) => `${storage.publicUrl(v.key)} ${v.w}w`).join(', ')
				: null,
		poster: url(row.posterKey),
		width: row.width,
		height: row.height,
		durationS: row.durationS,
		bytes: row.bytes,
		alt: row.alt,
		focalX: row.focalX,
		focalY: row.focalY,
		embedProvider: row.embedProvider,
		embedUrl: row.embedUrl,
		usage: row.usage,
		createdAt: row.createdAt.toISOString()
	};
}
