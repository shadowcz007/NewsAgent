import crypto from 'crypto';

/**
 * 基于三段内容生成 SHA-256 hash
 * @param content 合并后的三段内容
 * @returns hash 字符串
 */
export function generateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

