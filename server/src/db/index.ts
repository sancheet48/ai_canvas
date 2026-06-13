import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/whiteboard'
});

// For admin diagnostics: store the last 100 queries for profiling
export interface QueryMetric {
  query: string;
  duration: number;
  timestamp: number;
}

export const queryHistory: QueryMetric[] = [];

export function logQueryMetrics(query: string, duration: number) {
  queryHistory.push({ query, duration, timestamp: Date.now() });
  if (queryHistory.length > 100) {
    queryHistory.shift();
  }
}

export const db = {
  query: async (text: string, params?: any[]) => {
    const start = performance.now();
    try {
      const res = await pool.query(text, params);
      const duration = performance.now() - start;
      logQueryMetrics(text, duration);
      return res;
    } catch (err) {
      const duration = performance.now() - start;
      logQueryMetrics(text, duration);
      throw err;
    }
  },
  getClient: async () => {
    return pool.connect();
  },
  getPool: () => pool,
  getAverageLatency: () => {
    if (queryHistory.length === 0) return 0;
    const total = queryHistory.reduce((sum, q) => sum + q.duration, 0);
    return total / queryHistory.length;
  }
};
