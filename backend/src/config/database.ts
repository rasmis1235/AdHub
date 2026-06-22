import { Pool, PoolClient } from 'pg';
import { config } from './index';
import { logger } from '../utils/logger';

// Railway/Render provide DATABASE_URL; fall back to individual vars for local dev
const poolConfig = config.db.connectionString
  ? {
      connectionString: config.db.connectionString,
      ssl: { rejectUnauthorized: false },
      min: config.db.pool.min,
      max: config.db.pool.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
    }
  : {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
      min: config.db.pool.min,
      max: config.db.pool.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error:', err);
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL connection established');
});

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`Slow query (${duration}ms): ${text.slice(0, 80)}`);
    }
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  } catch (error) {
    logger.error(`Database query error: ${(error as Error).message} | query: ${text.slice(0, 80)}`);
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function testConnection(): Promise<void> {
  try {
    const { rows } = await query<{ now: Date }>('SELECT NOW()');
    logger.info(`Database connected: ${rows[0].now}`);
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}
