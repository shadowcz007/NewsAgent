# Hot Topics AI - 实时热点简报生成系统

基于 Next.js 14 的实时热点简报生成系统，通过 API 聚合热点内容，利用 LLM 智能翻译分类，为用户提供个性化新闻简报服务。

## 功能特性

- 🔐 用户注册登录（NextAuth.js + JWT）
- 🔑 API Key 管理
- 📰 热点聚合（新闻头条、60s新闻、HackerNews、RSS）
- 🤖 LLM 智能翻译分类
- 📊 个性化简报生成
- 💬 AI 助手聊天
- 📜 简报历史查看
- ⏰ 定时任务自动拉取热点（每5分钟）

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **数据库**: better-sqlite3
- **认证**: NextAuth.js + JWT + API Key
- **UI**: shadcn/ui + Tailwind CSS
- **状态管理**: SWR
- **LLM**: 硅基流动 API
- **定时任务**: node-cron

## 项目结构

```
NewsAgent/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 认证页面
│   ├── api/               # API 路由
│   ├── components/        # React 组件
│   ├── dashboard/         # 仪表板
│   ├── briefing/          # 简报页面
│   └── page.tsx           # 主页面
├── services/              # 业务逻辑服务
│   ├── hotspot.ts         # 热点聚合
│   ├── llm.ts             # LLM 服务
│   ├── briefing.ts        # 简报生成
│   ├── cache.ts           # 缓存服务
│   └── scheduler.ts       # 定时任务
├── lib/                   # 工具函数
│   ├── db.ts              # 数据库
│   ├── auth.ts            # 认证
│   ├── middleware.ts      # 中间件
│   └── constants.ts       # 常量
└── data/                  # 数据库文件
    └── db.sqlite
```

## 环境变量配置

创建 `.env.local` 文件（参考 `.env.example`）：

```env
# NextAuth 配置
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# 硅基流动 API
SILICONFLOW_API_KEY=your-siliconflow-api-key

# LLM 模型配置（不同功能使用不同模型）
LLM_MODEL_CLASSIFY=Qwen/Qwen2.5-7B-Instruct
LLM_MODEL_TRANSLATE=deepseek-ai/DeepSeek-V3
LLM_MODEL_BRIEFING=deepseek-ai/DeepSeek-V3

# 聚合数据 API（可选，已有默认值）
JUHE_API_KEY=85a3fd3xxxa41a78453eeeed

# Dify 知识库 API（可选，已有默认值）
DIFY_DATASET_ID=0593f5a9-d08d-4e1d-b432-5f39ae252e05
DIFY_API_KEY=dataset-kQrj2zG3jiMJfRKqu2rYCVzn
```

## 安装和启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.local` 并填入必要的配置。

### 3. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动。

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 数据库初始化

数据库会在首次运行时自动创建。数据库文件位于 `data/db.sqlite`。

表结构：
- `users` - 用户表
- `api_keys` - API Key 表
- `subscriptions` - 订阅表
- `hotspots` - 热点缓存表
- `briefings` - 简报历史表
- `cache` - 缓存表

## API 使用

### 认证

所有 API 端点支持两种认证方式：
1. **Session 认证**：通过 NextAuth.js Cookie
2. **API Key 认证**：通过 `x-api-key` Header 或 `Authorization: Bearer <api-key>`

### 获取 API Key

登录后访问 `/dashboard` 生成 API Key。

### API 端点

- `GET /api/hotspots` - 获取热点列表
- `GET /api/briefing/history` - 获取简报历史
- `POST /api/chat` - AI 聊天接口（支持生成个性化简报）
- `GET /api/user/api-key` - 获取 API Key
- `POST /api/user/api-key` - 生成新 API Key

## UI/UX 设计

根据设计图实现：
- **Header**: Logo、搜索栏、分类筛选、用户菜单
- **主页面**: 双栏布局（左侧简报 + 右侧聊天）
- **简报卡片**: 分类标签、标题、摘要、来源信息
- **聊天界面**: 消息气泡、输入框、发送按钮

## 定时任务

系统会自动每5分钟拉取热点并处理：
- 获取所有热点源数据
- 翻译和分类
- 保存到数据库
- 更新缓存

## 开发说明

### 添加新的热点源

在 `services/hotspot.ts` 中添加新的获取函数，并在 `fetchAllHotspots` 中调用。

### 自定义 LLM Prompt

修改 `services/llm.ts` 中的 `TRANSLATE_CATEGORIZE_PROMPT` 和 `BRIEFING_PROMPT`。

### 添加新的 UI 组件

使用 shadcn/ui 添加组件：
```bash
npx shadcn@latest add <component-name>
```

## 故障排除

### 数据库错误

确保 `data/` 目录存在且有写入权限。

### API Key 认证失败

检查 API Key 格式是否正确（应以 `news_` 开头）。

### LLM API 错误

检查 `SILICONFLOW_API_KEY` 是否正确配置。

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

