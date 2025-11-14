"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Grid3x3, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BriefingCard } from "./briefing-card";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface HotspotItem {
  id: number;
  title: string;
  summary?: string;
  source: string;
  category?: string;
  url?: string;
  createdAt: string;
}

interface GroupedHotspots {
  date: string;
  items: HotspotItem[];
}

const ITEMS_PER_PAGE = 36;

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
};

// 解析日期字符串（支持 SQLite 格式：YYYY-MM-DD HH:MM:SS）
const parseDate = (dateString: string): Date => {
  // SQLite 日期格式通常是 'YYYY-MM-DD HH:MM:SS'
  // 需要转换为 ISO 格式或直接解析
  if (!dateString) {
    return new Date();
  }
  
  const trimmed = dateString.trim();
  
  // 如果已经是 ISO 格式，直接使用
  if (trimmed.includes('T')) {
    return new Date(trimmed);
  }
  
  // SQLite 格式：'YYYY-MM-DD HH:MM:SS' 或 'YYYY-MM-DD'
  // 手动解析以避免时区问题
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 月份从 0 开始
    const day = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const second = match[6] ? parseInt(match[6], 10) : 0;
    
    // 使用本地时区创建日期
    return new Date(year, month, day, hour, minute, second);
  }
  
  // 如果格式不匹配，尝试直接解析
  return new Date(trimmed);
};

// 格式化日期为 YYYY-MM-DD
const formatDate = (dateString: string): string => {
  try {
    const date = parseDate(dateString);
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateString);
      return new Date().toISOString().split('T')[0];
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return new Date().toISOString().split('T')[0];
  }
};

// 格式化日期显示为中文格式
const formatDateDisplay = (dateString: string): string => {
  try {
    const date = parseDate(dateString);
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateString);
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
};

// 按日期分组
const groupByDate = (items: HotspotItem[]): GroupedHotspots[] => {
  const grouped: Record<string, HotspotItem[]> = {};
  
  items.forEach((item) => {
    // 调试：打印原始日期字符串
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('Raw createdAt:', item.createdAt, 'Item ID:', item.id);
    // }
    const date = formatDate(item.createdAt);
    // 调试：打印格式化后的日期
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('Formatted date:', date);
    // }
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(item);
  });

  // 转换为数组并按日期倒序排列（最新日期在前）
  const result = Object.keys(grouped)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({
      date,
      items: grouped[date],
    }));
  
  // 调试：打印分组结果
  // if (process.env.NODE_ENV === 'development') {
  //   console.log('Grouped dates:', result.map(g => ({ date: g.date, count: g.items.length })));
  // }
  
  return result;
};

interface BriefingSectionProps {
  searchQuery?: string;
  category?: string;
}

export function BriefingSection({ searchQuery = "", category = "All" }: BriefingSectionProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [language, setLanguage] = useState("English");
  const [allHotspots, setAllHotspots] = useState<HotspotItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const currentOffset = useRef(0);
  const loadHotspotsRef = useRef<((offset: number, append: boolean) => Promise<void>) | null>(null);

  // 加载数据
  const loadHotspots = useCallback(async (offset: number, append: boolean = false) => {
    if (!session) return;

    const loadingState = append ? setIsLoadingMore : setIsLoading;
    loadingState(true);
    setError(null);

    try {
      const apiUrl = `/api/hotspots?${new URLSearchParams({
        search: searchQuery,
        category: category === "All" ? "" : category,
        limit: String(ITEMS_PER_PAGE),
        offset: String(offset),
      })}`;

      const data = await fetcher(apiUrl);
      
      if (append) {
        setAllHotspots((prev) => [...prev, ...data]);
      } else {
        setAllHotspots(data);
        currentOffset.current = 0;
      }

      // 如果返回的数据少于每页数量，说明没有更多数据了
      if (data.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      if (append) {
        currentOffset.current = offset + data.length;
      } else {
        currentOffset.current = data.length;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load hotspots'));
      console.error('Error loading hotspots:', err);
    } finally {
      loadingState(false);
    }
  }, [session, searchQuery, category]);

  // 更新 ref
  useEffect(() => {
    loadHotspotsRef.current = loadHotspots;
  }, [loadHotspots]);

  // 初始加载和重置
  useEffect(() => {
    if (session) {
      setAllHotspots([]);
      setHasMore(true);
      currentOffset.current = 0;
      loadHotspots(0, false);
    }
  }, [session, searchQuery, category, loadHotspots]);

  // 查找滚动容器
  useEffect(() => {
    const findScrollContainer = () => {
      if (observerTarget.current) {
        // 向上查找最近的滚动容器
        let parent = observerTarget.current.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
              style.overflow === 'auto' || style.overflow === 'scroll') {
            scrollContainerRef.current = parent;
            return;
          }
          parent = parent.parentElement;
        }
        // 如果没找到，使用 null（viewport）
        scrollContainerRef.current = null;
      }
    };

    // 立即查找
    findScrollContainer();
    
    // 当内容变化时重新查找
    const timeoutId = setTimeout(findScrollContainer, 100);
    return () => clearTimeout(timeoutId);
  }, [allHotspots.length]);

  // Intersection Observer 用于滚动加载
  useEffect(() => {
    if (!session || !hasMore || isLoadingMore || !observerTarget.current) return;

    // 确保滚动容器已找到（如果还没找到，使用 viewport）
    const root = scrollContainerRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && loadHotspotsRef.current) {
          loadHotspotsRef.current(currentOffset.current, true);
        }
      },
      {
        root: root, // 使用找到的滚动容器作为 root，如果为 null 则使用 viewport
        rootMargin: '200px', // 提前 200px 开始加载
        threshold: 0.1,
      }
    );

    const currentTarget = observerTarget.current;
    observer.observe(currentTarget);

    return () => {
      observer.unobserve(currentTarget);
    };
  }, [session, hasMore, isLoadingMore, allHotspots.length]);

  // 如果未登录，显示欢迎提示
  if (!session) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Real-Time Briefings</h2>
        </div>
        <div className="text-center py-16">
          <div className="max-w-md mx-auto space-y-4">
            <h3 className="text-2xl font-semibold text-foreground">欢迎使用 Hot Topics AI</h3>
            <p className="text-muted-foreground">
              请登录以查看实时新闻摘要和热点话题
            </p>
            <Button onClick={() => router.push("/auth/login")} className="mt-4">
              登录
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 按日期分组
  const groupedHotspots = groupByDate(allHotspots);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Real-Time Briefings</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Chinese">中文</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">Error loading hotspots: {error.message}</div>
      ) : groupedHotspots.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No briefings available
        </div>
      ) : (
        <div className="space-y-6">
          {groupedHotspots.map((group) => (
            <div key={group.date} className="space-y-4">
              {/* 粘性日期标题 */}
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 border-b">
                <h3 className="text-lg font-semibold text-foreground">
                  {formatDateDisplay(group.date)}
                </h3>
              </div>
              
              {/* 卡片列表 */}
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    : "space-y-4"
                }
              >
                {group.items.map((item) => (
                  <BriefingCard
                    key={item.id}
                    title={item.title}
                    summary={item.summary}
                    source={item.source}
                    category={item.category || "OTHER"}
                    url={item.url}
                  />
                ))}
              </div>
            </div>
          ))}
          
          {/* 加载更多触发器 */}
          <div ref={observerTarget} className="h-20 flex items-center justify-center">
            {hasMore && !isLoadingMore && (
              <div className="text-sm text-muted-foreground">滚动加载更多...</div>
            )}
          </div>
          
          {/* 加载更多指示器 */}
          {isLoadingMore && (
            <div className="text-center py-4 text-muted-foreground">
              Loading more...
            </div>
          )}
          
          {/* 没有更多数据提示 */}
          {!hasMore && allHotspots.length > 0 && (
            <div className="text-center py-4 text-muted-foreground">
              No more briefings to load
            </div>
          )}
        </div>
      )}
    </div>
  );
}
