import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";

export interface Database {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export function createDatabase(databaseUrl: string): Pool {
  const config: PoolConfig = {
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: 20,
  };
  return new Pool(config);
}
