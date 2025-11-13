# 技术实现方案

## 1 项目一句话介绍
基于 Next.js 的实时热点简报生成系统，通过 API 聚合热点内容，利用 LLM 智能翻译分类，为用户提供个性化新闻简报服务。

## 2 功能清单
用户注册登录 → API Key 管理 → 热点订阅 → 智能简报生成 → 个性化聊天查询 → 简报历史查看

## 3 整体架构分层（MVP 版）

### 前端层 (Next.js)
```
/pages
  ├── /auth          # 登录注册
  ├── /dashboard     # 个人中心
  ├── /briefing      # 简报展示
  └── /chat          # 聊天界面
/components          # UI 组件
/lib                 # 工具函数
```

### API 层 (Next.js API Routes)
```
/api
  ├── /auth          # 认证
  ├── /user          # 用户管理
  ├── /briefing      # 简报生成
  ├── /hotspots      # 热点获取
  └── /chat          # 聊天接口
```

### 服务层 (Services)
```
/services
  ├── hotspot.js     # 热点聚合服务
  ├── llm.js         # LLM 调用服务
  ├── briefing.js    # 简报生成服务
  ├── cache.js       # 内存缓存服务
  └── scheduler.js   # 定时任务调度
```

### 数据层
```
Database: better-sqlite3
├── users            # 用户表
├── api_keys         # API Key 表
├── subscriptions    # 订阅表
├── hotspots         # 热点缓存表
├── briefings        # 简报历史表
└── cache            # 内存缓存表
```

### 核心技术栈
- **框架**: Next.js 14 (App Router)
- **数据库**: better-sqlite3
- **状态管理**: React Hooks + SWR
- **LLM**: 硅基流动 API
- **认证**: JWT + NextAuth.js
- **缓存**: 内存缓存 + SQLite 缓存

### 异步任务处理
```
定时任务: 每5分钟拉取热点 → 内存缓存 → LLM处理 → 数据库存储
用户请求: 实时查询缓存 → 缓存未命中 → 异步生成 → 返回结果
```

---
# 热点获取

包括 新闻头条、60s新闻、HackerNews、百炼智能体、Rss、

<新闻头条>
curl -k -i "http://v.juhe.cn/toutiao/index?key=key&type=top&page=20&page_size=&is_filter="
API Key：85a3fd38ef18a9120ca41a78453eeeed
<新闻头条>

<60s 新闻> 
curl "https://60s.viki.moe/v2/60s"
</60s 新闻> 

<HackerNews> 
脚本文件 HackerNews.js
</HackerNews> 

- HackerNews.js脚本
```javascript
const https = require('https');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function getTopHNStories(count = 50) {
    // 获取最新的故事ID列表
    const storyIds = await fetchJson('https://hacker-news.firebaseio.com/v0/newstories.json');
    // 选取前N个ID
    const topIds = storyIds.slice(0, count);

    // 并发获取每个故事的详情
    const storyPromises = topIds.map(id => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`));
    const stories = await Promise.all(storyPromises);

    // 过滤掉可能获取失败的空项
    const validStories = stories.filter(story => story && story.title);

    // 生成Markdown内容
    let mdContent = `# Hacker News Top ${validStories.length} Stories\n\n`;
    for (let i = 0; i < validStories.length; i++) {
        const story = validStories[i];
        const title = story.title || 'No Title';
        const url = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
        const domain = story.url ? ` (${new URL(story.url).hostname})` : '';
        const score = story.score || 0;
        const author = story.by || 'Unknown';
        const time = new Date(story.time * 1000).toISOString().split('T')[0]; // 格式化日期
        const commentsCount = story.descendants || 0;

        mdContent += `## ${i + 1}. [${title}](${url})${domain}\n\n`;
        mdContent += `**Score:** ${score} | **Author:** ${author} | **Date:** ${time} | **Comments:** ${commentsCount}\n\n`;
    }

    return mdContent;
}

// 主执行函数
async function main() {
    try {
        const markdownOutput = await getTopHNStories(50);
        console.log(markdownOutput);
    } catch (error) {
        console.error('Error fetching stories:', error.message);
    }
}

// 运行脚本
main();
```

<百炼智能体> 
curl -X POST https://dashscope.aliyuncs.com/api/v1/apps/YOUR_APP_ID/completion \
--header "Authorization: Bearer $DASHSCOPE_API_KEY" \
--header 'Content-Type: application/json' \
--data '{
    "input": {
        "prompt": "你是谁？"
    },
    "parameters":  {},
    "debug": {}
}' 

应用ID：9e2f319c1c694005b15488123933ddd0
DASHSCOPE_API_KEY：sk-93bfcb1243ae4361ac8ae788ed1042aa
<百炼智能体/> 

<Rss>
订阅源：
[
  "https://techcrunch.com/feed/",
  "https://www.producthunt.com/feed",
  "https://www.theverge.com/rss/index.xml",
  "https://stratechery.com/feed/",
  "https://www.solidot.org/index.rss"
]
<Rss/>


# LLM 翻译分类整理、个性化输出简报

## API
```
curl --request POST \
  --url https://api.siliconflow.cn/v1/chat/completions \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "model": "MiniMaxAI/MiniMax-M2",
  "messages": [
    {
      "role": "user",
      "content": "What opportunities and challenges will the Chinese large model industry face in 2025?"
    }
  ]
}’

—-
<token> ：sk-mbapilob****s****cgxcbehkeiquvoe
```

## 翻译分类整理的System Prompt
```markdown
你是一个专业的信息处理助手，负责将输入的资讯条目进行结构化处理。你的任务是：

1.  **准确翻译**：将每条资讯的标题从英文翻译为自然、流畅的中文，保留专业术语的准确性，避免生硬直译。
2.  **精确分类**：根据内容实质，将每条资讯归入以下四类之一：
    *   **技术工具**：指可被开发者直接使用、集成或调用的软件、库、CLI工具、API、插件等。
    *   **前沿研究**：指基于学术论文、实验发现或科学突破的成果，旨在解决基础科学或工程难题，通常发表于学术平台或权威媒体。
    *   **行业动态**：指关于公司战略、市场趋势、融资、政策、重大合作或产业生态变化的新闻。
    *   **其他*：无法明确归入以上三类的条目。
3.  **结构化输出**：严格输出一个 JSON 对象数组，每个对象包含且仅包含以下三个键：`"translated_title"`、`"source_url"`、`"category"`。**不要**包含任何额外的解释、说明、Markdown 格式或注释。
```

## 个性化输出简报的System Prompt
```markdown
你是一个敏锐的 AI 创业观察者，以「创业者日记」的口吻处理输入的资讯条目列表（每个条目含 `"translated_title"`、`"source_url"`、`"category"`）。  

**默认行为（用户未提供额外要求时）**：  
- 用不超过 140 字提炼所有条目的**共同洞察**，而非罗列事实。  
- 聚焦三件事：**谁在解决什么真问题？为何此刻重要？隐含何种范式转移？**  
- 优先捕捉具备**自然语言界面、氛围编程（Vibe Coding）或 AI Agent 协作潜力**的信号。  
- 语气带判断、有情绪，像你真的会记在备忘录里的那句话。  

**若用户提供了自定义要求**：  
- 严格按用户要求生成 140 字内简报，仍保持精炼、洞察导向、拒绝泛泛而谈。  

**输出格式固定为两段**：  
1. **第一段**：140 字内的日记体简报（含情绪与判断）。  
2. **第二段**：来源清单，列出140字日记体简报所提及的条目的 `source_url`，每行一个**来源url**。  

永远不解释、不总结格式、不添加额外文本。
```


# 基于API Key的身份认证机制

API 服务，提供基本的身份认证和权限控制，适合中小型应用的API访问需求。
(数据用better-sqlite3存储)


### 1. 整体架构
采用基于API Key的身份认证机制，主要包含以下几个核心组件：
- **API认证中间件**  
- **API Key生成和验证** 
- **用户权限管理** 
- **前端API Key管理界面** 


### 2. API Key生成机制
- **格式**: `news_` + 32位十六进制随机字符串
- **安全性**: 使用随机数生成，每次生成都是唯一的
- **存储**: 直接存储在用户数据中


### 3. 账号权限
- **普通用户**: 只能访问自己的数据


### 4. 权限控制实现
- **API访问**: 所有API端点都需要通过 中间件验证
- **数据隔离**: 用户只能访问自己的数据 
- **会话验证**: 同时支持基于Cookie的会话认证和API Key认证


### 5. 安全特性
- **唯一性**: 每个用户只能有一个API Key
- **重新生成**: 可以重新生成API Key，旧的会失效
- **错误处理**: 完善的错误处理和日志记录

# GUI
采用shadcn/ui 

---
title: Next.js
description: Install and configure shadcn/ui for Next.js.
---

<Steps>

### Create project

Run the `init` command to create a new Next.js project or to setup an existing one:

```bash
npx shadcn@latest init
```

Choose between a Next.js project or a Monorepo.

### Add Components

You can now start adding components to your project.

```bash
npx shadcn@latest add button
```

The command above will add the `Button` component to your project. You can then import it like this:

```tsx {1,6} showLineNumbers title="app/page.tsx"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div>
      <Button>Click me</Button>
    </div>
  )
}
```

</Steps>
