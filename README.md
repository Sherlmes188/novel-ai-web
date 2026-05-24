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
- 生成后自动更新章节字数和小说总字数。

### 自动摘要、自审和资料回写

章节正文生成后，系统会再次调用 AI 进行后处理：

- 提取 300 字以内章节摘要。
- 生成连续性自审结果。
- 提取人物状态变化。
- 提取新增或确认的世界观信息。
- 回写章节摘要、人物当前状态、人物物品/境界/关系、世界观资料。

这个机制用于给长篇小说建立“滚动记忆”，让后续章节不必依赖完整正文，也能承接前文状态。

### 人物与世界观资料库

- 人物资料字段包括姓名、别名、性别、年龄、身份、势力、阵营、外貌、性格、说话风格、能力、境界、技能、物品、目标、秘密、角色弧光、当前状态等。
- 世界观资料按分类和重要程度管理。
- AI 生成章节后可自动更新重要人物和世界观条目。

### 禁用词和禁用烂梗

- 按小说维护禁用表达库。
- 支持分类、备注和严重程度。
- 生成提示词时会把禁用表达加入上下文，要求 AI 避免使用。

### AI 任务记录

- 每次 AI 调用都会记录为任务。
- 任务记录包含任务类型、目标对象、状态、prompt、输出、错误信息、模型、开始时间和结束时间。
- 方便排查生成失败、prompt 问题和模型输出问题。

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
│       ├── db.ts
│       ├── deepseek.ts
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
- `Version`：版本归档。
- `PublicationJob`：发布队列任务。

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
4. 检查章节细纲。
5. 点击“根据细纲生成正文”。
6. 查看 AI 审稿和章节摘要。
7. 手动修改正文。
8. 标记为定稿。

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

- 当前 AI 任务主要是同步 Server Action，长任务可能受部署环境超时影响。
- 目前没有向量检索/RAG，长篇远期记忆主要依赖摘要、人物和世界观表。
- 审稿结果仍以文本为主，结构化审稿和自动修稿闭环仍待完善。
- 番茄发布自动化依赖网页结构，平台页面变更后可能需要调整选择器。
- 目前更适合个人或小团队使用，多租户、权限分级、成本统计仍待增强。

## 后续路线图

计划优化方向：

- 结构化审稿报告。
- 根据审稿报告自动生成修订版。
- 修订版和原文 diff 对比。
- 章节生成前检查。
- 章节生成后格式校验。
- pgvector / RAG 长篇记忆检索。
- 角色状态历史表。
- 伏笔生命周期追踪。
- 世界观版本历史。
- 异步 AI 任务队列。
- 多模型配置。
- Token 和成本统计。
- 更完整的创作工作台界面。

更多细节可参考项目中的后续优化文档。

## 开源协议

请根据你的实际开源计划添加许可证文件，例如 MIT、Apache-2.0 或 GPL-3.0。

在没有明确 `LICENSE` 文件前，默认并不等于允许他人自由复制、分发或商用。建议正式开源前补充 `LICENSE`。

## 免责声明

本项目用于个人创作辅助和自动化工作流研究。使用 AI 生成内容时，请自行检查内容质量、版权风险、平台规则和发布合规性。

番茄发布脚本仅用于辅助个人操作。使用前请确认相关平台规则，并自行承担自动化操作带来的风险。

