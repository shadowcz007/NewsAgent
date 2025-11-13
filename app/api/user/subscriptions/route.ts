import { NextRequest, NextResponse } from 'next/server';
import { withSessionAuth } from '@/lib/middleware';
import db from '@/lib/db';

// 获取用户订阅
export async function GET(request: NextRequest) {
  return withSessionAuth(request, async (req, userId) => {
    const stmt = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?');
    const subscriptions = stmt.all(userId);
    return NextResponse.json(subscriptions);
  });
}

// 创建订阅
export async function POST(request: NextRequest) {
  return withSessionAuth(request, async (req, userId) => {
    const body = await request.json();
    const { source_type, source_config } = body;

    if (!source_type) {
      return NextResponse.json({ error: 'source_type is required' }, { status: 400 });
    }

    const stmt = db.prepare(`
      INSERT INTO subscriptions (user_id, source_type, source_config) 
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(userId, source_type, JSON.stringify(source_config || {}));

    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
  });
}

// 删除订阅
export async function DELETE(request: NextRequest) {
  return withSessionAuth(request, async (req, userId) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const stmt = db.prepare('DELETE FROM subscriptions WHERE id = ? AND user_id = ?');
    stmt.run(id, userId);

    return NextResponse.json({ message: 'Subscription deleted' });
  });
}

