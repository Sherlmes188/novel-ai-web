# Novel AI Web

中文 | [English](./README_EN.md)

`Novel AI Web` 是一个面向长篇网文创作的 AI 辅助写作后台。它不是一次性生成整本小说的玩具工具，而是把长篇小说拆成“小说方案、总纲、分卷卷纲、章节细纲、章节正文、审稿、定稿、导出、发布队列”等可管理步骤，帮助作者持续生产、维护和发布连载内容。

项目基于 Next.js App Router、React、Prisma、PostgreSQL 和 DeepSeek Chat Completions 构建。它适合部署在自己的服务器上，作为个人或小团队使用的 AI 小说创作后台。

## 功能特性

### 小说项目管理

- 创建和管理多本小说。
- 记录小说类型、子类型、标签、简介、卖点、目标章节数、目标单章字数、目标总字数。
- 维护全局风格偏好、禁忌规则、主线目标、最终目标。
- 按小说维度隔离人物、世界观、章节、AI 任务和发布任务。

### AI 小说方案生成

- 根据一句话灵感生成完整小说方案。
- 支持生成：
  - 书名。
  - 类型和子类型。
  - 核心卖点。
  - 简介。
  - 目标章节数。
  - 目标单章字数。
  - 写作风格。
  - 禁忌规则。
  - 主线任务链。
  - 终局目标。
  - 总大纲。
  - 主角设定。
  - 主要人物。
  - 世界观。
- AI 生成的方案会回填到创建表单，用户确认后再正式创建小说。

### 大纲与分卷管理

- 管理小说总纲。
- 手动创建分卷。
- AI 根据总纲、小说目标章节数和全局设定生成分卷卷纲。
- 每个分卷可记录：
  - 章节范围。
  - 本卷概要。
  - 本卷目标。
  - 主要冲突。
  - 主要敌人或阻力。
  - 关键人物。
  - 关键设定。
  - 需要埋设或回收的伏笔。
  - 卷末高潮。

### 章节细纲与正文生成

- 按章节号管理章节。
- AI 可根据卷纲批量生成章节细纲。
- 每章包含标题、细纲、正文、摘要、字数和状态。
- 支持章节生成前检查，提前识别缺少卷纲、细纲为空、上一章摘要缺失、人物状态断裂、伏笔未回收和禁用词命中等风险。
- 正文生成时会组合多层上下文：
  - 小说基础信息。
  - 总大纲。
  - 当前分卷卷纲。
  - 当前章节细纲。
  - 人物资料。
  - 世界观资料。
  - 禁用表达。
  - 最近章节摘要。
  - 上一章主要内容。
  - 长篇记忆检索结果。
- 生成后自动更新章节字数和小说总字数。
- 生成后会执行格式和质量校验，检查目标字数、Markdown 痕迹、解释性开头、超长段落、禁用词命中、对话引号和细纲偏离风险。

### 结构化审稿与修订版闭环

- 章节页支持结构化审稿，AI 必须输出 JSON。
- 审稿结果会保存为可追踪的 `ChapterReview` 和 `ChapterReviewIssue`。
- 审稿报告包含评分、摘要、问题类型、严重程度、证据、解释和修改建议。
- 可基于任意审稿报告生成 `ChapterRevision` 修订版。
- AI 修订不会直接覆盖正文，用户确认后才可应用。
- 应用修订版前会自动把旧正文归档到版本历史。
- 修订版支持应用和废弃状态，方便保留完整修稿链路。

### 长篇记忆与检索

- 新增长篇记忆库 `MemoryChunk`。
- 支持将章节摘要、章节正文片段、人物状态、世界观、伏笔和时间线写入记忆库。
- 章节正文会按约 1100 字切片索引。
- 章节正文生成前会根据章节标题、细纲和补充要求检索远期记忆，并拼入 prompt。
- 支持 OpenAI-compatible Embedding API。
- 未配置 embedding 时会自动退化为关键词检索，保证功能可用。
- 新增“记忆”页面，可查看记忆块数量、未生成 embedding 的块、来源统计、手动重建索引、索引单章和测试检索。

### 自动摘要、自审和资料回写

章节正文生成后，系统会再次调用 AI 进行后处理：

- 提取 300 字以内章节摘要。
- 生成连续性自审结果。
- 提取人物状态变化。
- 提取新增或确认的世界观信息。
- 回写章节摘要、人物当前状态、人物物品/境界/关系、世界观资料。
- 同步写入人物状态历史和世界观修订历史。
- 自动更新当前章节的记忆索引。

这个机制用于给长篇小说建立“滚动记忆”，让后续章节不必依赖完整正文，也能承接前文状态。

### 人物与世界观资料库

- 人物资料字段包括姓名、别名、性别、年龄、身份、势力、阵营、外貌、性格、说话风格、能力、境界、技能、物品、目标、秘密、角色弧光、当前状态等。
- 世界观资料按分类和重要程度管理。
- AI 生成章节后可自动更新重要人物和世界观条目。
- 人物页展示最近状态时间线。
- 世界观页展示设定修订历史。
- 新增 `ForeshadowEvent` 模型，为伏笔生命周期追踪预留事件流。

### 禁用词和禁用烂梗

- 按小说维护禁用表达库。
- 支持分类、备注和严重程度。
- 生成提示词时会把禁用表达加入上下文，要求 AI 避免使用。

### AI 任务记录

- 每次 AI 调用都会记录为任务。
- 任务记录包含任务类型、目标对象、状态、prompt、输出、错误信息、模型、开始时间、结束时间、重试次数、进度、token 和成本字段。
- 失败任务支持在页面重试。
- 成功任务支持复制 prompt 和 output。
- 方便排查生成失败、prompt 问题和模型输出问题。

### 多模型配置

- 新增 AI 模型配置页面。
- 支持记录 OpenAI-compatible provider、base URL、模型名、API Key 环境变量引用、用途、温度和最大 token。
- 可按 planning、drafting、review、revision、embedding 等用途维护模型配置。
- 当前页面先作为配置台账，后续可进一步接入任务调度选择逻辑。

### 章节编辑诊断

- 章节详情页提供编辑诊断面板。
- 显示正文总字数、段落数、中文对话引号数量和禁用词命中数。
- 显示正文格式校验 warning，帮助在保存、审稿和定稿前发现明显问题。

### 版本历史

- 当 AI 覆盖章节正文前，系统会自动保存旧正文版本。
- 用户手动保存章节时也可以进入版本归档逻辑。
- 章节页可查看最近版本历史。

### 导出

支持按章节顺序导出：

- TXT。
- Markdown。
- JSON 备份。

### 番茄小说发布队列

项目内置基于 Playwright 的番茄小说发布辅助脚本，用于个人自动化发布流程。

功能包括：

- 绑定番茄作品章节管理页和新建章节页。
- 登录态保存到本地 `.auth/fanqie.json`。
- 将已定稿章节加入发布队列。
- 按计划时间发布。
- 按每日字数上限生成发布排期。
- 发布失败记录错误。
- 登录失效或验证码出现时暂停并标记状态。
- 保存调试截图到 `logs/fanqie-screenshots`。

注意：番茄发布自动化依赖页面选择器和平台页面结构，具有不稳定性。首次使用务必先在测试环境中验证选择器，不要直接开启自动提交。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Web 框架 | Next.js 16 App Router |
| UI | React 19 |
| 语言 | TypeScript |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| AI 接口 | DeepSeek Chat Completions / OpenAI-compatible API |
| 登录认证 | 服务端 Cookie + HMAC 签名 + bcrypt 密码哈希 |
| 自动化发布 | Playwright |
| 样式 | Tailwind CSS 4 |
| 部署建议 | PM2 + Nginx + PostgreSQL |

## 目录结构

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
│       ├── chapter-validation.ts
│       ├── db.ts
│       ├── deepseek.ts
│       ├── embedding.ts
│       ├── memory.ts
│       ├── novel-idea.ts
│       └── utils.ts
├── .env.example
├── ecosystem.config.js
├── package.json
└── README.md
```

关键文件说明：

- `src/lib/actions.ts`：核心 Server Actions，包含小说创建、AI 生成、大纲、章节、人物、世界观、发布队列等主要业务逻辑。
- `src/lib/deepseek.ts`：DeepSeek / OpenAI-compatible Chat Completions 调用封装。
- `src/lib/embedding.ts`：OpenAI-compatible Embedding API 调用封装。
- `src/lib/memory.ts`：长篇记忆索引、切片、检索和 prompt 格式化。
- `src/lib/chapter-validation.ts`：章节正文生成后格式和风险校验。
- `src/lib/auth.ts`：登录 Cookie 编码、解码和校验。
- `src/lib/access.ts`：小说所有权校验。
- `src/lib/novel-idea.ts`：AI 小说方案 JSON 解析和格式化。
- `prisma/schema.prisma`：数据库模型定义。
- `scripts/publish-fanqie.ts`：番茄发布队列执行脚本。
- `scripts/fanqie-login.ts`：番茄登录态保存脚本。

## 数据模型概览

核心模型：

- `User`：后台用户。
- `Novel`：小说主表。
- `NovelSetting`：总纲、主角设定等通用长文本设定。
- `Volume`：分卷卷纲。
- `Chapter`：章节细纲、正文、摘要和状态。
- `Character`：人物资料。
- `WorldSetting`：世界观资料。
- `Foreshadow`：伏笔。
- `TimelineEvent`：时间线事件。
- `ForbiddenTerm`：禁用词和禁用表达。
- `AiTask`：AI 调用记录。
- `AiModelConfig`：多模型配置。
- `Version`：版本归档。
- `PublicationJob`：发布队列任务。
- `ChapterReview`：结构化审稿报告。
- `ChapterReviewIssue`：结构化审稿问题项。
- `ChapterRevision`：基于审稿生成的修订版。
- `MemoryChunk`：长篇记忆块。
- `CharacterStateHistory`：人物状态历史。
- `ForeshadowEvent`：伏笔事件。
- `WorldSettingRevision`：世界观修订历史。

## 环境要求

- Node.js 20 或更高版本建议。
- npm。
- PostgreSQL 14 或更高版本建议。
- DeepSeek API Key 或兼容 OpenAI Chat Completions 的服务。
- 如需番茄发布功能，需要可运行 Playwright Chromium 的环境。

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd novel-ai-web
```

### 2. 安装依赖

```bash
npm install
```

如果需要使用 Playwright 番茄发布脚本，建议安装浏览器：

```bash
npx playwright install chromium
```

### 3. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

修改 `.env`：

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

EMBEDDING_API_KEY=
EMBEDDING_BASE_URL=
EMBEDDING_MODEL=
```

### 4. 准备数据库

创建 PostgreSQL 数据库和用户。示例：

```sql
CREATE USER novel_user WITH PASSWORD 'change_me';
CREATE DATABASE novel_ai OWNER novel_user;
GRANT ALL PRIVILEGES ON DATABASE novel_ai TO novel_user;
```

生成 Prisma Client：

```bash
npm run prisma:generate
```

执行迁移：

```bash
npm run prisma:migrate
```

开发期也可以使用：

```bash
npx prisma db push
```

### 5. 创建后台用户

推荐使用数据库用户体系：

```bash
npm run create-user -- admin your_password
```

如果你只想生成 bcrypt 哈希并手动写入 `.env`：

```bash
npm run hash-password -- your_password
```

然后将输出写入：

```env
LOGIN_USERNAME=admin
LOGIN_PASSWORD_HASH=<bcrypt_hash>
```

### 6. 启动开发服务器

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

登录后即可进入小说后台。

## 常用命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务
npm run start

# ESLint 检查
npm run lint

# 生成 Prisma Client
npm run prisma:generate

# 执行 Prisma 迁移
npm run prisma:migrate

# 生成密码哈希
npm run hash-password -- your_password

# 创建用户
npm run create-user -- username password

# 保存番茄登录态
npm run fanqie:login

# 执行番茄发布队列
npm run fanqie:publish
```

## 环境变量说明

### 基础配置

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `NODE_ENV` | 运行环境 | `development` |
| `APP_URL` | 应用访问地址 | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@127.0.0.1:5432/db` |
| `SESSION_SECRET` | Cookie HMAC 签名密钥 | 随机长字符串 |

### 登录配置

| 变量 | 说明 |
| --- | --- |
| `LOGIN_USERNAME` | 可选的引导登录用户名 |
| `LOGIN_PASSWORD_HASH` | 可选的 bcrypt 密码哈希 |

当前系统优先使用数据库中的 `User` 表进行认证。推荐通过 `npm run create-user -- username password` 创建用户。

### AI 配置

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 无 |
| `DEEPSEEK_BASE_URL` | DeepSeek 或兼容服务地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 模型名 | `deepseek-chat` |
| `DEEPSEEK_MAX_OUTPUT_TOKENS` | 最大输出 token | `6000` |
| `DEEPSEEK_TIMEOUT_MS` | 请求超时毫秒数 | `120000` |
| `AI_DEFAULT_TEMPERATURE` | 默认生成温度 | `0.8` |
| `AI_PLANNING_TEMPERATURE` | 规划类任务温度 | `0.7` |
| `AI_REVIEW_TEMPERATURE` | 审稿类任务温度 | `0.3` |
| `AI_REVISION_TEMPERATURE` | 修订类任务温度 | `0.45` |

### Embedding / 记忆检索配置

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `EMBEDDING_PROVIDER` | Embedding 服务类型标记 | `openai_compatible` |
| `EMBEDDING_BASE_URL` | OpenAI-compatible Embedding API 地址 | 空 |
| `EMBEDDING_API_KEY` | Embedding API Key | 空 |
| `EMBEDDING_MODEL` | Embedding 模型名 | 空 |
| `EMBEDDING_DIMENSION` | Embedding 维度记录 | `1536` |

如果未配置 `EMBEDDING_API_KEY` 和 `EMBEDDING_MODEL`，系统仍会使用关键词检索作为兜底，不会阻断章节生成。

### 番茄发布配置

| 变量 | 说明 |
| --- | --- |
| `FANQIE_WORKSPACE_URL` | 番茄作品章节管理页 |
| `FANQIE_PUBLISH_URL` | 番茄新建章节页 |
| `FANQIE_STORAGE_STATE` | Playwright 登录态保存路径 |
| `FANQIE_CHROME_EXECUTABLE` | 可选的 Chrome 可执行文件路径 |
| `FANQIE_SCREENSHOT_DIR` | 调试截图保存目录 |
| `FANQIE_NEW_CHAPTER_SELECTOR` | 新建章节按钮选择器 |
| `FANQIE_CHAPTER_NUMBER_SELECTOR` | 章节号输入框选择器 |
| `FANQIE_TITLE_SELECTOR` | 标题输入框选择器 |
| `FANQIE_CONTENT_SELECTOR` | 正文编辑器选择器 |
| `FANQIE_SCHEDULE_SELECTOR` | 定时发布时间输入框选择器 |
| `FANQIE_SUBMIT_SELECTOR` | 提交按钮选择器 |
| `FANQIE_LOGIN_CHECK_SELECTOR` | 登录检查选择器 |
| `FANQIE_CAPTCHA_SELECTOR` | 验证码检查选择器 |
| `FANQIE_CONFIRM_SUBMIT` | 是否允许真实提交 |

`FANQIE_CONFIRM_SUBMIT` 的建议值：

- 留空：填充页面但不提交，适合调试。
- `next-only`：只点击下一步，不做最终提交。
- `yes`：允许自动提交，请谨慎使用。

## 使用流程

### 创建小说

1. 登录后台。
2. 进入小说列表。
3. 点击新建小说。
4. 输入一句话灵感，使用 AI 生成方案。
5. 检查并修改 AI 回填内容。
6. 创建小说。

### 规划大纲

1. 进入小说详情。
2. 生成或编辑总纲。
3. 进入大纲页面。
4. 生成分卷卷纲。
5. 检查每卷章节范围、目标、冲突、高潮。

### 生成章节

1. 进入章节页面。
2. 创建章节或按卷批量生成章节细纲。
3. 打开单章。
4. 点击“生成前检查”，确认连续性风险。
5. 检查章节细纲和编辑诊断。
6. 点击“根据细纲生成正文”。
7. 查看生成后校验、章节摘要和自动自审。
8. 执行“结构化审稿”。
9. 根据审稿报告生成修订版。
10. 人工确认后应用修订版。
11. 标记为定稿。

### 使用长篇记忆

1. 进入小说的“记忆”页面。
2. 点击“重建本书记忆索引”，将现有章节、人物、世界观、伏笔和时间线写入记忆块。
3. 对新生成或刚修改的章节，可单独点击“索引章节”。
4. 在检索测试框输入人物、设定、伏笔或剧情关键词，检查召回结果。
5. 后续生成正文时，系统会自动检索相关远期记忆并加入 prompt。

### 发布章节

1. 配置番茄作品 URL。
2. 使用 `npm run fanqie:login` 保存登录态。
3. 将已定稿章节加入发布队列。
4. 先在 `.env` 中保持 `FANQIE_CONFIRM_SUBMIT` 为空进行测试。
5. 确认选择器和流程稳定后，再设置为 `yes`。
6. 使用 `npm run fanqie:publish` 执行队列。

## 生产部署参考

### 1. 安装依赖并构建

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run build
```

### 2. 使用 PM2 启动

项目包含 `ecosystem.config.js`，可使用：

```bash
pm2 start ecosystem.config.js
pm2 save
```

或直接：

```bash
pm2 start npm --name novel-ai-web -- run start
```

### 3. Nginx 反向代理示例

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

### 4. 发布脚本定时运行

可以用 cron 定时执行：

```bash
*/10 * * * * cd /var/www/novel-ai-web && npm run fanqie:publish >> logs/fanqie-cron.log 2>&1
```

也可以用 PM2 管理单独的 worker 脚本。

## 安全注意事项

请不要提交以下内容到 GitHub：

- `.env`。
- `.auth/`。
- `logs/`。
- 番茄登录态。
- 发布调试截图。
- 真实数据库连接字符串。
- 真实 API Key。
- 真实后台密码哈希。

项目 `.gitignore` 已默认忽略这些文件，但开源前仍建议执行：

```bash
git status --ignored
git ls-files -o --exclude-standard
```

确认没有敏感文件进入暂存区。

如果你不小心把密钥提交到了公开仓库，应立即：

1. 删除公开仓库中的敏感文件。
2. 轮换 DeepSeek API Key。
3. 修改数据库密码。
4. 修改 `SESSION_SECRET`。
5. 重新生成番茄登录态。

## 当前限制

- AI 任务仍主要由 Server Action 同步执行，超长生成任务可能受部署环境超时影响。
- `AiTask` 已具备队列扩展字段，但尚未实现独立后台 worker 消费。
- 记忆检索已支持 embedding 和关键词兜底，但生产部署默认未强依赖 pgvector；如需更大规模向量检索，可进一步迁移到 PostgreSQL + pgvector。
- 多模型配置页面已经具备配置台账，但任务运行时仍主要使用环境变量中的默认模型。
- Token 和成本字段已经预留，当前还未从模型响应中自动计算费用。
- 番茄发布自动化依赖网页结构，平台页面变更后可能需要调整选择器。
- 目前更适合个人或小团队使用，多租户、权限分级和团队协作仍待增强。

## 已完成优化路线

当前已经完成后续优化文档中各阶段的第一版落地：

- P0：生成前检查、正文生成后校验、AI 任务复制和失败重试。
- P1：结构化审稿报告、审稿问题项、基于审稿生成修订版、人工应用修订版。
- P2：长篇记忆块、章节摘要/正文/人物/世界观/伏笔/时间线索引、生成前记忆检索。
- P3：人物状态历史、世界观修订历史、伏笔事件模型。
- P4：章节编辑诊断、禁用词和格式风险提示。
- P5：AI 任务运营字段、多模型配置台账、token 和成本字段预留。

## 后续可增强方向

- 将 `MemoryChunk.embedding` 从 JSON 存储迁移到 pgvector，并使用数据库向量索引。
- 为 AI 任务增加独立 worker，避免长任务阻塞页面请求。
- 接入 `AiModelConfig` 到实际任务路由，让不同任务自动选择不同模型。
- 自动解析模型返回的 token usage 并计算估算成本。
- 增加当前正文 vs 修订版、当前正文 vs 历史版本的 diff 对比视图。
- 扩展伏笔页面，展示从埋设、发展到回收的完整事件流。
- 增加章节编辑器自动保存、查找替换和更细的文本质量检查。

更多细节可参考项目中的后续优化文档。

## 开源协议

请根据你的实际开源计划添加许可证文件，例如 MIT、Apache-2.0 或 GPL-3.0。

在没有明确 `LICENSE` 文件前，默认并不等于允许他人自由复制、分发或商用。建议正式开源前补充 `LICENSE`。

## 免责声明

本项目用于个人创作辅助和自动化工作流研究。使用 AI 生成内容时，请自行检查内容质量、版权风险、平台规则和发布合规性。

番茄发布脚本仅用于辅助个人操作。使用前请确认相关平台规则，并自行承担自动化操作带来的风险。
