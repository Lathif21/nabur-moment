// WhatsApp text through a self-hosted OpenWA gateway (github.com/rmyndharis/OpenWA, REST API):
// POST {OPENWA_URL}/api/sessions/{OPENWA_SESSION_ID}/messages/send-text, header X-API-Key,
// body { chatId: "628…@c.us", text }. Off unless all OPENWA_* variables are set.
import { dev } from '$app/env';
import { OPENWA_API_KEY, OPENWA_NOTIFY_TO, OPENWA_SESSION_ID, OPENWA_URL } from '$app/env/private';
import { phoneNormalize } from '#lib/format.ts';

const TIMEOUT_MS = 8000;

function config() {
	const to = phoneNormalize(OPENWA_NOTIFY_TO);
	if (!OPENWA_URL || !OPENWA_API_KEY || !OPENWA_SESSION_ID || !to) return null;
	const base = OPENWA_URL.replace(/\/+$/, '');
	return {
		url: `${base}/api/sessions/${encodeURIComponent(OPENWA_SESSION_ID)}/messages/send-text`,
		apiKey: OPENWA_API_KEY,
		chatId: `${to}@c.us`
	};
}

/** Send `text` to the owner's WhatsApp. Throws on a gateway error; a no-op when not configured. */
export async function notifyOwner(text: string): Promise<void> {
	const c = config();
	if (!c) {
		if (dev) console.info(`[openwa] OPENWA_* not set, not sent:\n${text}`);
		return;
	}
	const res = await fetch(c.url, {
		method: 'POST',
		headers: { 'X-API-Key': c.apiKey, 'Content-Type': 'application/json' },
		body: JSON.stringify({ chatId: c.chatId, text }),
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`OpenWA ${res.status}: ${(await res.text()).slice(0, 500)}`);
}
