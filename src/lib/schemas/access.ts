// Form schemas for Akses & Peran (P0-06). Messages are UI copy (Bahasa Indonesia).
import { z } from 'zod';
import { CRUD_ACTIONS } from '../permissions.ts';

const MIN_PASSWORD = 8;

/** Optional password: empty = generate one (shown once) */
const optionalPassword = z
	.string()
	.max(128)
	.refine((v) => v === '' || v.length >= MIN_PASSWORD, {
		message: `Kata sandi minimal ${MIN_PASSWORD} karakter.`
	});

export const newUserSchema = z.object({
	name: z.string().trim().min(1, 'Nama wajib diisi.').max(80),
	email: z.email('Email tidak valid.').trim().toLowerCase().max(200),
	password: optionalPassword.default(''),
	roleIds: z.array(z.uuid()).default([])
});

export const resetPasswordSchema = z.object({
	userId: z.string().min(1),
	password: optionalPassword.default('')
});

export const userRolesSchema = z.object({
	userId: z.string().min(1),
	roleIds: z.array(z.uuid()).default([])
});

export const userActiveSchema = z.object({
	userId: z.string().min(1),
	active: z.enum(['true', 'false']).transform((v) => v === 'true')
});

export const roleSchema = z.object({
	name: z.string().trim().min(1, 'Nama peran wajib diisi.').max(60),
	description: z.string().trim().max(200).default('')
});

/** Matrix ticks posted as `grant=module:action` */
export const grantsSchema = z.array(
	z
		.string()
		.regex(/^[a-z_]+:(create|read|update|delete)$/)
		.transform((v) => {
			const [module, action] = v.split(':') as [string, (typeof CRUD_ACTIONS)[number]];
			return { module, action };
		})
);

/** FormData → plain object, with repeated keys (checkboxes) as arrays */
export function formObject(form: FormData, arrays: string[] = []) {
	const out: Record<string, unknown> = {};
	for (const [k, v] of form) {
		if (typeof v !== 'string') continue;
		if (arrays.includes(k)) ((out[k] ??= []) as string[]).push(v);
		else out[k] = v;
	}
	return out;
}

/** First Zod message per field, for inline errors */
export function fieldErrors(issues: z.core.$ZodIssue[]) {
	const out: Record<string, string> = {};
	for (const i of issues) out[String(i.path[0])] ??= i.message;
	return out;
}
