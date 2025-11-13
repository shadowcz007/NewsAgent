"use client";

import React, { useState } from "react";
import { Grid3x3, List, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BriefingCard } from "./briefing-card";
import useSWR from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include', // 包含 cookies 以支持 Session 认证
  });
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
};

interface BriefingSectionProps {
  searchQuery?: string;
  category?: string;
}

export function BriefingSection({ searchQuery = "", category = "All" }: BriefingSectionProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [language, setLanguage] = useState("English");

  // 构建 API URL
  const apiUrl = `/api/hotspots?${new URLSearchParams({
    search: searchQuery,
    category: category === "All" ? "" : category,
  })}`;

  const { data: hotspots, error, isLoading } = useSWR(apiUrl, fetcher, {
    refreshInterval: 300000, // 每5分钟刷新
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Real-Time Briefings</h2>
        </div>
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Real-Time Briefings</h2>
        </div>
        <div className="text-center py-8 text-red-500">Error loading hotspots</div>
      </div>
    );
  }

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

      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-4"
        }
      >
        {hotspots && hotspots.length > 0 ? (
          hotspots.map((item: any, index: number) => (
            <BriefingCard
              key={index}
              title={item.title}
              summary={item.summary}
              source={item.source}
              category={item.category || "OTHER"}
              url={item.url}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No briefings available
          </div>
        )}
      </div>
    </div>
  );
}

