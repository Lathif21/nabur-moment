// Client feedback 12 Nov 2026: admin booking / session types without Lamaran, "Full Wedding" in
// the admin; the website (booking form, portfolio) keeps Lamaran and "Wedding".
import { describe, expect, it } from 'vitest';
import {
	ADMIN_EVENT_LABEL,
	BOOKING_EVENT_TYPES,
	EVENT_TYPE_LABEL,
	EVENT_TYPES,
	bookingEventTypes
} from './crm.ts';

describe('admin event types', () => {
	it('offers Full Wedding first and no Lamaran', () => {
		expect(BOOKING_EVENT_TYPES[0]).toEqual({ key: 'wedding', label: 'Full Wedding' });
		expect(BOOKING_EVENT_TYPES.map((e) => e.key)).not.toContain('lamaran');
		expect(ADMIN_EVENT_LABEL.wedding).toBe('Full Wedding');
	});

	it('leaves the website wording alone', () => {
		expect(EVENT_TYPE_LABEL.wedding).toBe('Wedding');
		expect(EVENT_TYPES.map((e) => e.key)).toContain('lamaran');
	});

	it('keeps Lamaran selectable on a booking that already has it', () => {
		expect(bookingEventTypes('akad')).toBe(BOOKING_EVENT_TYPES);
		expect(bookingEventTypes(null)).toBe(BOOKING_EVENT_TYPES);
		expect(bookingEventTypes('lamaran').at(-1)).toEqual({ key: 'lamaran', label: 'Lamaran' });
		expect(bookingEventTypes('nope')).toBe(BOOKING_EVENT_TYPES);
	});
});
