// Browser side of a media upload (docs/04-ARCHITECTURE.md → Media). Images are resized here to
// WebP renditions; videos go up as-is with a poster frame captured here. Files go straight to the
// bucket with presigned PUTs; the app only creates and confirms the upload.
import type { MediaItem } from './types.ts';

export const IMAGE_WIDTHS = [480, 960, 1600, 2400];
const WEBP_QUALITY = 0.82;
const POSTER_MAX_WIDTH = 1280;

export const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/avif,video/mp4';

export type Progress = { loaded: number; total: number };

type Target = { key: string; url: string; headers: Record<string, string> };

/** Widths to make: every standard width smaller than the original, plus the original up to 2400 */
export function plannedWidths(original: number): number[] {
	const out = IMAGE_WIDTHS.filter((w) => w < original);
	if (original <= IMAGE_WIDTHS.at(-1)!) out.push(original);
	return out;
}

async function toWebp(source: CanvasImageSource, w: number, h: number): Promise<Blob> {
	if (typeof OffscreenCanvas !== 'undefined') {
		const canvas = new OffscreenCanvas(w, h);
		const ctx = canvas.getContext('2d')!;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(source, 0, 0, w, h);
		return canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
	}
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, 0, 0, w, h);
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error('WebP tidak didukung peramban ini.'))),
			'image/webp',
			WEBP_QUALITY
		)
	);
}

async function prepareImage(file: File) {
	let bitmap: ImageBitmap;
	try {
		// Respects EXIF rotation from phone cameras
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		throw new Error(`${file.name}: format gambar tidak bisa dibaca peramban ini.`);
	}
	const { width, height } = bitmap;
	const widths = plannedWidths(width);
	const blobs = new Map<number, Blob>();
	for (const w of widths) {
		blobs.set(w, await toWebp(bitmap, w, Math.round((height * w) / width)));
	}
	bitmap.close();
	return {
		body: { kind: 'image' as const, filename: file.name, width, height, variants: widths },
		blobFor: (key: string) => blobs.get(Number(key.match(/\/w(\d+)\.webp$/)?.[1]))
	};
}

async function prepareVideo(file: File) {
	const url = URL.createObjectURL(file);
	try {
		const video = document.createElement('video');
		video.muted = true;
		video.playsInline = true;
		video.preload = 'auto';
		video.src = url;
		await new Promise<void>((resolve, reject) => {
			video.onloadedmetadata = () => resolve();
			video.onerror = () =>
				reject(new Error(`${file.name}: video tidak bisa dibaca. Gunakan MP4 (H.264).`));
		});
		// Poster: a frame a little into the clip (the first frame is often black)
		video.currentTime = Math.min(1, video.duration / 2 || 0);
		await new Promise<void>((resolve) => (video.onseeked = () => resolve()));
		const scale = Math.min(1, POSTER_MAX_WIDTH / video.videoWidth);
		const poster = await toWebp(
			video,
			Math.round(video.videoWidth * scale),
			Math.round(video.videoHeight * scale)
		);
		return {
			body: {
				kind: 'video' as const,
				filename: file.name,
				mime: file.type,
				width: video.videoWidth || undefined,
				height: video.videoHeight || undefined,
				durationS: Number.isFinite(video.duration) ? Math.round(video.duration) : undefined
			},
			blobFor: (key: string) => (key.endsWith('/poster.webp') ? poster : file)
		};
	} finally {
		URL.revokeObjectURL(url);
	}
}

/** PUT with upload progress (fetch cannot report it) */
function put(
	target: Target,
	blob: Blob,
	onProgress: (loaded: number) => void,
	signal?: AbortSignal
) {
	return new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', target.url);
		for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v);
		xhr.upload.onprogress = (e) => onProgress(e.loaded);
		xhr.onload = () =>
			xhr.status >= 200 && xhr.status < 300
				? resolve()
				: reject(new Error(`Unggahan gagal (${xhr.status}).`));
		xhr.onerror = () => reject(new Error('Koneksi terputus saat mengunggah.'));
		xhr.onabort = () => reject(new DOMException('Dibatalkan', 'AbortError'));
		signal?.addEventListener('abort', () => xhr.abort(), { once: true });
		xhr.send(blob);
	});
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		...init,
		headers: { 'content-type': 'application/json', accept: 'application/json' }
	});
	if (!res.ok) {
		const body = await res.json().catch(() => null);
		throw new Error(body?.message ?? `Gagal (${res.status}).`);
	}
	return res.json();
}

/** Longest side of an embed cover (services/media.ts EMBED_COVER_MAX) */
export const EMBED_COVER_MAX = 1600;

/**
 * Uploads a cover picture for an embed (Instagram / TikTok give none) and returns the updated
 * item. The picture becomes one WebP of at most 1600 px. `base` is the resolved
 * `admin/api/media/[id]/cover` path.
 */
export async function uploadEmbedCover(file: File, base: string): Promise<MediaItem> {
	if (!file.type.startsWith('image/')) throw new Error(`${file.name}: pilih file gambar.`);
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		throw new Error(`${file.name}: format gambar tidak bisa dibaca peramban ini.`);
	}
	const scale = Math.min(1, EMBED_COVER_MAX / Math.max(bitmap.width, bitmap.height));
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const blob = await toWebp(bitmap, width, height);
	bitmap.close();

	const target = await api<Target>(base, { method: 'POST' });
	try {
		await put(target, blob, () => {});
	} catch {
		await put(target, blob, () => {});
	}
	return api<MediaItem>(base, {
		method: 'PUT',
		body: JSON.stringify({ key: target.key, width, height })
	});
}

/**
 * Uploads one file to the library and returns the ready item. Each PUT is retried once.
 * `base` is the resolved `admin/api/media` path.
 */
export async function uploadFile(
	file: File,
	base: string,
	onProgress: (p: Progress) => void,
	signal?: AbortSignal
): Promise<MediaItem> {
	const isVideo = file.type === 'video/mp4';
	if (!isVideo && !file.type.startsWith('image/'))
		throw new Error(`${file.name}: hanya gambar atau video MP4.`);

	const prepared = isVideo ? await prepareVideo(file) : await prepareImage(file);
	const { id, uploads } = await api<{ id: string; uploads: Target[] }>(base, {
		method: 'POST',
		body: JSON.stringify(prepared.body)
	});

	const parts = uploads.map((t) => ({ t, blob: prepared.blobFor(t.key)! }));
	const total = parts.reduce((s, p) => s + p.blob.size, 0);
	const loaded = parts.map(() => 0);
	const report = () => onProgress({ loaded: loaded.reduce((a, b) => a + b, 0), total });

	for (const [i, { t, blob }] of parts.entries()) {
		const track = (n: number) => {
			loaded[i] = n;
			report();
		};
		try {
			await put(t, blob, track, signal);
		} catch (e) {
			if ((e as Error).name === 'AbortError') throw e;
			track(0);
			await put(t, blob, track, signal);
		}
		track(blob.size);
	}

	return api<MediaItem>(`${base}/${id}/confirm`, { method: 'POST' });
}
