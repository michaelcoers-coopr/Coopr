export interface SqlStatement {
  run(...params: Array<string | number | null>): void;
  get(...params: Array<string | number | null>): Record<string, unknown> | undefined;
  all(...params: Array<string | number | null>): Record<string, unknown>[];
}

export interface SqlExecutor {
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
}
