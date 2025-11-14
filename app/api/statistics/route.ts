import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { HotspotItem } from '@/services/hotspot';

// 获取热点统计信息（公开访问，不需要认证）
export async function GET(request: NextRequest) {
  try {
    // 获取总数量
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM hotspots').get() as { count: number };
    const total = totalResult.count;

    // 获取今日数量（使用 SQLite 的日期函数）
    const todayResult = db.prepare(`
      SELECT COUNT(*) as count 
      FROM hotspots 
      WHERE DATE(created_at) = DATE('now')
    `).get() as { count: number };
    const today = todayResult.count;

    // 获取所有热点的 content 字段，解析提取 source
    const allHotspots = db.prepare('SELECT content, source_type FROM hotspots').all() as Array<{
      content: string;
      source_type: string;
    }>;

    // 使用 Set 去重收集所有数据源
    const sourcesSet = new Set<string>();

    for (const row of allHotspots) {
      try {
        // 解析 content JSON
        const hotspotData = JSON.parse(row.content) as HotspotItem;
        if (hotspotData.source) {
          sourcesSet.add(hotspotData.source);
        } else if (row.source_type) {
          // 如果解析失败或没有 source 字段，使用 source_type 作为后备
          sourcesSet.add(row.source_type);
        }
      } catch (e) {
        // 解析失败，使用 source_type 作为后备
        if (row.source_type) {
          sourcesSet.add(row.source_type);
        }
      }
    }

    // 转换为数组并排序
    const sources = Array.from(sourcesSet).sort();

    return NextResponse.json({
      total,
      today,
      sources,
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

