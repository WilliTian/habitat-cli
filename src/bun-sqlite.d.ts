declare module "bun:sqlite" {
  export type SqliteRunResult = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  export class Database {
    constructor(path: string);
    exec(sql: string): void;
    query<T = unknown>(sql: string): Statement<T>;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
  }

  export class Statement<T = unknown> {
    run(...params: unknown[]): SqliteRunResult;
    get(...params: unknown[]): T | undefined;
    all(...params: unknown[]): T[];
  }
}
