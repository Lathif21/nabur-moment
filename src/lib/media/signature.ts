// Signature (ttd) upload, browser side: a photo or scan of a signature on paper becomes a trimmed
// PNG with a transparent background, so it sits cleanly on the invoice. The pixel work is pure
// (`inkOnly`) and unit-tested; `prepareSignature` and `uploadSignature` need a browser.

/** Widest PNG kept (≈ 3× the 150 pt it prints at) */
export const SIGNATURE_MAX_WIDTH = 900;
/** Pixels this much darker than the paper count as ink */
const INK_THRESHOLD = 48;

export type Box = { x: number; y: number; w: number; h: number };

/**
 * Keep the ink, drop the paper: pixels close to the paper colour (the brightest corner) become
 * transparent, darker ones become dark ink whose opacity follows how dark they are (smooth
 * edges). Mutates `data` (RGBA). Returns the box around the ink, or null when there is none.
 */
export function inkOnly(data: Uint8ClampedArray, width: number, height: number): Box | null {
	const lum = (i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
	const corners = [0, width - 1, (height - 1) * width, height * width - 1].map((p) => lum(p * 4));
	const paper = Math.max(...corners);
	let x0 = width;
	let y0 = height;
	let x1 = -1;
	let y1 = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const dark = paper - lum(i);
			if (dark < INK_THRESHOLD || data[i + 3] === 0) {
				data[i + 3] = 0;
				continue;
			}
			// 35% at the threshold rising to full opacity at twice it (smooth stroke edges)
			data[i + 3] = Math.round(
				255 * Math.min(1, 0.35 + (0.65 * (dark - INK_THRESHOLD)) / INK_THRESHOLD)
			);
			data[i] = Math.min(data[i], 40);
			data[i + 1] = Math.min(data[i + 1], 40);
			data[i + 2] = Math.min(data[i + 2], 40);
			if (x < x0) x0 = x;
			if (x > x1) x1 = x;
			if (y < y0) y0 = y;
			if (y > y1) y1 = y;
		}
	}
	return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** File → trimmed transparent PNG (at most SIGNATURE_MAX_WIDTH wide) */
export async function prepareSignature(file: File): Promise<Blob> {
	if (!file.type.startsWith('image/')) throw new Error(`${file.name}: pilih file gambar.`);
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		throw new Error(`${file.name}: format gambar tidak bisa dibaca peramban ini.`);
	}
	// Work at ≤ 2000 px on the long side: enough detail, bounded memory on phones
	const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
	const w = Math.max(1, Math.round(bitmap.width * scale));
	const h = Math.max(1, Math.round(bitmap.height * scale));
	const work = document.createElement('canvas');
	work.width = w;
	work.height = h;
	const ctx = work.getContext('2d', { willReadFrequently: true })!;
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();
	const img = ctx.getImageData(0, 0, w, h);
	const box = inkOnly(img.data, w, h);
	if (!box)
		throw new Error('Tanda tangan tidak terlihat. Pakai foto tinta gelap di kertas terang.');
	ctx.putImageData(img, 0, 0);

	const pad = Math.round(Math.max(box.w, box.h) * 0.04);
	const sx = Math.max(0, box.x - pad);
	const sy = Math.max(0, box.y - pad);
	const sw = Math.min(w - sx, box.w + 2 * pad);
	const sh = Math.min(h - sy, box.h + 2 * pad);
	const out = document.createElement('canvas');
	const k = Math.min(1, SIGNATURE_MAX_WIDTH / sw);
	out.width = Math.max(1, Math.round(sw * k));
	out.height = Math.max(1, Math.round(sh * k));
	const octx = out.getContext('2d')!;
	octx.imageSmoothingQuality = 'high';
	octx.drawImage(work, sx, sy, sw, sh, 0, 0, out.width, out.height);
	return new Promise((resolve, reject) =>
		out.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat PNG.'))), 'image/png')
	);
}

/** Straight to the private bucket with a presigned PUT, then the server switches to it */
export async function uploadSignature(blob: Blob, base: string) {
	const call = async <T>(init: RequestInit): Promise<T> => {
		const res = await fetch(base, {
			...init,
			headers: { 'content-type': 'application/json', accept: 'application/json' }
		});
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			throw new Error(body?.message ?? `Gagal (${res.status}).`);
		}
		return res.json();
	};
	const target = await call<{ key: string; url: string; headers: Record<string, string> }>({
		method: 'POST'
	});
	const put = await fetch(target.url, { method: 'PUT', body: blob, headers: target.headers });
	if (!put.ok) throw new Error(`Unggahan gagal (${put.status}).`);
	await call({ method: 'PUT', body: JSON.stringify({ key: target.key }) });
}
