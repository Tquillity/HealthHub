import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 config - datasource URL must be in prisma.config.ts, not schema.prisma
// Load .env file explicitly for Prisma CLI commands
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Schema changes ship as migration files. See docs/database-migrations.md.
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
