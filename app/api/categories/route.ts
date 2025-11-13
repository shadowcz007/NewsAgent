import { NextRequest, NextResponse } from 'next/server';
import { getAllCategories } from '@/services/briefing';
import { getCache, setCache } from '@/services/cache';
import { CACHE_TTL } from '@/lib/constants';

// 获取所有分类列表（公开接口，不需要认证）
export async function GET(request: NextRequest) {
  // 尝试从缓存获取
  const cacheKey = 'categories:all';
  const cached = await getCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // 从数据库查询所有分类
  const categories = getAllCategories();

  // 格式化返回数据
  const result = categories.map((category) => ({
    id: category.id,
    name: category.name,
    displayOrder: category.display_order,
    createdAt: category.created_at,
  }));

  // 缓存结果（分类数据变化不频繁，缓存时间可以长一些）
  await setCache(cacheKey, result, CACHE_TTL.GENERAL);

  return NextResponse.json(result);
}

