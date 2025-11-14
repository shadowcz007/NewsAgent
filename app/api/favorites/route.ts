import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { saveFavorite, getUserFavorites, isFavorite, deleteFavorites } from '@/services/favorite';
import { generateTitle } from '@/services/llm';

// 获取收藏列表
export async function GET(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    try {
      const favorites = getUserFavorites(userId, limit, offset);
      return NextResponse.json(favorites);
    } catch (error: any) {
      console.error('Error getting favorites:', error);
      return NextResponse.json(
        { error: 'Failed to get favorites', message: error.message },
        { status: 500 }
      );
    }
  });
}

// 添加收藏或检查是否已收藏
export async function POST(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    try {
      const body = await request.json();
      const { content, sources, checkOnly } = body;

      if (!content) {
        return NextResponse.json({ error: 'Content is required' }, { status: 400 });
      }

      // 如果只是检查，不保存
      if (checkOnly) {
        const favorited = isFavorite(userId, content);
        return NextResponse.json({ favorited });
      }

      // 检查是否已存在
      const alreadyFavorited = isFavorite(userId, content);
      
      // 生成标题
      let title: string | undefined;
      try {
        title = await generateTitle(content);
      } catch (error) {
        console.error('Error generating title:', error);
        // 继续执行，使用降级方案（在 generateTitle 内部已处理）
        const parts = content.split('\n\n');
        const firstPart = parts[0] || content;
        title = firstPart.slice(0, 15).trim();
      }
      
      const favorite = saveFavorite(userId, content, sources || [], title);

      return NextResponse.json({
        ...favorite,
        isNew: !alreadyFavorited,
      });
    } catch (error: any) {
      console.error('Error saving favorite:', error);
      return NextResponse.json(
        { error: 'Failed to save favorite', message: error.message },
        { status: 500 }
      );
    }
  });
}

// 批量删除收藏
export async function DELETE(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    try {
      const body = await request.json();
      const { favorite_ids } = body;

      if (!favorite_ids || !Array.isArray(favorite_ids) || favorite_ids.length === 0) {
        return NextResponse.json({ error: 'favorite_ids array is required' }, { status: 400 });
      }

      // 验证所有 ID 都是数字
      const ids = favorite_ids.map((id: any) => {
        const numId = parseInt(String(id));
        if (isNaN(numId)) {
          throw new Error(`Invalid favorite ID: ${id}`);
        }
        return numId;
      });

      const deletedCount = deleteFavorites(ids, userId);

      return NextResponse.json({
        success: true,
        deletedCount,
      });
    } catch (error: any) {
      console.error('Error deleting favorites:', error);
      return NextResponse.json(
        { error: 'Failed to delete favorites', message: error.message },
        { status: 500 }
      );
    }
  });
}

