import { NextRequest, NextResponse } from 'next/server';
import db from './db';
import { auth } from './auth-config';

// 生成 API Key（格式：news_ + 32位十六进制）
export function generateApiKey(): string {
  const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(16)));
  const hexString = randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
  return `news_${hexString}`;
}

// 验证 API Key
export async function verifyApiKey(apiKey: string): Promise<{ userId: number } | null> {
  if (!apiKey || !apiKey.startsWith('news_')) {
    return null;
  }

  const stmt = db.prepare('SELECT user_id FROM api_keys WHERE key = ? AND is_active = 1');
  const result = stmt.get(apiKey) as { user_id: number } | undefined;

  if (!result) {
    return null;
  }

  return { userId: result.user_id };
}

// API Key 认证中间件
export async function withApiKeyAuth(
  request: NextRequest,
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  // 首先尝试从 Header 获取 API Key
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');

  if (apiKey) {
    const result = await verifyApiKey(apiKey);
    if (result) {
      return handler(request, result.userId);
    }
    return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
  }

  // 如果没有 API Key，尝试使用 Session 认证
  try {
    const session = await auth(); // 在 API Route 上下文, auth() 不需要参数
    
    if (session?.user?.id) {
      return handler(request, parseInt(session.user.id));
    } else {
      console.log('No session found or session has no user.id');
    }
  } catch (error) {
    // 如果 auth 失败，继续返回未授权错误
    console.error('Auth error:', error);
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Session 认证中间件
export async function withSessionAuth(
  request: NextRequest,
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  // 在 next-auth v5 中，auth() 在 API Route 上下文不需要参数
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(request, parseInt(session.user.id));
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

