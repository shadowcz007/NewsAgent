"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Header } from "@/components/header";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface FavoriteItem {
  id: number;
  content: string;
  sources: string[];
  title?: string;
  created_at: string;
}

function BriefingHistoryContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFavorites, setSelectedFavorites] = useState<number[]>([]);
  const [syncTargets, setSyncTargets] = useState({ notion: false, feishu: false });
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedFavorite, setSelectedFavorite] = useState<FavoriteItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchFavorites();
    }
  }, [session]);

  const fetchFavorites = async () => {
    try {
      const response = await fetch("/api/favorites");
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
      }
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteToggle = (favoriteId: number) => {
    setSelectedFavorites((prev) =>
      prev.includes(favoriteId)
        ? prev.filter((id) => id !== favoriteId)
        : [...prev, favoriteId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFavorites.length === favorites.length) {
      setSelectedFavorites([]);
    } else {
      setSelectedFavorites(favorites.map((f) => f.id));
    }
  };

  const handleSync = async () => {
    if (selectedFavorites.length === 0) {
      alert("请至少选择一个要同步的收藏");
      return;
    }

    if (!syncTargets.notion && !syncTargets.feishu) {
      alert("请至少选择一个同步目标");
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          favorite_ids: selectedFavorites,
          targets: syncTargets,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const successCount = result.results.filter((r: any) =>
          syncTargets.notion && syncTargets.feishu
            ? r.notion?.success && r.feishu?.success
            : syncTargets.notion
            ? r.notion?.success
            : r.feishu?.success
        ).length;

        alert(`同步完成：${successCount}/${selectedFavorites.length} 个成功`);
        setSelectedFavorites([]);
      } else {
        alert("同步失败，请重试");
      }
    } catch (error) {
      console.error("Error syncing:", error);
      alert("同步失败，请重试");
    } finally {
      setSyncing(false);
    }
  };

  const handleViewDetail = async (favoriteId: number) => {
    try {
      const response = await fetch(`/api/favorites/${favoriteId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedFavorite(data);
        setDetailDialogOpen(true);
      }
    } catch (error) {
      console.error("Error fetching favorite detail:", error);
    }
  };

  const handleDelete = async () => {
    if (selectedFavorites.length === 0) {
      alert("请至少选择一个要删除的收藏");
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedFavorites.length} 个收藏吗？`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch("/api/favorites", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          favorite_ids: selectedFavorites,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`删除完成：成功删除 ${result.deletedCount} 个收藏`);
        setSelectedFavorites([]);
        fetchFavorites(); // 刷新列表
      } else {
        alert("删除失败，请重试");
      }
    } catch (error) {
      console.error("Error deleting favorites:", error);
      alert("删除失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  // 获取显示标题（如果有 title 则使用，否则使用降级方案）
  const getDisplayTitle = (item: FavoriteItem): string => {
    if (item.title) {
      return item.title;
    }
    // 降级方案：取前15字
    const parts = item.content.split('\n\n');
    const firstPart = parts[0] || item.content;
    return firstPart.slice(0, 15).trim();
  };

  if (status === "loading" || loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">收藏的简报</h1>

        {favorites.length > 0 && (
          <div className="mb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      favorites.length > 0 &&
                      selectedFavorites.length === favorites.length
                    }
                    onChange={handleSelectAll}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">全选</span>
                </label>
                <span className="text-sm text-muted-foreground">
                  已选择 {selectedFavorites.length} 个
                </span>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncTargets.notion}
                    onChange={(e) =>
                      setSyncTargets({ ...syncTargets, notion: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">同步到 Notion</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncTargets.feishu}
                    onChange={(e) =>
                      setSyncTargets({ ...syncTargets, feishu: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">同步到飞书</span>
                </label>
                <Button onClick={handleSync} disabled={syncing || selectedFavorites.length === 0}>
                  {syncing ? "同步中..." : "同步"}
                </Button>
                <Button 
                  onClick={handleDelete} 
                  disabled={deleting || selectedFavorites.length === 0}
                  variant="destructive"
                >
                  {deleting ? "删除中..." : "删除"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {favorites.length > 0 ? (
            favorites.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedFavorites.includes(item.id)}
                        onChange={() => handleFavoriteToggle(item.id)}
                        className="w-4 h-4"
                      />
                      <h3 className="text-lg font-semibold">{getDisplayTitle(item)}</h3>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 whitespace-pre-wrap line-clamp-3">{item.content}</p>
                  {item.sources && item.sources.length > 0 && (
                    <div className="text-sm text-muted-foreground mb-4">
                      <p className="font-semibold mb-2">Sources:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {item.sources.slice(0, 3).map((source: string, index: number) => (
                          <li key={index}>
                            <a
                              href={source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {source}
                            </a>
                          </li>
                        ))}
                        {item.sources.length > 3 && (
                          <li className="text-muted-foreground">
                            还有 {item.sources.length - 3} 个来源...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetail(item.id)}
                  >
                    查看详情
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              暂无收藏的简报
            </p>
          )}
        </div>
      </main>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>收藏详情</DialogTitle>
            <DialogDescription>
              {selectedFavorite &&
                new Date(selectedFavorite.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selectedFavorite && (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedFavorite.content}
                </ReactMarkdown>
              </div>
              {selectedFavorite.sources && selectedFavorite.sources.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold mb-2">Sources:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedFavorite.sources.map((source: string, index: number) => (
                      <li key={index}>
                        <a
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {source}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BriefingHistoryPage() {
  return <BriefingHistoryContent />;
}
