import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  schema: './backend/src/db/schema.ts',
  out: './backend/src/db/migrations',
  dbCredentials: { url: './kiryana.db' },
});
