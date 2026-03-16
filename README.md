# Job Agent 🤖

I got tired of manually checking job boards every day, so I built an agent that does it for me.

It runs every morning, scrapes multiple job boards, uses Gemini AI to filter out irrelevant listings, and sends matching jobs straight to my Telegram — along with a custom cover letter for each one.

## What it does

- Scrapes **RemoteOK**, **We Work Remotely**, and **Himalayas** for frontend and AI developer roles
- Filters out senior roles, unrelated stacks, and experience requirements above 4 years
- Runs each job through **Gemini AI** to check if it actually fits the candidate profile
- Sends matched jobs to **Telegram** with job details and a generated cover letter
- Falls back to a secondary Gemini model if the primary hits quota limits
- Removes duplicate listings across sources
- Runs automatically every day at 9am using node-cron

## Tech stack

- Node.js
- Axios + Cheerio — scraping and RSS parsing
- Google Gemini API — AI filtering and cover letter generation
- Telegram Bot API — notifications
- node-cron — scheduling
- dotenv — environment config

## Setup

1. Clone the repo

   ```bash
   git clone https://github.com/atish-k97/job-agent.git
   cd job-agent
   npm install
   ```

2. Create a `.env` file in the root folder

   ```
   GEMINI_API_KEY=your_gemini_api_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   ```

3. Get your keys
   - Gemini API key → [aistudio.google.com](https://aistudio.google.com) (free tier available)
   - Telegram bot token → message `@BotFather` on Telegram
   - Telegram chat ID → message `@userinfobot` on Telegram

4. Add your resume
   Create a `resume.txt` file in the root folder with your resume as plain text. This is used to generate cover letters.

5. Run it
   ```bash
   node agent.js
   ```

## Customize

Edit the `KEYWORDS` and `EXCLUDE_KEYWORDS` arrays in `agent.js` to match your target roles. Update `CANDIDATE_PROFILE` with your actual experience and skills.

## How it works

```
[Scrape 3 job boards] → [Keyword filter] → [Gemini AI filter] → [Generate cover letter] → [Send to Telegram]
```

Each job goes through two layers of filtering — a fast keyword check first, then an AI check for relevance against a detailed candidate profile. Only the matches get sent, along with a ready-to-use cover letter.

## Notes

- Free Gemini tier allows ~20 requests/day which is enough for normal daily usage
- node_modules and .env are gitignored — never commit your API keys
- resume.txt is also gitignored — keep it local

## What's next

- Add more job sources
- Track applied jobs to avoid duplicates across runs
- Build a simple React dashboard to view matches

---

Built this as a portfolio project while learning AI agents. The irony of using an AI job agent to find a job as an AI developer is not lost on me.
