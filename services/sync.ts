import db from '@/lib/db';
import { getFavoriteById } from '@/services/favorite';
import { syncToNotion, NotionConfig } from './sync/notion';
import { syncToFeishu, FeishuConfig } from './sync/feishu';

export interface UserSyncConfig {
  notion_token?: string;
  notion_data_source_id?: string;
  feishu_token?: string;
  feishu_folder_token?: string;
}

/**
 * 获取用户的同步配置
 */
export function getUserSyncConfig(userId: number): UserSyncConfig | null {
  const stmt = db.prepare('SELECT * FROM user_sync_configs WHERE user_id = ?');
  const row = stmt.get(userId) as
    | {
        notion_token: string | null;
        notion_data_source_id: string | null;
        feishu_token: string | null;
        feishu_folder_token: string | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    notion_token: row.notion_token || undefined,
    notion_data_source_id: row.notion_data_source_id || undefined,
    feishu_token: row.feishu_token || undefined,
    feishu_folder_token: row.feishu_folder_token || undefined,
  };
}

/**
 * 保存用户的同步配置
 */
export function saveUserSyncConfig(userId: number, config: UserSyncConfig): void {
  const existing = db.prepare('SELECT id FROM user_sync_configs WHERE user_id = ?').get(userId);

  if (existing) {
    // 更新
    const stmt = db.prepare(`
      UPDATE user_sync_configs
      SET notion_token = ?,
          notion_data_source_id = ?,
          feishu_token = ?,
          feishu_folder_token = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);
    stmt.run(
      config.notion_token || null,
      config.notion_data_source_id || null,
      config.feishu_token || null,
      config.feishu_folder_token || null,
      userId
    );
  } else {
    // 插入
    const stmt = db.prepare(`
      INSERT INTO user_sync_configs (user_id, notion_token, notion_data_source_id, feishu_token, feishu_folder_token)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      userId,
      config.notion_token || null,
      config.notion_data_source_id || null,
      config.feishu_token || null,
      config.feishu_folder_token || null
    );
  }
}

/**
 * 获取标题（如果不存在则使用降级方案）
 */
function getTitle(favorite: { title?: string; content: string }): string {
  if (favorite.title) {
    return favorite.title;
  }
  // 降级方案：取前15字
  const parts = favorite.content.split('\n\n');
  const firstPart = parts[0] || favorite.content;
  return firstPart.slice(0, 15).trim();
}

/**
 * 批量同步收藏到 Notion/飞书
 */
export async function syncFavorites(
  userId: number,
  favoriteIds: number[],
  targets: { notion?: boolean; feishu?: boolean }
): Promise<{
  success: boolean;
  results: Array<{
    favoriteId: number;
    notion?: { success: boolean; pageId?: string; skipped?: boolean; error?: string };
    feishu?: { success: boolean; documentId?: string; error?: string };
  }>;
}> {
  const config = getUserSyncConfig(userId);

  if (!config) {
    return {
      success: false,
      results: [],
    };
  }

  const results = [];

  for (const favoriteId of favoriteIds) {
    const favorite = getFavoriteById(favoriteId, userId);

    if (!favorite) {
      results.push({
        favoriteId,
        notion: { success: false, error: 'Favorite not found' },
        feishu: { success: false, error: 'Favorite not found' },
      });
      continue;
    }

    const title = getTitle(favorite);
    const result: {
      favoriteId: number;
      notion?: { success: boolean; pageId?: string; skipped?: boolean; error?: string };
      feishu?: { success: boolean; documentId?: string; error?: string };
    } = { favoriteId };

    // 同步到 Notion
    if (targets.notion && config.notion_token && config.notion_data_source_id) {
      try {
        const notionResult = await syncToNotion(
          {
            token: config.notion_token,
            dataSourceId: config.notion_data_source_id,
          },
          title,
          favorite.content,
          favorite.content_hash
        );

        if (notionResult.success && notionResult.pageId) {
          // 记录同步结果
          const existing = db
            .prepare('SELECT id FROM notion_sync_records WHERE favorite_id = ?')
            .get(favoriteId);

          if (!existing) {
            db.prepare(
              'INSERT INTO notion_sync_records (favorite_id, notion_page_id) VALUES (?, ?)'
            ).run(favoriteId, notionResult.pageId);
          }

          result.notion = {
            success: true,
            pageId: notionResult.pageId,
            skipped: notionResult.skipped,
          };
        } else {
          result.notion = { success: false, error: 'Failed to sync to Notion' };
        }
      } catch (error: any) {
        result.notion = { success: false, error: error.message || 'Unknown error' };
      }
    }

    // 同步到飞书
    if (targets.feishu && config.feishu_token && config.feishu_folder_token) {
      try {
        const feishuResult = await syncToFeishu(
          {
            token: config.feishu_token,
            folderToken: config.feishu_folder_token,
          },
          title,
          favorite.content
        );

        result.feishu = {
          success: feishuResult.success,
          documentId: feishuResult.documentId || undefined,
          error: feishuResult.success ? undefined : 'Failed to sync to Feishu',
        };
      } catch (error: any) {
        result.feishu = { success: false, error: error.message || 'Unknown error' };
      }
    }

    results.push(result);
  }

  return {
    success: results.every(
      (r) =>
        (!targets.notion || r.notion?.success) && (!targets.feishu || r.feishu?.success)
    ),
    results,
  };
}

