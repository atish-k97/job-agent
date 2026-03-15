require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ─── CONFIG ───────────────────────────────────────────────
const KEYWORDS = [
  // Frontend
  "javascript",
  "react",
  "frontend",
  "vue",
  "typescript",
  // AI/Agent
  "ai agent",
  "llm",
  "generative ai",
  "prompt engineer",
  "ai developer",
  "chatbot",
];
const EXCLUDE_KEYWORDS = [
  "python",
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
  "10+",
  "8+",
  "7+",
  "6+",
  "5+",
  "native",
];
const CANDIDATE_PROFILE = `
  - Role: Junior Frontend Developer / AI Agent Developer
  - Skills: JavaScript, React, HTML, CSS, Node.js, AI agents, LLM APIs, Gemini API
  - Experience: Less than 4 years
  - Location: India
  - Looking for: Remote jobs, open to hybrid in India
  - NOT looking for: Senior roles, mobile dev, Python-only, DevOps, 5+ years experience required
`;
// ──────────────────────────────────────────────────────────

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
};

// ─── GEMINI SETUP WITH FALLBACK ───────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const primaryModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
});
const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ─── RESUME ───────────────────────────────────────────────
let resume = "";
try {
  resume = fs.readFileSync("resume.txt", "utf8");
} catch {
  console.log("⚠️resume.txt not found — cover letter generation disabled");
}

// ─── DATE FILTER: last 3 days ─────────────────────────────
function isWithin7Days(dateString) {
  if (!dateString) return true;
  const jobDate = new Date(dateString);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return jobDate >= sevenDaysAgo;
}

// ─── SCRAPER 1: RemoteOK ──────────────────────────────────
async function scrapeRemoteOK() {
  console.log("🔍 Scraping RemoteOK...");
  const { data } = await axios.get(
    "https://remoteok.com/remote-dev-jobs.json",
    { headers: HEADERS },
  );
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

// ─── SCRAPER 2: We Work Remotely ─────────────────────────
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
    const link = $(el).find("link").text().trim();
    const pubDate = $(el).find("pubDate").text().trim();
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

  console.log(`✅ Found ${jobs.length} jobs on We Work Remotely`);
  return jobs;
}

// ─── SCRAPER 3: Himalayas ────────────────────────────────
async function scrapeHimalayas() {
  console.log("🔍 Scraping Himalayas...");
  const { data } = await axios.get("https://himalayas.app/jobs/rss", {
    headers: HEADERS,
  });

  const $ = cheerio.load(data, { xmlMode: true });
  const jobs = [];

  $("item").each((i, el) => {
    const title = $(el).find("title").text().trim();
    const link = $(el).find("link").text().trim();
    const pubDate = $(el).find("pubDate").text().trim();
    const company =
      $(el).find("dc\\:creator, creator").text().trim() || "Unknown";
    const titleLower = title.toLowerCase();

    const isRelevant =
      KEYWORDS.some((kw) => titleLower.includes(kw)) &&
      !EXCLUDE_KEYWORDS.some((kw) => titleLower.includes(kw));

    if (isRelevant) {
      jobs.push({ title, company, tags: [], link, source: "Himalayas" });
    }
  });

  console.log(`   ✅ Found ${jobs.length} jobs on Himalayas`);
  return jobs;
}

// ─── DUPLICATE FILTER ────────────────────────────────────
function removeDuplicates(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = job.title.toLowerCase() + job.company.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── GEMINI AI FILTER WITH FALLBACK ──────────────────────
async function isGoodMatch(job) {
  const prompt = `
You are a job filter assistant. Based on this candidate profile:
${CANDIDATE_PROFILE}

Evaluate this job:
Title: ${job.title}
Company: ${job.company}
Tags: ${job.tags.join(", ") || "none"}

Reply with only YES or NO.
YES = good match for this candidate.
NO = not a good match.
`;

  // try primary model first, fall back to secondary
  for (const model of [primaryModel, fallbackModel]) {
    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim().toUpperCase();
      return response.startsWith("YES");
    } catch (err) {
      if (err.message.includes("429")) {
        continue; // quota hit, try fallback
      }
      console.error(`   ⚠️ Gemini error for "${job.title}":`, err.message);
      return true; // non-quota error, include job anyway
    }
  }

  console.log(
    `   ⚠️ Both models quota exceeded for "${job.title}" — including anyway`,
  );
  return true;
}

// ─── COVER LETTER GENERATOR ──────────────────────────────
async function generateCoverLetter(job) {
  if (!resume) return null;

  const prompt = `
Write a short, professional cover letter for this job application.

Candidate resume:
${resume}

Job:
Title: ${job.title}
Company: ${job.company}

Rules:
- Max 3 paragraphs
- Friendly but professional tone
- Highlight relevant skills from resume that match the job
- Do not make up experience that isn't in the resume
- End with a call to action
`;

  for (const model of [primaryModel, fallbackModel]) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      if (err.message.includes("429")) continue;
      return null;
    }
  }
  return null;
}

// ─── TELEGRAM SENDER ──────────────────────────────────────
async function sendToTelegram(job, coverLetter) {
  let message = `
🚀 *New Job Match!*

*${job.title}*
🏢 ${job.company}
🏷 ${job.tags.join(", ") || "—"}
🌐 [View Job](${job.link})
📡 Source: ${job.source}
  `.trim();

  if (coverLetter) {
    message += `\n\n📝 *Cover Letter:*\n${coverLetter}`;
  }

  // Telegram max message length is 4096 chars
  if (message.length > 4096) {
    message = message.substring(0, 4090) + "...";
  }

  await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    },
  );
}

// ─── MAIN AGENT LOOP ──────────────────────────────────────
async function runAgent() {
  console.log("\n🤖 Job Agent starting...\n");

  try {
    // Step 1: Scrape all sources in parallel
    const [remoteOKJobs, wwrJobs, himalayasJobs] = await Promise.all([
      scrapeRemoteOK(),
      scrapeWeWorkRemotely(),
      scrapeHimalayas(),
    ]);

    // Step 2: Merge + remove duplicates
    const allJobs = removeDuplicates([
      ...remoteOKJobs,
      ...wwrJobs,
      ...himalayasJobs,
    ]);
    console.log(`\n📋 Total scraped (after dedup): ${allJobs.length} jobs`);

    if (allJobs.length === 0) {
      console.log("No jobs found in last 3 days.");
      return;
    }

    // Step 3: AI Filter
    console.log("\n🧠 Running Gemini AI filter...");
    const matched = [];

    for (const job of allJobs) {
      const good = await isGoodMatch(job);
      console.log(`   ${good ? "✅" : "❌"} ${job.title}`);
      if (good) matched.push(job);
    }

    console.log(`\n✨ ${matched.length} jobs passed AI filter`);

    if (matched.length === 0) {
      console.log("No matches to send today.");
      return;
    }

    // Step 4: Generate cover letters + Send to Telegram
    console.log("\n📬 Generating cover letters and sending to Telegram...");
    for (const job of matched) {
      const coverLetter = await generateCoverLetter(job);
      await sendToTelegram(job, coverLetter);
      console.log(
        `   ✅ Sent: ${job.title}${coverLetter ? " + cover letter" : ""}`,
      );
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log("\n🎉 Done! Check your Telegram.");
  } catch (err) {
    console.error("❌ Agent error:", err.message);
  }
}

// ─── SCHEDULER: runs every day at 9:00 AM ─────────────────
console.log("⏰ Job Agent scheduled — runs daily at 9:00 AM");
console.log("   Running once now for testing...\n");

runAgent();

cron.schedule("0 9 * * *", () => {
  console.log("⏰ Scheduled run starting...");
  runAgent();
});
