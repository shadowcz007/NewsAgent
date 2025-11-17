import { NextRequest, NextResponse } from 'next/server';
import { withSessionAuth } from '@/lib/middleware';
import { getUserById } from '@/lib/auth';
import db from '@/lib/db';

// 获取用户信息
export async function GET(request: NextRequest) {
  return withSessionAuth(request, async (req, userId) => {
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  });
}

// 更新用户信息
export async function PATCH(request: NextRequest) {
  return withSessionAuth(request, async (req, userId) => {
    const body = await request.json();
    const { name } = body;

    const stmt = db.prepare('UPDATE users SET name = ? WHERE id = ?');
    stmt.run(name || null, userId);

    const user = await getUserById(userId);
    return NextResponse.json(user);
  });
}







