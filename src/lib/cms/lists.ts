// CMS lists (portfolio, packages + add-ons, testimonials, FAQ): the shapes
// published into `list_publish` and read by the public site. Client-safe; relative imports only.

export const LISTS = ['portfolio', 'packages', 'testimonials', 'faq'] as const;
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
	/** "Harga normal" shown struck through; only present when higher than `price` */
	normalPrice?: number;
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

/** One published album: what /portofolio and /portofolio/[slug] show */
export type PublishedAlbum = {
	id: string;
	slug: string;
	title: string;
	eventType: string;
	/** yyyy-MM-dd */
	eventDate: string | null;
	venue: string;
	city: string;
	story: string;
	/** Media id */
	cover: string | null;
	items: { media: string; caption: string }[];
};

export type PortfolioSnapshot = PublishedAlbum[];

export type ListSnapshots = {
	portfolio: PortfolioSnapshot;
	packages: PackagesSnapshot;
	testimonials: TestimonialSnapshot;
	faq: FaqSnapshot;
};

export const EMPTY: ListSnapshots = {
	portfolio: [],
	packages: { categories: [], addons: [] },
	testimonials: [],
	faq: []
};

/** Public paths that show each list (revalidated after Terbitkan) */
export const LIST_PATHS: Record<ListKey, string[]> = {
	// Album pages are added per slug at publish time
	portfolio: ['portofolio', '', 'sitemap.xml'],
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
