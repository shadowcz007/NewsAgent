import db from '@/lib/db';
import { CACHE_TTL } from '@/lib/constants';

// 内存缓存
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

// 清理过期缓存
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
}

// 获取缓存（先查内存，再查数据库）
export async function getCache(key: string): Promise<any | null> {
  // 清理过期内存缓存
  cleanExpiredCache();

  // 先查内存缓存
  const memoryItem = memoryCache.get(key);
  if (memoryItem && memoryItem.expiresAt > Date.now()) {
    return memoryItem.value;
  }

  // 再查数据库缓存
  const stmt = db.prepare('SELECT value, expires_at FROM cache WHERE key = ?');
  const result = stmt.get(key) as { value: string; expires_at: string } | undefined;

  if (result) {
    const expiresAt = new Date(result.expires_at).getTime();
    if (expiresAt > Date.now()) {
      // 解析 JSON
      try {
        const value = JSON.parse(result.value);
        // 同时更新内存缓存
        memoryCache.set(key, { value, expiresAt });
        return value;
      } catch (error) {
        console.error('Error parsing cache value:', error);
        return null;
      }
    } else {
      // 过期了，删除
      deleteCache(key);
    }
  }

  return null;
}

// 设置缓存（同时写入内存和数据库）
export async function setCache(key: string, value: any, ttlSeconds: number = CACHE_TTL.GENERAL): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const expiresAtDate = new Date(expiresAt).toISOString();

  // 写入内存缓存
  memoryCache.set(key, { value, expiresAt });

  // 写入数据库缓存
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO cache (key, value, expires_at) 
    VALUES (?, ?, ?)
  `);
  stmt.run(key, JSON.stringify(value), expiresAtDate);
}

// 删除缓存
export async function deleteCache(key: string): Promise<void> {
  memoryCache.delete(key);
  const stmt = db.prepare('DELETE FROM cache WHERE key = ?');
  stmt.run(key);
}

// 清理所有过期缓存
export async function cleanCache(): Promise<void> {
  // 清理内存缓存
  cleanExpiredCache();

  // 清理数据库过期缓存
  const now = new Date().toISOString();
  const stmt = db.prepare('DELETE FROM cache WHERE expires_at < ?');
  stmt.run(now);
}

// 清空所有缓存
export async function clearAllCache(): Promise<void> {
  memoryCache.clear();
  const stmt = db.prepare('DELETE FROM cache');
  stmt.run();
}

