import axios from 'axios';
import Parser from 'rss-parser';
import { 
  JUHE_API_KEY, 
  JUHE_API_URL, 
  NEWS_60S_URL, 
  HACKER_NEWS_API, 
  RSS_FEEDS,
  HOTSPOT_SOURCES 
} from '@/lib/constants';

const parser = new Parser();

export interface HotspotItem {
  title: string;
  url: string;
  source: string;
  sourceType: string;
  summary?: string;
  publishedAt?: string;
  metadata?: Record<string, any>;
}

// 获取新闻头条（聚合数据）
export async function fetchJuheToutiao(): Promise<HotspotItem[]> {
  try {
    const response = await axios.get(JUHE_API_URL, {
      params: {
        key: JUHE_API_KEY,
        type: 'top',
        page: 1,
        page_size: 20,
      },
    });

    if (response.data.error_code === 0 && response.data.result?.data) {
      return response.data.result.data.map((item: any) => ({
        title: item.title,
        url: item.url,
        source: '聚合数据',
        sourceType: HOTSPOT_SOURCES.JUHE_TOUTIAO,
        summary: item.title,
        publishedAt: item.date,
        metadata: item,
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching Juhe Toutiao:', error);
    return [];
  }
}

// 获取 60s 新闻
export async function fetch60sNews(): Promise<HotspotItem[]> {
  try {
    const response = await axios.get(NEWS_60S_URL);
    
    if (response.data && response.data.data) {
      const data = response.data.data;
      return [{
        title: data.title || '60秒新闻',
        url: data.url || '',
        source: '60s新闻',
        sourceType: HOTSPOT_SOURCES.NEWS_60S,
        summary: data.content || data.text || '',
        publishedAt: new Date().toISOString(),
        metadata: data,
      }];
    }
    return [];
  } catch (error) {
    console.error('Error fetching 60s news:', error);
    return [];
  }
}

// 获取 HackerNews 故事
async function fetchHackerNewsItem(id: number): Promise<any> {
  try {
    const response = await axios.get(HACKER_NEWS_API.ITEM(id));
    return response.data;
  } catch (error) {
    console.error(`Error fetching HN item ${id}:`, error);
    return null;
  }
}

// 获取 HackerNews Top Stories
export async function fetchHackerNews(count: number = 50): Promise<HotspotItem[]> {
  try {
    const response = await axios.get(HACKER_NEWS_API.NEW_STORIES);
    const storyIds = response.data.slice(0, count);

    const storyPromises = storyIds.map((id: number) => fetchHackerNewsItem(id));
    const stories = await Promise.all(storyPromises);

    const validStories = stories.filter((story: any) => story && story.title);

    return validStories.map((story: any) => ({
      title: story.title || 'No Title',
      url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
      source: 'HackerNews',
      sourceType: HOTSPOT_SOURCES.HACKER_NEWS,
      summary: `${story.score || 0} points by ${story.by || 'Unknown'}`,
      publishedAt: story.time ? new Date(story.time * 1000).toISOString() : undefined,
      metadata: {
        score: story.score || 0,
        author: story.by || 'Unknown',
        comments: story.descendants || 0,
        id: story.id,
      },
    }));
  } catch (error) {
    console.error('Error fetching HackerNews:', error);
    return [];
  }
}

// 获取 RSS 订阅内容
export async function fetchRSSFeeds(): Promise<HotspotItem[]> {
  const allItems: HotspotItem[] = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      
      if (feed.items) {
        const items = feed.items.slice(0, 10).map((item) => ({
          title: item.title || 'No Title',
          url: item.link || '',
          source: feed.title || 'RSS Feed',
          sourceType: HOTSPOT_SOURCES.RSS,
          summary: item.contentSnippet || item.content || '',
          publishedAt: item.pubDate || new Date().toISOString(),
          metadata: {
            feedTitle: feed.title,
            feedUrl: feedUrl,
          },
        }));
        allItems.push(...items);
      }
    } catch (error) {
      console.error(`Error fetching RSS feed ${feedUrl}:`, error);
    }
  }

  return allItems;
}

// 去重函数：基于 URL 去重
function deduplicateByUrl(items: HotspotItem[]): HotspotItem[] {
  const seenUrls = new Set<string>();
  const uniqueItems: HotspotItem[] = [];

  for (const item of items) {
    // 标准化 URL（去除查询参数、尾部斜杠等）
    const normalizedUrl = item.url
      .toLowerCase()
      .replace(/\/$/, '') // 移除尾部斜杠
      .split('?')[0]; // 移除查询参数

    if (!seenUrls.has(normalizedUrl) && normalizedUrl) {
      seenUrls.add(normalizedUrl);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

// 聚合所有热点
export async function fetchAllHotspots(): Promise<HotspotItem[]> {
  const [juhe, news60s, hackerNews, rss] = await Promise.allSettled([
    fetchJuheToutiao(),
    fetch60sNews(),
    fetchHackerNews(30),
    fetchRSSFeeds(),
  ]);

  const allItems: HotspotItem[] = [];

  if (juhe.status === 'fulfilled') allItems.push(...juhe.value);
  if (news60s.status === 'fulfilled') allItems.push(...news60s.value);
  if (hackerNews.status === 'fulfilled') allItems.push(...hackerNews.value);
  if (rss.status === 'fulfilled') allItems.push(...rss.value);

  // 去重
  return deduplicateByUrl(allItems);
}

