// RSS 订阅源列表
export const RSS_FEEDS = [
  "https://techcrunch.com/feed/",
  "https://www.producthunt.com/feed",
  "https://www.theverge.com/rss/index.xml",
  "https://stratechery.com/feed/",
  "https://www.solidot.org/index.rss"
];

// 分类颜色映射
export const CATEGORY_COLORS: Record<string, string> = {
  TECH: "blue",
  POLITICS: "red",
  FINANCE: "green",
  CULTURE: "purple",
  OTHER: "gray",
};

// 分类标签映射
export const CATEGORY_LABELS: Record<string, string> = {
  TECH: "技术工具",
  POLITICS: "政治",
  FINANCE: "金融",
  CULTURE: "文化",
  OTHER: "其他",
};

// 聚合数据 API 配置
export const JUHE_API_KEY = process.env.JUHE_API_KEY || "85a3fd38ef18a9120ca41a78453eeeed";
export const JUHE_API_URL = "http://v.juhe.cn/toutiao/index";

// 60s 新闻 API
export const NEWS_60S_URL = "https://60s.viki.moe/v2/60s";

// HackerNews API
export const HACKER_NEWS_API = {
  NEW_STORIES: "https://hacker-news.firebaseio.com/v0/newstories.json",
  ITEM: (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
};

// 硅基流动 API 配置
export const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || "";
export const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/chat/completions";
export const SILICONFLOW_MODEL = "MiniMaxAI/MiniMax-M2";

// LLM 模型配置（不同功能使用不同模型）
export const LLM_MODEL_CLASSIFY = process.env.LLM_MODEL_CLASSIFY || "Qwen/Qwen2.5-7B-Instruct";
export const LLM_MODEL_TRANSLATE = process.env.LLM_MODEL_TRANSLATE || "deepseek-ai/DeepSeek-V3";
export const LLM_MODEL_BRIEFING = process.env.LLM_MODEL_BRIEFING || "deepseek-ai/DeepSeek-V3";

// 热点源类型
export const HOTSPOT_SOURCES = {
  JUHE_TOUTIAO: "juhe_toutiao",
  NEWS_60S: "news_60s",
  HACKER_NEWS: "hacker_news",
  RSS: "rss",
} as const;

// 缓存过期时间（秒）
export const CACHE_TTL = {
  HOTSPOTS: 300, // 5分钟
  BRIEFINGS: 600, // 10分钟
  GENERAL: 3600, // 1小时
} as const;

