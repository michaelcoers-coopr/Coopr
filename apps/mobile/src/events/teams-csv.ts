export interface CsvTeam {
  name: string;
  players: string[];
}

export type CsvTeams = { ok: true; teams: CsvTeam[] } | { ok: false; error: string };

function splitLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char ?? '';
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Team name and up to four golfer names. The first golfer is the scorer.
 * A header row is skipped. This is the Jotform export, not a live form connection.
 */
export function parseTeamCsv(text: string): CsvTeams {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, error: 'The file has no teams.' };
  const teams: CsvTeam[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const cells = splitLine(lines[index] ?? '').filter((cell, cellIndex) => cell.length > 0 || cellIndex === 0);
    const name = cells[0] ?? '';
    const players = cells.slice(1).map((cell) => cell.trim()).filter(Boolean);
    if (index === 0 && /^team(\s*name)?$/i.test(name)) continue;
    if (!name) return { ok: false, error: `Row ${index + 1} needs a team name.` };
    if (players.length < 1) return { ok: false, error: `${name} needs at least one golfer.` };
    if (players.length > 4) return { ok: false, error: `${name} has more than 4 golfers.` };
    teams.push({ name, players });
  }
  if (teams.length === 0) return { ok: false, error: 'The file has no teams.' };
  return { ok: true, teams };
}
