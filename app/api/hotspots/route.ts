import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { getHotspotsFromDatabase } from '@/services/briefing';
import { getCache, setCache } from '@/services/cache';
import { CACHE_TTL, CATEGORY_COLORS } from '@/lib/constants';
import { HotspotItem } from '@/services/hotspot';

// 获取热点列表（支持搜索和分类筛选）
export async function GET(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';

    // 尝试从缓存获取
    const cacheKey = `hotspots:${search}:${category}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 从数据库查询热点（支持分类和搜索过滤）
    const dbHotspots = getHotspotsFromDatabase(
      category || undefined,
      search || undefined,
      100
    );

    // 解析并格式化返回数据
    const result = dbHotspots.map((row) => {
      let hotspotData: HotspotItem;
      let processedData: any = null;
      let categoryValue = row.category;

      try {
        hotspotData = JSON.parse(row.content);
      } catch (e) {
        // 如果解析失败，创建一个基本结构
        hotspotData = {
          title: 'Unknown',
          url: '',
          source: row.source_type,
          sourceType: row.source_type,
        };
      }

      // 尝试解析processed_content获取更多信息
      if (row.processed_content) {
        try {
          processedData = JSON.parse(row.processed_content);
          if (processedData && processedData.translated_title) {
            hotspotData.title = processedData.translated_title;
          }
          if (processedData && processedData.category) {
            categoryValue = processedData.category;
          }
        } catch (e) {
          // 解析失败，使用默认值
        }
      }

      // 如果提供了search参数，进行额外的客户端过滤（更精确的搜索）
      let shouldInclude = true;
      if (search) {
        const searchLower = search.toLowerCase();
        shouldInclude = 
          hotspotData.title.toLowerCase().includes(searchLower) ||
          hotspotData.summary?.toLowerCase().includes(searchLower) ||
          (processedData?.translated_title?.toLowerCase().includes(searchLower));
      }

      if (!shouldInclude) {
        return null;
      }

      return {
        ...hotspotData,
        id: row.id,
        category: categoryValue,
        categoryColor: CATEGORY_COLORS.OTHER, // 可以根据category映射不同颜色
        createdAt: row.created_at,
      };
    }).filter(item => item !== null);

    // 缓存结果
    await setCache(cacheKey, result, CACHE_TTL.HOTSPOTS);

    return NextResponse.json(result);
  });
}

