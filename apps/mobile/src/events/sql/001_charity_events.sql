-- Charity live events. One row per event. The revision makes a score post atomic:
-- an update lands only when the revision the writer read is still current.
-- Run apps/mobile/scripts/event-store-migrate.ts before a hosted event.

CREATE TABLE IF NOT EXISTS coopr_charity_events (
  code text PRIMARY KEY,
  revision bigint NOT NULL,
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
