import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Open database (creates file if missing)
const sqlite = new Database("kiryana.db");

// Apply performance PRAGMAs (run once at startup)
sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA cache_size = -8000;   -- 8 MB
  PRAGMA temp_store = MEMORY;
  PRAGMA mmap_size = 268435456; -- 256 MB
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

export const db = drizzle(sqlite);
export { sqlite };