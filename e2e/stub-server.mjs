import http from "node:http";
const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
http.createServer((req, res) => {
  if (req.url.startsWith("/family.ics")) {
    const t = new Date(); t.setUTCHours(t.getUTCHours() + 26, 0, 0, 0);
    const e = new Date(t.getTime() + 3600e3);
    res.setHeader("Content-Type", "text/calendar");
    return res.end(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//EN",
      "BEGIN:VEVENT", "UID:dentist-1", `DTSTART:${stamp(t)}`, `DTEND:${stamp(e)}`, "SUMMARY:Dentist appointment", "END:VEVENT",
      "BEGIN:VEVENT", "UID:soccer-1", `DTSTART:${stamp(new Date(t.getTime() + 2 * 3600e3))}`, `DTEND:${stamp(new Date(t.getTime() + 3 * 3600e3))}`, "RRULE:FREQ=WEEKLY;COUNT=4", "SUMMARY:Soccer practice", "END:VEVENT",
      "END:VCALENDAR"].join("\r\n"));
  }
  console.log(req.url, req.headers["user-agent"]);
  const tulsa = req.url.includes("36.1540,-95.9930");
  res.setHeader("Content-Type", "application/geo+json");
  res.end(JSON.stringify({ features: tulsa ? [
    { properties: { id: "urn:oid:test.tornado.1", event: "Tornado Warning", severity: "Extreme", headline: "Tornado Warning issued for Tulsa County", ends: new Date(Date.now() + 3600e3).toISOString(), areaDesc: "Tulsa, OK" } },
    { properties: { id: "urn:oid:test.wind.1", event: "Wind Advisory", severity: "Moderate", headline: "Wind Advisory", expires: new Date(Date.now() + 3600e3).toISOString(), areaDesc: "Tulsa, OK" } },
  ] : [] }));
}).listen(4555);
