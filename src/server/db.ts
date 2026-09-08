import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
// PostgreSQL DATE is a calendar day, never an instant in the server timezone.
types.setTypeParser(1082, (value) => value);
const globalDb = globalThis as unknown as { dailyPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return (globalDb.dailyPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
  }));
}
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
  client?: PoolClient,
): Promise<T[]> {
  return (await (client ?? getPool()).query<T>(text, values)).rows;
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
