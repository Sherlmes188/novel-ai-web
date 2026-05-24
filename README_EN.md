# Novel AI Web

[中文](./README.md) | English

`Novel AI Web` is an AI-assisted writing backend for long-form web fiction. It is not designed as a one-click full-novel generator. Instead, it breaks long-form novel production into manageable steps: concept design, global outline, volume outlines, chapter outlines, chapter drafting, review, finalization, export, and publishing queues.

The project is built with Next.js App Router, React, Prisma, PostgreSQL, and DeepSeek Chat Completions. It is intended to be self-hosted as a private writing dashboard for individual authors or small teams.

## Features

### Novel Project Management

- Create and manage multiple novel projects.
- Store genre, subgenre, tags, synopsis, selling points, target chapter count, target words per chapter, and target total words.
- Maintain global style preferences, forbidden rules, main storyline goals, and final goals.
- Isolate characters, worldbuilding, chapters, AI tasks, and publication jobs per novel.

### AI Novel Concept Generation

- Generate a complete novel concept from a short idea.
- Supported generated fields include:
  - Title.
  - Genre and subgenre.
  - Core selling point.
  - Synopsis.
  - Target chapter count.
  - Target words per chapter.
  - Writing style.
  - Forbidden rules.
  - Main quest chain.
  - Final goal.
  - Global outline.
  - Protagonist profile.
  - Main characters.
  - Worldbuilding.
- AI output is filled back into the creation form, so the user can edit it before creating the actual novel project.

### Outline and Volume Planning

- Manage the global outline.
- Create volumes manually.
- Generate volume outlines with AI based on the global outline, target chapter count, and global settings.
- Each volume can store:
  - Chapter range.
  - Volume summary.
  - Main goal.
  - Main conflict.
  - Main enemy or obstacle.
  - Key characters.
  - Key settings.
  - Foreshadowing to plant or resolve.
  - Volume climax.

### Chapter Outline and Draft Generation

- Manage chapters by chapter number.
- Generate chapter outlines in batches for a volume.
- Each chapter stores title, outline, content, summary, word count, and status.
- When generating a chapter draft, the prompt combines multiple context layers:
  - Novel metadata.
  - Global outline.
  - Current volume outline.
  - Current chapter outline.
  - Character profiles.
  - Worldbuilding records.
  - Forbidden expressions.
  - Recent chapter summaries.
  - Previous chapter memory.
- After generation, the system updates chapter word count and novel total word count.

### Automatic Summary, Review, and Memory Updates

After a chapter draft is generated, the system calls AI again for post-processing:

- Extract a short chapter summary.
- Generate a continuity review.
- Extract character state changes.
- Extract newly introduced or confirmed worldbuilding facts.
- Write back chapter summary, character state, character items/power/relationships, and worldbuilding records.

This creates a rolling memory system for long-form fiction, allowing later chapters to continue from prior state without loading the entire manuscript.

### Character and Worldbuilding Database

- Character fields include name, alias, gender, age, identity, faction, camp, appearance, personality, speech style, abilities, power level, skills, items, goal, secret, character arc, and current status.
- Worldbuilding records are organized by category and importance.
- Important character and worldbuilding updates can be extracted automatically after chapter generation.

### Forbidden Terms and Cliches

- Maintain a forbidden expression library per novel.
- Add category, note, and severity.
- Forbidden terms are injected into generation prompts to reduce unwanted expressions and cliches.

### AI Task History

- Every AI call is recorded as a task.
- Task records include task type, target object, status, prompt, output, error message, model, start time, and finish time.
- Useful for debugging prompt issues, model failures, and generation results.

### Version History

- Before AI overwrites chapter content, the old content is archived automatically.
- Recent versions can be viewed on the chapter page.

### Export

Export the manuscript in chapter order:

- TXT.
- Markdown.
- JSON backup.

### Fanqie Novel Publishing Queue

The project includes a Playwright-based helper script for Fanqie Novel publishing workflows.

Supported capabilities:

- Bind Fanqie workspace and new-chapter URLs.
- Save login state to `.auth/fanqie.json`.
- Add finalized chapters to a publishing queue.
- Publish according to scheduled time.
- Create publishing schedules based on a daily word limit.
- Record errors when publishing fails.
- Pause and mark status when login expires or captcha appears.
- Save debug screenshots to `logs/fanqie-screenshots`.

Important: Fanqie automation depends on page selectors and the platform's current DOM structure. Always verify selectors in a test run before enabling real submission.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Web framework | Next.js 16 App Router |
| UI | React 19 |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| AI API | DeepSeek Chat Completions / OpenAI-compatible API |
| Authentication | Server-side Cookie + HMAC signature + bcrypt password hash |
| Publishing automation | Playwright |
| Styling | Tailwind CSS 4 |
| Recommended deployment | PM2 + Nginx + PostgreSQL |

## Project Structure

```text
novel-ai-web
├── prisma
│   ├── schema.prisma
│   └── migrations
├── scripts
│   ├── create-user.ts
│   ├── fanqie-login.ts
│   ├── fanqie-typo-dry-run.ts
│   ├── hash-password.ts
│   └── publish-fanqie.ts
├── src
│   ├── app
│   │   ├── api
│   │   ├── login
│   │   └── novels
│   ├── components
│   └── lib
│       ├── access.ts
│       ├── actions.ts
│       ├── auth.ts
│       ├── db.ts
│       ├── deepseek.ts
│       ├── novel-idea.ts
│       └── utils.ts
├── .env.example
├── ecosystem.config.js
├── package.json
└── README.md
```

Important files:

- `src/lib/actions.ts`: Core Server Actions for novel creation, AI generation, outlines, chapters, characters, worldbuilding, and publishing queues.
- `src/lib/deepseek.ts`: DeepSeek / OpenAI-compatible Chat Completions wrapper.
- `src/lib/auth.ts`: Login cookie encoding, decoding, and validation.
- `src/lib/access.ts`: Novel ownership validation.
- `src/lib/novel-idea.ts`: AI novel concept JSON parsing and formatting.
- `prisma/schema.prisma`: Database schema.
- `scripts/publish-fanqie.ts`: Fanqie publishing queue runner.
- `scripts/fanqie-login.ts`: Fanqie login state saver.

## Data Model Overview

Core models:

- `User`: Dashboard user.
- `Novel`: Main novel project.
- `NovelSetting`: Long-form settings such as global outline and protagonist profile.
- `Volume`: Volume outline.
- `Chapter`: Chapter outline, content, summary, and status.
- `Character`: Character profile.
- `WorldSetting`: Worldbuilding record.
- `Foreshadow`: Foreshadowing record.
- `TimelineEvent`: Timeline event.
- `ForbiddenTerm`: Forbidden words and expressions.
- `AiTask`: AI call history.
- `Version`: Content archive.
- `PublicationJob`: Publishing queue task.

## Requirements

- Node.js 20 or later recommended.
- npm.
- PostgreSQL 14 or later recommended.
- DeepSeek API Key or another OpenAI-compatible Chat Completions service.
- Playwright-compatible Chromium environment if you use Fanqie publishing automation.

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd novel-ai-web
```

### 2. Install Dependencies

```bash
npm install
```

If you plan to use the Fanqie publishing scripts, install Chromium:

```bash
npx playwright install chromium
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```env
NODE_ENV=development
APP_URL=http://localhost:3000

DATABASE_URL=postgresql://novel_user:change_me@127.0.0.1:5432/novel_ai

SESSION_SECRET=change_to_a_long_random_string
LOGIN_USERNAME=admin
LOGIN_PASSWORD_HASH=replace_with_bcrypt_hash

DEEPSEEK_API_KEY=replace_with_your_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### 4. Prepare the Database

Create a PostgreSQL user and database. Example:

```sql
CREATE USER novel_user WITH PASSWORD 'change_me';
CREATE DATABASE novel_ai OWNER novel_user;
GRANT ALL PRIVILEGES ON DATABASE novel_ai TO novel_user;
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Run migrations:

```bash
npm run prisma:migrate
```

During development, you can also use:

```bash
npx prisma db push
```

### 5. Create an Admin User

Recommended:

```bash
npm run create-user -- admin your_password
```

If you only want to generate a bcrypt hash:

```bash
npm run hash-password -- your_password
```

Then write the output to:

```env
LOGIN_USERNAME=admin
LOGIN_PASSWORD_HASH=<bcrypt_hash>
```

### 6. Start the Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Log in and start creating novels.

## Common Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint

# Generate Prisma Client
npm run prisma:generate

# Run Prisma migrations
npm run prisma:migrate

# Generate password hash
npm run hash-password -- your_password

# Create user
npm run create-user -- username password

# Save Fanqie login state
npm run fanqie:login

# Run Fanqie publishing queue
npm run fanqie:publish
```

## Environment Variables

### Basic Configuration

| Variable | Description | Example |
| --- | --- | --- |
| `NODE_ENV` | Runtime environment | `development` |
| `APP_URL` | Application URL | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@127.0.0.1:5432/db` |
| `SESSION_SECRET` | Cookie HMAC signing secret | A long random string |

### Login Configuration

| Variable | Description |
| --- | --- |
| `LOGIN_USERNAME` | Optional bootstrap username |
| `LOGIN_PASSWORD_HASH` | Optional bcrypt password hash |

The system primarily authenticates against the `User` table. Use `npm run create-user -- username password` to create users.

### AI Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | None |
| `DEEPSEEK_BASE_URL` | DeepSeek or compatible service base URL | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | Model name | `deepseek-chat` |
| `DEEPSEEK_MAX_OUTPUT_TOKENS` | Maximum output tokens | `6000` |
| `DEEPSEEK_TIMEOUT_MS` | Request timeout in milliseconds | `120000` |
| `AI_DEFAULT_TEMPERATURE` | Default generation temperature | `0.8` |
| `AI_PLANNING_TEMPERATURE` | Planning task temperature | `0.7` |
| `AI_REVIEW_TEMPERATURE` | Review task temperature | `0.3` |

### Fanqie Publishing Configuration

| Variable | Description |
| --- | --- |
| `FANQIE_WORKSPACE_URL` | Fanqie chapter management page |
| `FANQIE_PUBLISH_URL` | Fanqie new-chapter page |
| `FANQIE_STORAGE_STATE` | Playwright login state path |
| `FANQIE_CHROME_EXECUTABLE` | Optional Chrome executable path |
| `FANQIE_SCREENSHOT_DIR` | Debug screenshot directory |
| `FANQIE_NEW_CHAPTER_SELECTOR` | New chapter button selector |
| `FANQIE_CHAPTER_NUMBER_SELECTOR` | Chapter number input selector |
| `FANQIE_TITLE_SELECTOR` | Title input selector |
| `FANQIE_CONTENT_SELECTOR` | Content editor selector |
| `FANQIE_SCHEDULE_SELECTOR` | Schedule time input selector |
| `FANQIE_SUBMIT_SELECTOR` | Submit button selector |
| `FANQIE_LOGIN_CHECK_SELECTOR` | Login check selector |
| `FANQIE_CAPTCHA_SELECTOR` | Captcha check selector |
| `FANQIE_CONFIRM_SUBMIT` | Whether real submission is allowed |

Recommended values for `FANQIE_CONFIRM_SUBMIT`:

- Empty: fill the page but do not submit; best for debugging.
- `next-only`: click only the next-step button.
- `yes`: allow automatic final submission. Use with caution.

## Workflow

### Create a Novel

1. Log in.
2. Open the novel list.
3. Click create novel.
4. Enter a short idea and generate a concept with AI.
5. Review and edit the generated fields.
6. Create the novel.

### Plan the Outline

1. Open the novel dashboard.
2. Generate or edit the global outline.
3. Open the outline page.
4. Generate volume outlines.
5. Review chapter ranges, goals, conflicts, and climaxes.

### Generate Chapters

1. Open the chapters page.
2. Create chapters or batch-generate chapter outlines for a volume.
3. Open a single chapter.
4. Review the chapter outline.
5. Click "Generate content from outline".
6. Review AI feedback and chapter summary.
7. Edit the chapter manually.
8. Mark the chapter as finalized.

### Publish Chapters

1. Configure Fanqie novel URLs.
2. Run `npm run fanqie:login` to save login state.
3. Add finalized chapters to the publishing queue.
4. Keep `FANQIE_CONFIRM_SUBMIT` empty for dry-run testing first.
5. After verifying selectors and workflow, set it to `yes`.
6. Run `npm run fanqie:publish` to process the queue.

## Production Deployment

### 1. Install, Migrate, and Build

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run build
```

### 2. Start with PM2

The project includes `ecosystem.config.js`:

```bash
pm2 start ecosystem.config.js
pm2 save
```

Or start directly:

```bash
pm2 start npm --name novel-ai-web -- run start
```

### 3. Nginx Reverse Proxy Example

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Run Publishing Queue Periodically

Example cron job:

```bash
*/10 * * * * cd /var/www/novel-ai-web && npm run fanqie:publish >> logs/fanqie-cron.log 2>&1
```

You can also manage a separate worker with PM2.

## Security Notes

Do not commit these files or values to GitHub:

- `.env`.
- `.auth/`.
- `logs/`.
- Fanqie login state.
- Publishing debug screenshots.
- Real database connection strings.
- Real API keys.
- Real password hashes.

The project `.gitignore` ignores these by default. Before publishing the repository, run:

```bash
git status --ignored
git ls-files -o --exclude-standard
```

Make sure no sensitive files are staged.

If you accidentally commit secrets to a public repository:

1. Remove the sensitive files from the repository.
2. Rotate the DeepSeek API key.
3. Change the database password.
4. Change `SESSION_SECRET`.
5. Recreate Fanqie login state.

## Current Limitations

- AI tasks are currently mostly synchronous Server Actions, so long tasks may be affected by deployment timeouts.
- There is no vector retrieval/RAG yet. Long-term memory mainly relies on summaries, character records, and worldbuilding records.
- Review output is still mostly text-based. Structured review and automatic revision workflows are planned.
- Fanqie publishing automation depends on page structure and may require selector updates when the platform changes.
- The project is currently best suited for individuals or small teams. Multi-tenant permissions and cost tracking are not fully implemented.

## Roadmap

Planned improvements:

- Structured review reports.
- Revision generation from review reports.
- Diff view between original and revised chapter.
- Pre-generation chapter checks.
- Post-generation formatting validation.
- pgvector / RAG memory retrieval.
- Character state history.
- Foreshadowing lifecycle tracking.
- Worldbuilding revision history.
- Async AI task queue.
- Multi-model configuration.
- Token and cost analytics.
- More complete writing workspace UI.

## License

Please add a license file according to your open-source plan, such as MIT, Apache-2.0, or GPL-3.0.

Without an explicit `LICENSE` file, the project should not be assumed to allow free copying, distribution, or commercial use. Add a `LICENSE` before formally open-sourcing the repository.

## Disclaimer

This project is intended for personal writing assistance and workflow automation research. When using AI-generated content, you are responsible for reviewing quality, copyright risks, platform rules, and publication compliance.

The Fanqie publishing script is only a helper for personal workflows. Please verify the relevant platform rules before using automation, and use it at your own risk.

