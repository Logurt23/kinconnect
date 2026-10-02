// Pages are rendered on the server, so dates and times follow the family's timezone, not the host's (UTC).
export function register() {
  process.env.TZ = process.env.APP_TIMEZONE || "America/Chicago";
}
