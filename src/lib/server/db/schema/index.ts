// Drizzle schema, one file per area (auth, access, crm, finance, cms). No $env / $lib imports.
// Tables arrive with their tasks: CMS in Phase 1, CRM in P2-01,
// accounting in Phase 3.
export * from './auth.ts';
export * from './access.ts';
export * from './media.ts';
export * from './cms.ts';
export * from './crm.ts';
export * from './portfolio.ts';
