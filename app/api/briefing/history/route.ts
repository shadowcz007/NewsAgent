import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { getUserBriefingHistory } from '@/services/briefing';

// 获取简报历史
export async function GET(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    try {
      const history = getUserBriefingHistory(userId, limit);
      
      // 解析 sources JSON
      const formattedHistory = history.map(item => ({
        ...item,
        sources: item.sources ? JSON.parse(item.sources) : [],
      }));

      return NextResponse.json(formattedHistory);
    } catch (error: any) {
      console.error('Error getting briefing history:', error);
      return NextResponse.json(
        { error: 'Failed to get briefing history', message: error.message },
        { status: 500 }
      );
    }
  });
}





