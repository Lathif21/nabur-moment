// Shared PDF pieces (P3-03, 06-DESIGN-SYSTEM → PDF): fonts in pdfmake's in-memory file system,
// brand colours, the forest header band with the cream wordmark, the contacts footer.
// Pattern from the Befisien CRM invoice PDF.
import pdfmake from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import openSans400 from '@fontsource/open-sans/files/open-sans-latin-400-normal.woff?inline';
import openSans600 from '@fontsource/open-sans/files/open-sans-latin-600-normal.woff?inline';
import openSans400i from '@fontsource/open-sans/files/open-sans-latin-400-italic.woff?inline';
import playfair400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff?inline';
import playfair600 from '@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff?inline';
import { phoneDisplay } from '../../format.ts';
import type { AppSettings } from '../services/app-settings.ts';

/** Colours from 06-DESIGN-SYSTEM (a PDF cannot read the CSS variables) */
export const C = {
	forest: '#113231',
	olive: '#697655',
	cream: '#FBF6EA',
	/** sage at 20% on white, as --color-sage-20 */
	sage20: '#F0F1EE',
	line: '#B2B7AB',
	ink: '#113231',
	ink2: '#4D5E5A',
	danger: '#A3352C',
	success: '#2E6B3F'
};

// Fonts are bundled into the server build as data URLs (?inline), so nothing is read from disk at
// request time and the Vercel function needs no extra files.
type VirtualFs = { writeFileSync(name: string, data: Buffer): void };
// `sharedVirtualfs` since pdfmake 0.3.13 (`virtualfs` before)
const pm = pdfmake as unknown as { sharedVirtualfs?: VirtualFs; virtualfs?: VirtualFs };
const vfs = (pm.sharedVirtualfs ?? pm.virtualfs)!;
const fromDataUrl = (url: string) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
vfs.writeFileSync('opensans-400.woff', fromDataUrl(openSans400));
vfs.writeFileSync('opensans-600.woff', fromDataUrl(openSans600));
vfs.writeFileSync('opensans-400i.woff', fromDataUrl(openSans400i));
vfs.writeFileSync('playfair-400.woff', fromDataUrl(playfair400));
vfs.writeFileSync('playfair-600.woff', fromDataUrl(playfair600));
pdfmake.setFonts({
	OpenSans: {
		normal: 'opensans-400.woff',
		bold: 'opensans-600.woff',
		italics: 'opensans-400i.woff',
		bolditalics: 'opensans-600.woff'
	},
	Playfair: {
		normal: 'playfair-400.woff',
		bold: 'playfair-600.woff',
		italics: 'playfair-400.woff',
		bolditalics: 'playfair-600.woff'
	}
});
// Documents never load anything from the network or the disk
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => false);

export const PAGE_WIDTH = 595.28; // A4 in points
const BAND = 104;

/** Forest band across the top of every page */
export const background: TDocumentDefinitions['background'] = () => ({
	canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE_WIDTH, h: BAND, color: C.forest }]
});

/** Cream wordmark (the site's typeset logo: NABUR wide-tracked serif, MOMENT tracked sans) */
export const wordmark = {
	stack: [
		{
			text: 'NABUR',
			font: 'Playfair',
			fontSize: 24,
			characterSpacing: 7,
			color: C.cream,
			alignment: 'center'
		},
		{
			text: 'MOMENT',
			fontSize: 7,
			characterSpacing: 4.5,
			color: C.cream,
			alignment: 'center',
			margin: [0, 2, 0, 0]
		}
	],
	width: 130
} as Content; // a column: the typings leave `width` off ContentStack

/** The band's content: wordmark left, document title and number right */
export function bandHeader(title: string, number: string): Content {
	return {
		columns: [
			wordmark,
			{ width: '*', text: '' },
			{
				width: 'auto',
				stack: [
					{
						text: title,
						font: 'Playfair',
						fontSize: 22,
						color: C.cream,
						alignment: 'right',
						characterSpacing: 2
					},
					{ text: number, fontSize: 10, color: C.cream, alignment: 'right', margin: [0, 2, 0, 0] }
				]
			}
		],
		margin: [0, -88, 0, 46]
	};
}

export const label = (text: string): Content => ({
	text: text.toUpperCase(),
	fontSize: 7.5,
	bold: true,
	color: C.ink2,
	characterSpacing: 0.8,
	margin: [0, 0, 0, 3]
});

/** Drops missing optional lines (an empty string would still take a line in pdfmake) */
export const compact = (items: (Content | false | null | undefined | '')[]): Content[] =>
	items.filter((c): c is Content => Boolean(c));

export function contactLine(s: AppSettings): string {
	return [
		s.businessName,
		s.address,
		s.phone && `WA ${phoneDisplay(s.phone)}`,
		s.email,
		s.instagram && `@${s.instagram}`
	]
		.filter(Boolean)
		.join(' · ');
}

export const footer =
	(s: AppSettings): TDocumentDefinitions['footer'] =>
	(page, pages) => ({
		margin: [40, 18, 40, 0],
		columns: [
			{ text: contactLine(s), fontSize: 7.5, color: C.ink2, width: '*' },
			{ text: `${page} / ${pages}`, fontSize: 7.5, color: C.ink2, width: 'auto' }
		]
	});

export const baseDocument = (s: AppSettings, title: string): Partial<TDocumentDefinitions> => ({
	pageSize: 'A4',
	pageMargins: [40, 104, 40, 60],
	background,
	footer: footer(s),
	defaultStyle: { font: 'OpenSans', fontSize: 9.5, color: C.ink, lineHeight: 1.25 },
	info: { title, author: s.businessName, creator: s.businessName }
});

/** Thin rules between table rows, none on the outside */
export const tableLayout = {
	hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
		i === 0 || i === node.table.body.length ? 0 : 0.5,
	vLineWidth: () => 0,
	hLineColor: () => C.line,
	paddingTop: () => 6,
	paddingBottom: () => 6,
	paddingLeft: () => 4,
	paddingRight: () => 4
};

/** `INV/NM/2026/11/001` → `INV-NM-2026-11-001.pdf` */
export function pdfFileName(number: string): string {
	return `${number.replace(/[^\w-]+/g, '-')}.pdf`;
}

export function render(doc: TDocumentDefinitions): Promise<Buffer> {
	return pdfmake.createPdf(doc).getBuffer();
}

/** A bill line: the description, and what it includes as a small list under it */
export function itemCell(it: { description: string; details?: string[] }): Content {
	if (!it.details?.length) return { text: it.description };
	return {
		stack: [
			{ text: it.description },
			{ ul: it.details, fontSize: 8.5, color: C.ink2, margin: [0, 3, 0, 0] }
		]
	};
}
