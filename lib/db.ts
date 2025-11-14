import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'db.sqlite');

// 确保 data 目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化表结构
export function initDatabase() {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // API Key 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 订阅表
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 热点缓存表
  db.exec(`
    CREATE TABLE IF NOT EXISTS hotspots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      content TEXT NOT NULL,
      processed_content TEXT,
      category TEXT NOT NULL DEFAULT '其他',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 检查并添加 category 字段（迁移逻辑）
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(hotspots)`).all() as Array<{ name: string; type: string }>;
    const hasCategoryField = tableInfo.some(col => col.name === 'category');
    
    if (!hasCategoryField) {
      // 添加 category 字段
      db.exec(`ALTER TABLE hotspots ADD COLUMN category TEXT NOT NULL DEFAULT '其他'`);
      
      // 尝试从 processed_content 中提取 category 并更新
      const allHotspots = db.prepare(`SELECT id, processed_content FROM hotspots WHERE processed_content IS NOT NULL`).all() as Array<{ id: number; processed_content: string }>;
      
      for (const hotspot of allHotspots) {
        try {
          const processed = JSON.parse(hotspot.processed_content);
          if (processed && typeof processed === 'object' && processed.category) {
            const category = processed.category;
            // 验证 category 是否有效
            if (['技术工具', '前沿研究', '行业动态', '其他'].includes(category)) {
              db.prepare(`UPDATE hotspots SET category = ? WHERE id = ?`).run(category, hotspot.id);
              continue;
            }
          }
        } catch (e) {
          // 解析失败，使用默认值
        }
        // 如果提取失败或不存在，使用默认值 '其他'（已经在 DEFAULT 中设置）
      }
    }
  } catch (error) {
    console.error('Error migrating category field:', error);
  }

  // 简报历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS briefings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      sources TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 缓存表
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at DATETIME NOT NULL
    )
  `);

  // 分类表
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 初始化默认分类数据
  try {
    const existingCategories = db.prepare(`SELECT COUNT(*) as count FROM categories`).get() as { count: number };
    if (existingCategories.count === 0) {
      const insertCategory = db.prepare(`
        INSERT INTO categories (name, display_order) 
        VALUES (?, ?)
      `);
      insertCategory.run('技术工具', 1);
      insertCategory.run('前沿研究', 2);
      insertCategory.run('行业动态', 3);
      insertCategory.run('其他', 4);
    }
  } catch (error) {
    console.error('Error initializing categories:', error);
  }

  // 收藏表
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content_hash TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      sources TEXT,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 检查并添加 title 字段（迁移逻辑）
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(favorites)`).all() as Array<{ name: string; type: string }>;
    const hasTitleField = tableInfo.some(col => col.name === 'title');
    
    if (!hasTitleField) {
      // 添加 title 字段
      db.exec(`ALTER TABLE favorites ADD COLUMN title TEXT`);
    }
  } catch (error) {
    console.error('Error migrating title field:', error);
  }

  // 用户同步配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sync_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      notion_token TEXT,
      notion_data_source_id TEXT,
      feishu_token TEXT,
      feishu_folder_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Notion 同步记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS notion_sync_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      favorite_id INTEGER UNIQUE NOT NULL,
      notion_page_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (favorite_id) REFERENCES favorites(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_hotspots_source_type ON hotspots(source_type);
    CREATE INDEX IF NOT EXISTS idx_hotspots_created_at ON hotspots(created_at);
    CREATE INDEX IF NOT EXISTS idx_hotspots_category ON hotspots(category);
    CREATE INDEX IF NOT EXISTS idx_briefings_user_id ON briefings(user_id);
    CREATE INDEX IF NOT EXISTS idx_briefings_created_at ON briefings(created_at);
    CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);
    CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_content_hash ON favorites(content_hash);
  `);
}

// 初始化数据库（如果表不存在）
initDatabase();

export default db;

