// 初始化脚本，在服务器启动时调用
import { startScheduler } from '@/services/scheduler';
import { initDatabase } from '@/lib/db';

export function initializeApp() {
  // 确保数据库已初始化
  initDatabase();

  // 启动定时任务（仅在服务器端）
  if (typeof window === 'undefined') {
    startScheduler();
  }
}


