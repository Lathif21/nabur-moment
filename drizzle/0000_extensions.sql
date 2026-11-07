-- Trigram index for client name search (docs/02-DATA-MODEL.md → Indexes), used from P2-01.
-- gen_random_uuid() is built into Postgres 13+, so no pgcrypto is needed.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
