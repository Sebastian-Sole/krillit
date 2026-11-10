// Creates any missing tables in DATABASE_URL. Runs before every Vercel build; safe to run repeatedly.
import { migrate } from "../src/lib/db.ts";

if (!process.env.DATABASE_URL) {
  console.log("db:migrate skipped: DATABASE_URL is not set.");
} else {
  await migrate();
  console.log("db:migrate done.");
}
