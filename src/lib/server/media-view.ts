// Shapes media rows for the admin UI (public URLs from the bucket client).
import { embedThumb } from '#lib/media/embed.ts';
import type { MediaItem } from '#lib/media/types.ts';
import type { listMedia } from './services/media.ts';
import type { FileStorage } from './storage/files.ts';

type Row = Awaited<ReturnType<typeof listMedia>>[number];

export function toMediaItem(row: Row, storage: Pick<FileStorage, 'publicUrl'>): MediaItem {
	const url = (k: string | null) => (k ? storage.publicUrl(k) : null);
	// Grid preview: the first rendition of at least 480 px, else the largest
	const thumbVariant = row.variants.find((v) => v.w >= 480) ?? row.variants.at(-1);
	// Embeds: the uploaded cover, else the provider's still (YouTube only, `poster` holds its
	// low-res fallback)
	const still =
		row.kind !== 'embed'
			? null
			: row.posterKey
				? { src: storage.publicUrl(row.posterKey), fallback: null }
				: embedThumb(row.embedProvider, row.embedUrl);
	return {
		id: row.id,
		kind: row.kind,
		filename: row.filename,
		thumb:
			row.kind === 'image'
				? url(thumbVariant?.key ?? null)
				: row.kind === 'video'
					? url(row.posterKey)
					: (still?.src ?? null),
		src: row.kind === 'embed' ? row.embedUrl : url(row.key),
		srcset:
			row.kind === 'image'
				? row.variants.map((v) => `${storage.publicUrl(v.key)} ${v.w}w`).join(', ')
				: null,
		poster: still ? still.fallback : url(row.posterKey),
		width: row.width,
		height: row.height,
		durationS: row.durationS,
		bytes: row.bytes,
		alt: row.alt,
		focalX: row.focalX,
		focalY: row.focalY,
		embedProvider: row.embedProvider,
		embedUrl: row.embedUrl,
		coverUploaded: row.kind === 'embed' && !!row.posterKey,
		usage: row.usage,
		createdAt: row.createdAt.toISOString()
	};
}
