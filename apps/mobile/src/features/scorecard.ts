import { sqlite } from '../db/client';
import { newId } from '../lib/id';
import { enqueueOutbox } from '../db/sync';

// Fast, offline scorecard. Rounds + per-hole scores live in local SQLite and enqueue for
// sync. Nothing beyond strokes is required to move on — everything else is optional.

export interface RoundSummary {
  id: string;
  courseName: string | null;
  date: number;
  status: string;
  holes: number;
  holesPlayed: number;
  totalStrokes: number;
  toPar: number; // over played holes
}

export interface HoleScore {
  hole: number;
  par: number;
  strokes: number | null;
  putts: number | null;
  fairway: string | null; // hit | left | right | null
  gir: number | null; // 0/1
}

export function getActiveRound(userId: string): { id: string; courseName: string | null; holes: number } | null {
  const r = sqlite.getFirstSync<{ id: string; course_name: string | null }>(
    "SELECT id, course_name FROM rounds WHERE user_id = ? AND status = 'in_progress' AND deleted_at IS NULL ORDER BY date DESC LIMIT 1;",
    [userId],
  );
  if (!r) return null;
  const c = sqlite.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM hole_scores WHERE round_id = ? AND deleted_at IS NULL;', [r.id]);
  return { id: r.id, courseName: r.course_name, holes: c?.n ?? 18 };
}

export function startRound(userId: string, courseName: string, holes: number): string {
  const now = Date.now();
  const id = newId();
  sqlite.withTransactionSync(() => {
    sqlite.runSync(
      `INSERT INTO rounds (id, user_id, course_id, course_name, tees, date, status, created_at, updated_at, deleted_at)
       VALUES (?, ?, NULL, ?, NULL, ?, 'in_progress', ?, ?, NULL);`,
      [id, userId, courseName.trim() || null, now, now, now],
    );
    enqueueOutbox('rounds', id, 'upsert', now);
    for (let h = 1; h <= holes; h++) {
      const hid = newId();
      sqlite.runSync(
        `INSERT INTO hole_scores (id, round_id, hole, par, strokes, putts, penalties, fairway, gir, bunker, notes, clubs_used, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, NULL);`,
        [hid, id, h, now, now],
      );
      enqueueOutbox('hole_scores', hid, 'upsert', now);
    }
  });
  return id;
}

export function getHoles(roundId: string): HoleScore[] {
  return sqlite.getAllSync<HoleScore>(
    'SELECT hole, par, strokes, putts, fairway, gir FROM hole_scores WHERE round_id = ? AND deleted_at IS NULL ORDER BY hole ASC;',
    [roundId],
  );
}

export function saveHole(
  roundId: string,
  hole: number,
  patch: Partial<Pick<HoleScore, 'par' | 'strokes' | 'putts' | 'fairway' | 'gir'>>,
): void {
  const now = Date.now();
  const row = sqlite.getFirstSync<{ id: string }>('SELECT id FROM hole_scores WHERE round_id = ? AND hole = ? AND deleted_at IS NULL;', [roundId, hole]);
  if (!row) return;
  const fields: string[] = [];
  const vals: Array<number | string | null> = [];
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`);
    vals.push(v as number | string | null);
  }
  if (fields.length === 0) return;
  vals.push(now, row.id);
  sqlite.runSync(`UPDATE hole_scores SET ${fields.join(', ')}, updated_at = ? WHERE id = ?;`, vals);
  enqueueOutbox('hole_scores', row.id, 'upsert', now);
}

export function finishRound(roundId: string): void {
  const now = Date.now();
  sqlite.runSync("UPDATE rounds SET status = 'completed', updated_at = ? WHERE id = ?;", [now, roundId]);
  enqueueOutbox('rounds', roundId, 'upsert', now);
}

export function listRecentRounds(userId: string, limit = 10): RoundSummary[] {
  const rounds = sqlite.getAllSync<{ id: string; course_name: string | null; date: number; status: string }>(
    'SELECT id, course_name, date, status FROM rounds WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC LIMIT ?;',
    [userId, limit],
  );
  return rounds.map((r) => {
    const agg = sqlite.getFirstSync<{ holes: number; played: number; strokes: number | null; par: number | null }>(
      `SELECT COUNT(*) AS holes,
              SUM(CASE WHEN strokes IS NOT NULL THEN 1 ELSE 0 END) AS played,
              SUM(strokes) AS strokes,
              SUM(CASE WHEN strokes IS NOT NULL THEN par ELSE 0 END) AS par
       FROM hole_scores WHERE round_id = ? AND deleted_at IS NULL;`,
      [r.id],
    );
    return {
      id: r.id, courseName: r.course_name, date: r.date, status: r.status,
      holes: agg?.holes ?? 0, holesPlayed: agg?.played ?? 0,
      totalStrokes: agg?.strokes ?? 0, toPar: (agg?.strokes ?? 0) - (agg?.par ?? 0),
    };
  });
}
