import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { getUserSyncConfig, saveUserSyncConfig } from '@/services/sync';

// 获取同步配置
export async function GET(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    try {
      const config = getUserSyncConfig(userId);
      return NextResponse.json(config || {});
    } catch (error: any) {
      console.error('Error getting sync config:', error);
      return NextResponse.json(
        { error: 'Failed to get sync config', message: error.message },
        { status: 500 }
      );
    }
  });
}

// 保存同步配置
export async function POST(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    try {
      const body = await request.json();
      const { notion_token, notion_data_source_id, feishu_token, feishu_folder_token } = body;

      saveUserSyncConfig(userId, {
        notion_token,
        notion_data_source_id,
        feishu_token,
        feishu_folder_token,
      });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error('Error saving sync config:', error);
      return NextResponse.json(
        { error: 'Failed to save sync config', message: error.message },
        { status: 500 }
      );
    }
  });
}

