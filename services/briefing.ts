import { fetchAllHotspots, HotspotItem } from './hotspot';
import { translateAndCategorize, generateBriefing, TranslatedItem } from './llm';
import { getCache, setCache } from './cache';
import { CACHE_TTL } from '@/lib/constants';
import db from '@/lib/db';
import { retrieveKnowledge } from './dify';

type HotspotRow = {
  id: number;
  source_type: string;
  content: string;
  processed_content: string | null;
  category: string;
  created_at: string;
};

const VALID_TRANSLATED_CATEGORIES: TranslatedItem['category'][] = [
  '技术工具',
  '前沿研究',
  '行业动态',
  '其他',
];

export interface BriefingResult {
  briefing: string;
  sources: { url: string; title: string; content: string }[];
  items: TranslatedItem[];
  createdAt: string;
}

// 根据 URL 从数据库查询对应的 title 和 summary
function getSourceInfoByUrl(url: string): { title: string; content: string } | null {
  try {
    // 查询 hotspots 表，在 content JSON 字段中查找匹配的 url
    // 使用精确匹配 URL（转义特殊字符）
    const escapedUrl = url.replace(/"/g, '\\"');
    const urlPattern = `%"url":"${escapedUrl}"%`;
    
    const stmt = db.prepare(`
      SELECT content 
      FROM hotspots 
      WHERE content LIKE ? ESCAPE '\\'
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    const result = stmt.get(urlPattern) as { content: string } | undefined;
    
    if (!result) {
      return null;
    }
    
    // 解析 JSON
    const hotspotItem = JSON.parse(result.content) as HotspotItem;
    
    // 精确匹配 URL（区分大小写）
    if (!hotspotItem || hotspotItem.url !== url) {
      return null;
    }
    
    return {
      title: hotspotItem.title || '',
      content: hotspotItem.summary || '',
    };
  } catch (error) {
    console.error(`Error querying source info for URL ${url}:`, error);
    return null;
  }
}

// 将 URL 数组转换为 {url, title, content}[] 格式
export async function enrichSources(urls: string[]): Promise<{ url: string; title: string; content: string }[]> {
  const enrichedSources: { url: string; title: string; content: string }[] = [];
  
  for (const url of urls) {
    const info = getSourceInfoByUrl(url);
    if (info) {
      enrichedSources.push({
        url,
        title: info.title,
        content: info.content,
      });
    }
    // 如果找不到，跳过该 URL（根据用户要求）
  }
  
  return enrichedSources;
}

// 生成简报（带缓存）
export async function generateBriefingWithCache(
  userId?: number,
  customRequirement?: string
): Promise<BriefingResult> {
  const cacheKey = `briefing:${userId || 'default'}:${customRequirement || 'default'}`;

  // 先查缓存
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached;
  }

  // 获取热点
  const hotspots = await fetchAllHotspots();

  if (hotspots.length === 0) {
    return {
      briefing: '暂无热点资讯',
      sources: [],
      items: [],
      createdAt: new Date().toISOString(),
    };
  }

  // 翻译和分类
  const translatedItems = await translateAndCategorize(hotspots);

  // 检索历史知识（如果有用户要求）
  const historicalKnowledge = customRequirement 
    ? await retrieveKnowledge(customRequirement, 2)
    : [];

  // 生成简报
  const { briefing, sources } = await generateBriefing(translatedItems, customRequirement, historicalKnowledge);

  // 将 sources 转换为 [url, title, content][] 格式
  const enrichedSources = await enrichSources(sources);

  const result: BriefingResult = {
    briefing,
    sources: enrichedSources,
    items: translatedItems,
    createdAt: new Date().toISOString(),
  };

  // 保存到缓存
  await setCache(cacheKey, result, CACHE_TTL.BRIEFINGS);

  // 如果提供了 userId，保存到数据库
  if (userId) {
    const stmt = db.prepare(`
      INSERT INTO briefings (user_id, content, sources) 
      VALUES (?, ?, ?)
    `);
    stmt.run(userId, briefing, JSON.stringify(sources));
  }

  return result;
}

// 获取用户简报历史
export function getUserBriefingHistory(userId: number, limit: number = 20) {
  const stmt = db.prepare(`
    SELECT id, content, sources, created_at 
    FROM briefings 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(userId, limit) as Array<{
    id: number;
    content: string;
    sources: string;
    created_at: string;
  }>;
}

// 保存热点到数据库
export async function saveHotspotsToDatabase(
  hotspots: HotspotItem[], 
  translatedItems?: TranslatedItem[]
): Promise<void> {
  const stmt = db.prepare(`
    INSERT INTO hotspots (source_type, content, processed_content, category) 
    VALUES (?, ?, ?, ?)
  `);

  for (let i = 0; i < hotspots.length; i++) {
    const hotspot = hotspots[i];
    // 如果有翻译后的数据，提取category，否则使用默认值'其他'
    let category = '其他';
    if (translatedItems && translatedItems[i]) {
      const validCategories = ['技术工具', '前沿研究', '行业动态', '其他'];
      category = validCategories.includes(translatedItems[i].category) 
        ? translatedItems[i].category 
        : '其他';
    }
    
    stmt.run(
      hotspot.sourceType,
      JSON.stringify(hotspot),
      translatedItems && translatedItems[i] ? JSON.stringify(translatedItems[i]) : null,
      category
    );
  }
}

// 处理并保存热点（翻译分类后保存）
export async function processAndSaveHotspots(): Promise<void> {
  try {
    // 获取热点
    const hotspots = await fetchAllHotspots();
    
    if (hotspots.length === 0) {
      return;
    }

    // 翻译和分类
    const translatedItems = await translateAndCategorize(hotspots);

    // 保存原始热点和翻译分类后的数据（包括category字段）
    await saveHotspotsToDatabase(hotspots, translatedItems);
  } catch (error) {
    console.error('Error processing and saving hotspots:', error);
  }
}

// 获取所有分类
export function getAllCategories(): Array<{
  id: number;
  name: string;
  display_order: number;
  created_at: string;
}> {
  const stmt = db.prepare(`
    SELECT id, name, display_order, created_at 
    FROM categories 
    ORDER BY display_order ASC
  `);
  return stmt.all() as Array<{
    id: number;
    name: string;
    display_order: number;
    created_at: string;
  }>;
}

// 从数据库查询热点（支持分类和搜索过滤）
export function getHotspotsFromDatabase(
  category?: string,
  search?: string,
  limit: number = 100,
  offset: number = 0
): Array<{
  id: number;
  source_type: string;
  content: string;
  processed_content: string | null;
  category: string;
  created_at: string;
}> {
  let query = `SELECT id, source_type, content, processed_content, category, created_at FROM hotspots WHERE 1=1`;
  const params: any[] = [];

  // 分类过滤
  if (category && category.trim() && category !== 'All' && category !== '全部') {
    query += ` AND category = ?`;
    params.push(category);
  }

  // 搜索过滤（在content JSON中搜索）
  if (search && search.trim()) {
    query += ` AND (content LIKE ? OR processed_content LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const stmt = db.prepare(query);
  return stmt.all(...params) as Array<{
    id: number;
    source_type: string;
    content: string;
    processed_content: string | null;
    category: string;
    created_at: string;
  }>;
}

// 提取核心关键词（使用简单规则）
function extractCoreKeywords(keywords: string[]): string[] {
  if (!keywords || keywords.length === 0) {
    return [];
  }

  // 常见停用词（中英文）
  const stopWords = new Set([
    'ai', 'api', 'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'by', 'for',
    '的', '了', '是', '在', '和', '与', '或', '及', '等', '等', '相关', '关于'
  ]);

  // 过滤和评分关键词
  const scoredKeywords = keywords
    .map(k => k.trim())
    .filter(k => {
      // 过滤长度小于2的关键词
      if (k.length < 2) return false;
      // 过滤停用词（不区分大小写）
      if (stopWords.has(k.toLowerCase())) return false;
      return true;
    })
    .map(k => {
      // 评分：长度适中的关键词得分更高（3-20字符）
      let score = 0;
      const len = k.length;
      if (len >= 3 && len <= 20) {
        score = 10;
      } else if (len > 20) {
        score = 5; // 过长的关键词可能不够精确
      } else {
        score = 3; // 较短的关键词
      }
      // 中文字符加分（通常更有意义）
      if (/[\u4e00-\u9fa5]/.test(k)) {
        score += 2;
      }
      return { keyword: k, score };
    })
    .sort((a, b) => b.score - a.score) // 按分数降序排序
    .map(item => item.keyword);

  // 去重并保留前8个核心关键词
  const uniqueKeywords = Array.from(new Set(scoredKeywords));
  return uniqueKeywords.slice(0, 8);
}

function mapRowToTranslatedItem(row: HotspotRow): TranslatedItem | null {
  let parsedContent: HotspotItem | null = null;
  if (row.content) {
    try {
      parsedContent = JSON.parse(row.content) as HotspotItem;
    } catch (error) {
      console.warn('Failed to parse hotspot.content JSON:', error);
    }
  }

  let processedData: Partial<TranslatedItem> | null = null;
  if (row.processed_content) {
    try {
      processedData = JSON.parse(row.processed_content) as Partial<TranslatedItem>;
    } catch (error) {
      console.warn('Failed to parse hotspot.processed_content JSON:', error);
    }
  }

  const translatedTitle =
    processedData?.translated_title ||
    parsedContent?.title ||
    '未命名热点';

  const sourceUrl =
    processedData?.source_url ||
    parsedContent?.url ||
    '';

  if (!sourceUrl) {
    return null;
  }

  let categoryValue = processedData?.category || row.category || '其他';
  if (!VALID_TRANSLATED_CATEGORIES.includes(categoryValue as TranslatedItem['category'])) {
    categoryValue = '其他';
  }

  // 提取 summary（优先从原始 content 中获取，因为 summary 通常存储在 HotspotItem 中）
  const summary = parsedContent?.summary || '';

  return {
    translated_title: translatedTitle,
    source_url: sourceUrl,
    category: categoryValue as TranslatedItem['category'],
    summary: summary || undefined, // 如果为空字符串，返回 undefined
  };
}

export function getTranslatedHotspotsByCategories(
  categories: string[] = [],
  limit: number = 30,
  timeRange?: number | null,
  keywords?: string[]
): TranslatedItem[] {
  const sanitizedCategories = Array.from(
    new Set(
      categories
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  const sanitizedKeywords = Array.from(
    new Set(
      (keywords || [])
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  let query = `SELECT id, source_type, content, processed_content, category, created_at FROM hotspots WHERE 1=1`;
  const params: any[] = [];

  // 时间范围过滤
  if (timeRange !== null && timeRange !== undefined && timeRange > 0) {
    // SQLite datetime 函数：datetime('now', '-' || N || ' days')
    // 直接拼接数字到查询字符串中（timeRange 已经验证为正整数）
    query += ` AND created_at >= datetime('now', '-' || ${timeRange} || ' days')`;
  }

  // 关键词搜索（多关键词 OR 逻辑）
  if (sanitizedKeywords.length > 0) {
    const keywordConditions: string[] = [];
    for (const keyword of sanitizedKeywords) {
      keywordConditions.push(`(content LIKE ? OR processed_content LIKE ?)`);
      const searchPattern = `%${keyword}%`;
      params.push(searchPattern, searchPattern);
    }
    query += ` AND (${keywordConditions.join(' OR ')})`;
  }

  // 排序逻辑：如果提供了分类，匹配分类的优先；否则按时间排序
  if (sanitizedCategories.length > 0) {
    const placeholders = sanitizedCategories.map(() => '?').join(',');
    query += ` ORDER BY CASE WHEN category IN (${placeholders}) THEN 0 ELSE 1 END, created_at DESC LIMIT ?`;
    params.push(...sanitizedCategories);
  } else {
    query += ` ORDER BY created_at DESC LIMIT ?`;
  }
  params.push(Math.max(1, limit));

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as HotspotRow[];

  const seenUrls = new Set<string>();
  const results: TranslatedItem[] = [];

  for (const row of rows) {
    const item = mapRowToTranslatedItem(row);
    if (!item) {
      continue;
    }
    if (seenUrls.has(item.source_url)) {
      continue;
    }
    seenUrls.add(item.source_url);
    results.push(item);
  }

  return results;
}

// 带降级策略的查询函数
export function getTranslatedHotspotsWithFallback(
  categories: string[] = [],
  limit: number = 30,
  timeRange?: number | null,
  keywords?: string[]
): TranslatedItem[] {
  const MIN_RESULTS_THRESHOLD = 3;
  const TIME_RANGE_FALLBACKS = [3, 7, 30];

  // 1. 先使用原始条件查询
  let results = getTranslatedHotspotsByCategories(categories, limit, timeRange, keywords);
  console.log(`[Fallback] 原始查询: timeRange=${timeRange}, keywords=${keywords?.length || 0}, 结果=${results.length}`);

  // 如果结果数量足够，直接返回
  if (results.length >= MIN_RESULTS_THRESHOLD) {
    return results;
  }

  // 2. 如果结果不足，逐步放宽时间范围
  if (timeRange !== null && timeRange !== undefined && timeRange > 0) {
    const originalTimeRange = timeRange;
    for (const fallbackTimeRange of TIME_RANGE_FALLBACKS) {
      // 只尝试比原始时间范围更大的值
      if (fallbackTimeRange <= originalTimeRange) {
        continue;
      }
      
      results = getTranslatedHotspotsByCategories(categories, limit, fallbackTimeRange, keywords);
      console.log(`[Fallback] 放宽时间范围到 ${fallbackTimeRange} 天: 结果=${results.length}`);
      
      if (results.length >= MIN_RESULTS_THRESHOLD) {
        return results;
      }
    }
  } else {
    // 如果原始没有时间范围限制，尝试添加时间范围
    for (const fallbackTimeRange of TIME_RANGE_FALLBACKS) {
      results = getTranslatedHotspotsByCategories(categories, limit, fallbackTimeRange, keywords);
      console.log(`[Fallback] 添加时间范围 ${fallbackTimeRange} 天: 结果=${results.length}`);
      
      if (results.length >= MIN_RESULTS_THRESHOLD) {
        return results;
      }
    }
  }

  // 3. 如果放宽时间范围后仍不足，使用核心关键词重试
  if (keywords && keywords.length > 0) {
    const coreKeywords = extractCoreKeywords(keywords);
    console.log(`[Fallback] 提取核心关键词: ${coreKeywords.length} 个 (原始: ${keywords.length} 个)`);
    
    if (coreKeywords.length > 0) {
      // 先尝试原始时间范围 + 核心关键词
      if (timeRange !== null && timeRange !== undefined && timeRange > 0) {
        results = getTranslatedHotspotsByCategories(categories, limit, timeRange, coreKeywords);
        console.log(`[Fallback] 核心关键词 + 原始时间范围 ${timeRange} 天: 结果=${results.length}`);
        
        if (results.length >= MIN_RESULTS_THRESHOLD) {
          return results;
        }
      }

      // 再尝试放宽时间范围 + 核心关键词
      const timeRangesToTry = timeRange !== null && timeRange !== undefined && timeRange > 0
        ? TIME_RANGE_FALLBACKS.filter(tr => tr > timeRange)
        : TIME_RANGE_FALLBACKS;

      for (const fallbackTimeRange of timeRangesToTry) {
        results = getTranslatedHotspotsByCategories(categories, limit, fallbackTimeRange, coreKeywords);
        console.log(`[Fallback] 核心关键词 + 时间范围 ${fallbackTimeRange} 天: 结果=${results.length}`);
        
        if (results.length >= MIN_RESULTS_THRESHOLD) {
          return results;
        }
      }
    }
  }

  // 4. 如果所有策略都失败，返回最后一次查询的结果（可能为空）
  console.log(`[Fallback] 所有降级策略尝试完毕，最终结果=${results.length}`);
  return results;
}

