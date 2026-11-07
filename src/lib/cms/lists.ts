// CMS lists (packages + add-ons, testimonials, FAQ; portfolio arrives in P1-07): the shapes
// published into `list_publish` and read by the public site. Client-safe; relative imports only.

export const LISTS = ['packages', 'testimonials', 'faq'] as const;
export type ListKey = (typeof LISTS)[number];

export type FaqSnapshot = { id: string; question: string; answer: string }[];

export type TestimonialSnapshot = {
	id: string;
	name: string;
	quote: string;
	eventLabel: string;
	/** Media id */
	photo: string | null;
}[];

export type PackageCard = {
	id: string;
	name: string;
	price: number;
	inclusions: string[];
	note: string;
	/** Media id */
	image: string | null;
	featured: boolean;
};

export type PackagesSnapshot = {
	/** Only categories with at least one visible package */
	categories: { id: string; name: string; packages: PackageCard[] }[];
	/** Add-ons that are active and shown on the site */
	addons: { id: string; name: string; price: number; description: string }[];
};

export type ListSnapshots = {
	packages: PackagesSnapshot;
	testimonials: TestimonialSnapshot;
	faq: FaqSnapshot;
};

export const EMPTY: ListSnapshots = {
	packages: { categories: [], addons: [] },
	testimonials: [],
	faq: []
};

/** Public paths that show each list (revalidated after Terbitkan) */
export const LIST_PATHS: Record<ListKey, string[]> = {
	packages: ['paket', ''],
	testimonials: [''],
	faq: ['faq']
};

/** "Paragraf satu\n\nParagraf dua" → paragraphs */
export function paragraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
}
