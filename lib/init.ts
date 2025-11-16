// 初始化脚本，在服务器启动时调用
import { startScheduler } from '@/services/scheduler';
import { initDatabase } from '@/lib/db';
import { processAndSaveHotspots } from '@/services/briefing';

export function initializeApp() {
  // 确保数据库已初始化
  initDatabase();

  // 启动定时任务（仅在服务器端）
  if (typeof window === 'undefined') {
    startScheduler();

    // 立即执行一次热点获取和LLM处理（不阻塞应用启动）
    (async () => {
      try {
        console.log('Starting initial hotspot fetch and processing...');
        await processAndSaveHotspots();
        console.log('Initial hotspot fetch and processing completed successfully');
      } catch (error) {
        console.error('Error in initial hotspot fetch and processing:', error);
        // 不抛出错误，避免影响应用启动
      }
    })();
  }
}






