const axios = require("axios");
const cheerio = require("cheerio");

// ─── CONFIG ───────────────────────────────────────────────
const KEYWORDS = ["javascript", "react", "frontend", "vue", "typescript"];
const EXCLUDE_KEYWORDS = [
  "python",
  "fullstack",
  "full-stack",
  "full stack",
  "java",
  "ruby",
  "php",
  "golang",
  "rust",
  "android",
  "ios",
  "devops",
  "senior",
  "lead",
  "principal",
  "staff",
  "10+",
  "8+",
  "7+",
  "6+",
  "5+",
];
// ──────────────────────────────────────────────────────────

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
};

// ─── SCRAPER 1: RemoteOK JSON API ─────────────────────────
async function scrapeRemoteOK() {
  console.log("🔍 Scraping RemoteOK...");

  const { data } = await axios.get(
    "https://remoteok.com/remote-dev-jobs.json",
    {
      headers: HEADERS,
    },
  );

  // first item is metadata, skip it
  const listings = data.slice(1);
  const jobs = [];

  for (const job of listings) {
    const title = job.position || "";
    const tags = job.tags || [];

    const titleLower = title.toLowerCase();
    const tagsLower = tags.map((t) => t.toLowerCase());

    const isRelevant =
      (KEYWORDS.some((kw) => titleLower.includes(kw)) ||
        KEYWORDS.some((kw) => tagsLower.includes(kw))) &&
      !EXCLUDE_KEYWORDS.some((kw) => titleLower.includes(kw));

    if (isRelevant) {
      jobs.push({
        title,
        company: job.company || "Unknown",
        tags,
        link: job.url,
        source: "RemoteOK",
      });
    }
  }

  console.log(`   ✅ Found ${jobs.length} jobs on RemoteOK`);
  return jobs;
}

// ─── SCRAPER 2: We Work Remotely RSS ─────────────────────
async function scrapeWeWorkRemotely() {
  console.log("🔍 Scraping We Work Remotely...");

  const { data } = await axios.get(
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    { headers: HEADERS },
  );

  const $ = cheerio.load(data, { xmlMode: true });
  const jobs = [];

  $("item").each((i, el) => {
    const title = $(el).find("title").text().trim();
    const link =
      $(el).find("link").text().trim() || $(el).find("url").text().trim();
    const company = title.includes(":")
      ? title.split(":")[0].trim()
      : "Unknown";
    const jobTitle = title.includes(":")
      ? title.split(":").slice(1).join(":").trim()
      : title;

    const titleLower = title.toLowerCase();

    const isRelevant =
      KEYWORDS.some((kw) => titleLower.includes(kw)) &&
      !EXCLUDE_KEYWORDS.some((kw) => titleLower.includes(kw));

    if (isRelevant) {
      jobs.push({
        title: jobTitle,
        company,
        tags: [],
        link,
        source: "WeWorkRemotely",
      });
    }
  });

  console.log(`   ✅ Found ${jobs.length} jobs on We Work Remotely`);
  return jobs;
}

// ─── MAIN ─────────────────────────────────────────────────
async function main() {
  try {
    const [remoteOKJobs, wwrJobs] = await Promise.all([
      scrapeRemoteOK(),
      scrapeWeWorkRemotely(),
    ]);

    const allJobs = [...remoteOKJobs, ...wwrJobs];

    if (allJobs.length === 0) {
      console.log("\nNo matching jobs found today.");
      return;
    }

    console.log(`\n📋 Total: ${allJobs.length} relevant jobs found\n`);
    console.log("─".repeat(60));

    allJobs.forEach((job, i) => {
      console.log(`#${i + 1} [${job.source}]`);
      console.log(`  Title   : ${job.title}`);
      console.log(`  Company : ${job.company}`);
      console.log(`  Tags    : ${job.tags.join(", ") || "—"}`);
      console.log(`  Link    : ${job.link}`);
      console.log("─".repeat(60));
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

main();
