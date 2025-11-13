import cron from 'node-cron';
import { processAndSaveHotspots } from './briefing';
import { cleanCache } from './cache';

let isRunning = false;

// 定时任务：每5分钟拉取热点
export function startScheduler() {
  console.log('Starting scheduler...');

  // 每5分钟执行一次热点拉取和处理
  cron.schedule('*/5 * * * *', async () => {
    if (isRunning) {
      console.log('Previous task still running, skipping...');
      return;
    }

    try {
      isRunning = true;
      console.log('Running scheduled task: Fetching and processing hotspots...');
      await processAndSaveHotspots();
      console.log('Scheduled task completed successfully');
    } catch (error) {
      console.error('Error in scheduled task:', error);
    } finally {
      isRunning = false;
    }
  });

  // 每小时清理一次过期缓存
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('Cleaning expired cache...');
      await cleanCache();
      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Error cleaning cache:', error);
    }
  });

  console.log('Scheduler started successfully');
}

// 停止调度器（如果需要）
export function stopScheduler() {
  // node-cron 没有直接的停止方法，这里只是标记
  console.log('Scheduler stop requested (note: node-cron tasks cannot be easily stopped)');
}

