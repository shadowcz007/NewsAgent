import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { generateBriefingWithCache } from '@/services/briefing';

// 生成简报
export async function POST(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    const body = await request.json();
    const { customRequirement } = body;

    try {
      const result = await generateBriefingWithCache(userId, customRequirement);
      return NextResponse.json(result);
    } catch (error: any) {
      console.error('Error generating briefing:', error);
      return NextResponse.json(
        { error: 'Failed to generate briefing', message: error.message },
        { status: 500 }
      );
    }
  });
}

// 获取最新简报（不生成新的）
export async function GET(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    try {
      const result = await generateBriefingWithCache(userId);
      return NextResponse.json(result);
    } catch (error: any) {
      console.error('Error getting briefing:', error);
      return NextResponse.json(
        { error: 'Failed to get briefing', message: error.message },
        { status: 500 }
      );
    }
  });
}

