import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { getFavoriteById, deleteFavorite } from '@/services/favorite';

// 获取收藏详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiKeyAuth(request, async (req, userId) => {
    try {
      const favoriteId = parseInt(params.id);

      if (isNaN(favoriteId)) {
        return NextResponse.json({ error: 'Invalid favorite ID' }, { status: 400 });
      }

      const favorite = getFavoriteById(favoriteId, userId);

      if (!favorite) {
        return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
      }

      return NextResponse.json(favorite);
    } catch (error: any) {
      console.error('Error getting favorite:', error);
      return NextResponse.json(
        { error: 'Failed to get favorite', message: error.message },
        { status: 500 }
      );
    }
  });
}

// 删除收藏
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiKeyAuth(request, async (req, userId) => {
    try {
      const favoriteId = parseInt(params.id);

      if (isNaN(favoriteId)) {
        return NextResponse.json({ error: 'Invalid favorite ID' }, { status: 400 });
      }

      const deleted = deleteFavorite(favoriteId, userId);

      if (!deleted) {
        return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting favorite:', error);
      return NextResponse.json(
        { error: 'Failed to delete favorite', message: error.message },
        { status: 500 }
      );
    }
  });
}

