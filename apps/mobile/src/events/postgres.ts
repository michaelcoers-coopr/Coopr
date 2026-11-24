import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import type { EventAdapter, EventRecord } from './adapter';
import type { StoredEvent } from './types';

/**
 * One statement. Neon's HTTP driver sends a single query per call, and this
 * CREATE is safe to run again. The .sql file is the same statement for Mike.
 */
export const CHARITY_EVENTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS coopr_charity_events (
  code text PRIMARY KEY,
  revision bigint NOT NULL,
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim();

export function charitySchemaFile(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'sql', '001_charity_events.sql');
}

function asEvent(value: unknown): StoredEvent {
  if (typeof value === 'string') return JSON.parse(value) as StoredEvent;
  return value as StoredEvent;
}

function revisionOf(value: unknown): number {
  const revision = Number(value);
  return Number.isFinite(revision) ? revision : 0;
}

/**
 * Neon over HTTPS. EAS Hosting recycles the process, so a TCP pool is a poor fit.
 * Each score is one conditional UPDATE, which Postgres applies on its own.
 * The connection string has to be a Neon URL. The driver does not speak to other hosts.
 */
export function createPostgresEventAdapter(databaseUrl: string): EventAdapter {
  const sql = neon(databaseUrl);

  return {
    kind: 'postgres',
    async migrate() {
      await sql.query(CHARITY_EVENTS_SCHEMA);
    },
    async list() {
      const rows = await sql.query('SELECT revision, document FROM coopr_charity_events');
      return rows.map((row) => ({
        event: asEvent(row.document),
        revision: revisionOf(row.revision),
      }));
    },
    async read(code: string) {
      const rows = await sql.query('SELECT revision, document FROM coopr_charity_events WHERE code = $1', [code.trim().toUpperCase()]);
      const row = rows[0];
      if (!row) return null;
      return { event: asEvent(row.document), revision: revisionOf(row.revision) };
    },
    async compareAndSwap(event: StoredEvent, expectedRevision: number | null): Promise<EventRecord | null> {
      const document = JSON.stringify(event);
      if (expectedRevision == null) {
        const rows = await sql.query(
          `INSERT INTO coopr_charity_events (code, revision, document)
           VALUES ($1, 1, $2::jsonb)
           ON CONFLICT (code) DO NOTHING
           RETURNING revision`,
          [event.code, document],
        );
        const row = rows[0];
        if (!row) return null;
        return { event, revision: revisionOf(row.revision) };
      }
      const rows = await sql.query(
        `UPDATE coopr_charity_events
         SET document = $2::jsonb, revision = revision + 1, updated_at = now()
         WHERE code = $1 AND revision = $3
         RETURNING revision`,
        [event.code, document, expectedRevision],
      );
      const row = rows[0];
      if (!row) return null;
      return { event, revision: revisionOf(row.revision) };
    },
  };
}

/** The checked-in SQL file and the statement the host runs are the same table. */
export function schemaFileMatches(): boolean {
  const file = readFileSync(charitySchemaFile(), 'utf8');
  return file.includes(CHARITY_EVENTS_SCHEMA);
}
