import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// Use a properly formatted placeholder at build time; queries will fail naturally if DATABASE_URL
// is not set, but the app can compile without a live database.
const url =
  process.env.DATABASE_URL ??
  'postgresql://placeholder:placeholder@ep-build-placeholder.us-east-2.aws.neon.tech/foyer';

const sql = neon(url);
export const db = drizzle(sql, { schema });
