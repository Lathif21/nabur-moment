// Click-to-load embeds (docs/04-ARCHITECTURE.md → Media → Embeds). Client-safe.

/** iframe URL for a stored embed (URLs are normalised by parseEmbed on save); null if unknown */
export function embedSrc(provider: string | null, url: string | null): string | null {
	if (!provider || !url) return null;
	let u: URL;
	try {
		u = new URL(url);
	} catch {
		return null;
	}
	if (provider === 'youtube') {
		const id = u.searchParams.get('v');
		// Privacy-enhanced mode: no cookies until the visitor plays
		return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
	}
	if (provider === 'instagram') {
		const m = u.pathname.match(/^\/(p|reel|tv)\/([\w-]+)/);
		return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed` : null;
	}
	if (provider === 'tiktok') {
		const m = u.pathname.match(/\/video\/(\d+)/);
		return m ? `https://www.tiktok.com/embed/v2/${m[1]}` : null;
	}
	return null;
}

/** Vertical players (Reels, TikTok) vs 16:9 (YouTube) */
export function embedAspect(provider: string | null): string {
	return provider === 'youtube' ? '16 / 9' : '9 / 16';
}
