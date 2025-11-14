import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { syncFavorites } from '@/services/sync';

// 执行同步
export async function POST(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    try {
      const body = await request.json();
      const { favorite_ids, targets } = body;

      if (!favorite_ids || !Array.isArray(favorite_ids) || favorite_ids.length === 0) {
        return NextResponse.json(
          { error: 'favorite_ids is required and must be a non-empty array' },
          { status: 400 }
        );
      }

      if (!targets || (!targets.notion && !targets.feishu)) {
        return NextResponse.json(
          { error: 'At least one sync target (notion or feishu) must be specified' },
          { status: 400 }
        );
      }

      const result = await syncFavorites(userId, favorite_ids, targets);

      return NextResponse.json(result);
    } catch (error: any) {
      console.error('Error syncing favorites:', error);
      return NextResponse.json(
        { error: 'Failed to sync favorites', message: error.message },
        { status: 500 }
      );
    }
  });
}

