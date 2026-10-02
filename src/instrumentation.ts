// Pages are rendered on the server, so dates and times follow the family's timezone, not the host's (UTC).
export function register() {
  process.env.TZ = process.env.APP_TIMEZONE || "America/Chicago";
  if (process.env.NEXT_RUNTIME === "nodejs") checkEnv();
}

/** Fail at boot, not on the first request that happens to need a missing setting. */
function checkEnv() {
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SITE_URL"].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`KinConnect is missing settings: ${missing.join(", ")}. See .env.example.`);
  const warn = (msg: string) => console.warn(`[kinconnect] ${msg}`);
  if (process.env.TOKEN_ENCRYPTION_KEY && Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64").length !== 32)
    warn("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 (openssl rand -base64 32). Google Calendar won't connect.");
  if (process.env.GOOGLE_CLIENT_ID && !process.env.TOKEN_ENCRYPTION_KEY) warn("GOOGLE_CLIENT_ID is set but TOKEN_ENCRYPTION_KEY isn't. Google Calendar won't connect.");
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) warn("CRON_SECRET is missing or shorter than 32 characters; the weather and calendar sweeps will refuse to run without it.");
}
