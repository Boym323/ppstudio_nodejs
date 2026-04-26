import "dotenv/config";

const requiredKeys = ["MATOMO_URL", "MATOMO_SITE_ID", "MATOMO_AUTH_TOKEN"];

for (const key of requiredKeys) {
  if (!process.env[key] || process.env[key].trim().length === 0) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

const url = new URL("/index.php", process.env.MATOMO_URL);
url.searchParams.set("module", "API");
url.searchParams.set("method", "VisitsSummary.get");
url.searchParams.set("idSite", process.env.MATOMO_SITE_ID);
url.searchParams.set("period", "day");
url.searchParams.set("date", "today");
url.searchParams.set("format", "JSON");
url.searchParams.set("token_auth", process.env.MATOMO_AUTH_TOKEN);

const response = await fetch(url);
const responseText = await response.text();

let payload = null;

try {
  payload = JSON.parse(responseText);
} catch {
  payload = null;
}

if (!response.ok) {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    payload.result === "error"
  ) {
    console.error(`Matomo reporting error: ${payload.message || `HTTP ${response.status}`}`);
    process.exit(1);
  }

  console.error(`Matomo reporting failed with HTTP ${response.status}.`);
  process.exit(1);
}

if (
  payload &&
  typeof payload === "object" &&
  !Array.isArray(payload) &&
  payload.result === "error"
) {
  console.error(`Matomo reporting error: ${payload.message || "Unknown error"}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      visits: typeof payload.nb_visits === "number" ? payload.nb_visits : 0,
      actions: typeof payload.nb_actions === "number" ? payload.nb_actions : 0,
      pageviews: typeof payload.nb_pageviews === "number" ? payload.nb_pageviews : 0,
    },
    null,
    2,
  ),
);
