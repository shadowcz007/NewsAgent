"use client";

import React from "react";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

interface HeaderProps {
  onSearch?: (query: string) => void;
  onCategoryChange?: (category: string) => void;
  currentCategory?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include', // 包含 cookies 以支持 Session 认证
  });
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  const data = await res.json();
  // 确保返回的是数组
  return Array.isArray(data) ? data : [];
};

export function Header({ onSearch, onCategoryChange, currentCategory = "All" }: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");

  // 从 API 获取分类列表
  const { data: categories, error: categoriesError } = useSWR("/api/categories", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  // 确保 categories 是数组
  const categoriesList = Array.isArray(categories) ? categories : [];

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleCategoryChange = (value: string) => {
    if (onCategoryChange) {
      onCategoryChange(value);
    }
    // 点击分类标签时导航到首页
    router.push("/");
  };

  const handleLogoClick = () => {
    // 点击logo或标题时导航到首页
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo and Title */}
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleLogoClick}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="font-bold" style={{
              fontSize:10
            }}>Hot AI</span>
          </div>
          <span className="text-xl font-semibold">Hot Topics AI</span>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search for topics or keywords..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={currentCategory} onValueChange={handleCategoryChange} className="hidden md:block">
          <TabsList>
            <TabsTrigger value="All">All</TabsTrigger>
            {!categoriesError && categoriesList.map((category: { id: number; name: string }) => (
              <TabsTrigger key={category.id} value={category.name}>
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* User Menu */}
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-foreground" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="cursor-pointer">
                <AvatarFallback>
                  {session?.user?.name?.[0] || session?.user?.email?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {session ? (
                <>
                  <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    Sign Out
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => router.push("/auth/login")}>
                  Sign In
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

