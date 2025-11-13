import { fetchAllHotspots, HotspotItem } from './hotspot';
import { translateAndCategorize, generateBriefing, TranslatedItem } from './llm';
import { getCache, setCache } from './cache';
import { CACHE_TTL } from '@/lib/constants';
import db from '@/lib/db';

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
  sources: string[];
  items: TranslatedItem[];
  createdAt: string;
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

  // 生成简报
  const { briefing, sources } = await generateBriefing(translatedItems, customRequirement);

  const result: BriefingResult = {
    briefing,
    sources,
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
  limit: number = 100
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

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

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

  return {
    translated_title: translatedTitle,
    source_url: sourceUrl,
    category: categoryValue as TranslatedItem['category'],
  };
}

export function getTranslatedHotspotsByCategories(
  categories: string[] = [],
  limit: number = 60
): TranslatedItem[] {
  const sanitizedCategories = Array.from(
    new Set(
      categories
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  let query = `SELECT id, source_type, content, processed_content, category, created_at FROM hotspots`;
  const params: any[] = [];

  if (sanitizedCategories.length > 0) {
    const placeholders = sanitizedCategories.map(() => '?').join(',');
    query += ` WHERE category IN (${placeholders})`;
    params.push(...sanitizedCategories);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
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

