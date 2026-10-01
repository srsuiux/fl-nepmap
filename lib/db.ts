import pg from "pg";

// Reuse one pool across Next.js hot reloads.
const g = globalThis as unknown as { __pool?: pg.Pool };

export const pool =
  g.__pool ??
  (g.__pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    ssl: { rejectUnauthorized: false },
  }));
