// Drizzle schema, one file per area (auth, access, crm, finance, cms). No $env / $lib imports.
// Tables arrive with their tasks: access control in P0-05, CMS in Phase 1, CRM in P2-01,
// accounting in Phase 3.
export * from './auth.ts';
