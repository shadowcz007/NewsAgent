import db from '@/lib/db';
import { generateContentHash } from '@/lib/hash';

export interface Favorite {
  id: number;
  user_id: number;
  content_hash: string;
  content: string;
  sources: string[];
  title?: string;
  created_at: string;
}

/**
 * 保存收藏
 */
export function saveFavorite(
  userId: number,
  content: string,
  sources: string[],
  title?: string
): Favorite {
  const contentHash = generateContentHash(content);
  const sourcesJson = JSON.stringify(sources);

  // 检查是否已存在（基于 content_hash）
  const existing = db
    .prepare('SELECT * FROM favorites WHERE content_hash = ? AND user_id = ?')
    .get(contentHash, userId) as
    | {
        id: number;
        user_id: number;
        content_hash: string;
        content: string;
        sources: string;
        title: string | null;
        created_at: string;
      }
    | undefined;

  if (existing) {
    // 如果已存在但没有标题，且提供了新标题，则更新标题
    if (!existing.title && title) {
      const updateStmt = db.prepare('UPDATE favorites SET title = ? WHERE id = ?');
      updateStmt.run(title, existing.id);
      return {
        ...existing,
        title,
        sources: existing.sources ? JSON.parse(existing.sources) : [],
      };
    }
    return {
      ...existing,
      sources: existing.sources ? JSON.parse(existing.sources) : [],
    };
  }

  const stmt = db.prepare(`
    INSERT INTO favorites (user_id, content_hash, content, sources, title)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(userId, contentHash, content, sourcesJson, title || null);

  return {
    id: result.lastInsertRowid as number,
    user_id: userId,
    content_hash: contentHash,
    content,
    sources,
    title: title || undefined,
    created_at: new Date().toISOString(),
  };
}

/**
 * 获取用户的收藏列表
 */
export function getUserFavorites(userId: number, limit: number = 50, offset: number = 0): Favorite[] {
  const stmt = db.prepare(`
    SELECT id, user_id, content_hash, content, sources, title, created_at
    FROM favorites
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(userId, limit, offset) as Array<{
    id: number;
    user_id: number;
    content_hash: string;
    content: string;
    sources: string;
    title: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    ...row,
    sources: row.sources ? JSON.parse(row.sources) : [],
    title: row.title || undefined,
  }));
}

/**
 * 根据 ID 获取收藏详情
 */
export function getFavoriteById(favoriteId: number, userId: number): Favorite | null {
  const stmt = db.prepare(`
    SELECT id, user_id, content_hash, content, sources, title, created_at
    FROM favorites
    WHERE id = ? AND user_id = ?
  `);

  const row = stmt.get(favoriteId, userId) as
    | {
        id: number;
        user_id: number;
        content_hash: string;
        content: string;
        sources: string;
        title: string | null;
        created_at: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    ...row,
    sources: row.sources ? JSON.parse(row.sources) : [],
    title: row.title || undefined,
  };
}

/**
 * 删除收藏
 */
export function deleteFavorite(favoriteId: number, userId: number): boolean {
  const stmt = db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?');
  const result = stmt.run(favoriteId, userId);
  return result.changes > 0;
}

/**
 * 检查内容是否已收藏
 */
export function isFavorite(userId: number, content: string): boolean {
  const contentHash = generateContentHash(content);
  const stmt = db.prepare(
    'SELECT COUNT(*) as count FROM favorites WHERE content_hash = ? AND user_id = ?'
  );
  const result = stmt.get(contentHash, userId) as { count: number };
  return result.count > 0;
}

/**
 * 批量删除收藏
 */
export function deleteFavorites(favoriteIds: number[], userId: number): number {
  if (favoriteIds.length === 0) {
    return 0;
  }

  // 使用 IN 子句批量删除，但需要验证所有 ID 都属于当前用户
  const placeholders = favoriteIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    DELETE FROM favorites 
    WHERE id IN (${placeholders}) AND user_id = ?
  `);
  
  const result = stmt.run(...favoriteIds, userId);
  return result.changes;
}

