import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.local)");

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  ssl: { rejectUnauthorized: false },
});
