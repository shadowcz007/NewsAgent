import { NextRequest, NextResponse } from 'next/server';
import { withSessionAuth, generateApiKey } from '@/lib/middleware';
import db from '@/lib/db';

// 获取或生成 API Key
export async function GET(request: NextRequest) {
  return withSessionAuth(request, async (req, userId) => {
    // 查找现有的活跃 API Key
    const stmt = db.prepare('SELECT key, created_at FROM api_keys WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1');
    const existingKey = stmt.get(userId) as { key: string; created_at: string } | undefined;

    if (existingKey) {
      return NextResponse.json({
        apiKey: existingKey.key,
        createdAt: existingKey.created_at,
      });
    }

    // 如果没有，生成新的
    return NextResponse.json({ error: 'No API Key found' }, { status: 404 });
  });
}

// 生成新的 API Key（使旧的失效）
export async function POST(request: NextRequest) {
  return withSessionAuth(request, async (req, userId) => {
    // 使旧的 API Key 失效
    const deactivateStmt = db.prepare('UPDATE api_keys SET is_active = 0 WHERE user_id = ?');
    deactivateStmt.run(userId);

    // 生成新的 API Key
    const newApiKey = generateApiKey();
    const insertStmt = db.prepare('INSERT INTO api_keys (user_id, key) VALUES (?, ?)');
    insertStmt.run(userId, newApiKey);

    return NextResponse.json({
      apiKey: newApiKey,
      message: 'New API Key generated successfully',
    });
  });
}




