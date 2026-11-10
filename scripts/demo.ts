// `npm run demo`: fills the demo database with made-up players, then starts the dev server against it.
import { spawn } from "node:child_process";

const url = process.env.DEMO_DATABASE_URL;
if (!url) {
  console.error("DEMO_DATABASE_URL is not set. Run `vercel env pull .env.local` (see README).");
  process.exit(1);
}
process.env.DATABASE_URL = url;
await import("./seed-demo.ts");
spawn("npx", ["next", "dev", ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
