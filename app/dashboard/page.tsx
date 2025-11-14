"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { ChevronDown, ChevronUp } from "lucide-react";

function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncConfig, setSyncConfig] = useState({
    notion_token: "",
    notion_data_source_id: "",
    feishu_token: "",
    feishu_folder_token: "",
  });
  const [syncConfigLoading, setSyncConfigLoading] = useState(false);
  const [showCurlExamples, setShowCurlExamples] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchApiKey();
      fetchSyncConfig();
    }
  }, [session]);

  const fetchApiKey = async () => {
    try {
      const response = await fetch("/api/user/api-key");
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey || "");
      }
    } catch (error) {
      console.error("Error fetching API key:", error);
    }
  };

  const generateApiKey = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/user/api-key", {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey);
      }
    } catch (error) {
      console.error("Error generating API key:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncConfig = async () => {
    try {
      const response = await fetch("/api/user/sync-config");
      if (response.ok) {
        const data = await response.json();
        setSyncConfig({
          notion_token: data.notion_token || "",
          notion_data_source_id: data.notion_data_source_id || "",
          feishu_token: data.feishu_token || "",
          feishu_folder_token: data.feishu_folder_token || "",
        });
      }
    } catch (error) {
      console.error("Error fetching sync config:", error);
    }
  };

  const saveSyncConfig = async () => {
    setSyncConfigLoading(true);
    try {
      const response = await fetch("/api/user/sync-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(syncConfig),
      });
      if (response.ok) {
        alert("同步配置已保存");
      } else {
        alert("保存失败，请重试");
      }
    } catch (error) {
      console.error("Error saving sync config:", error);
      alert("保存失败，请重试");
    } finally {
      setSyncConfigLoading(false);
    }
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>API Key</CardTitle>
              <CardDescription>Manage your API key for programmatic access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKey ? (
                <>
                  <Input value={apiKey} readOnly className="font-mono text-sm" />
                  <Button onClick={generateApiKey} disabled={loading}>
                    {loading ? "Generating..." : "Regenerate API Key"}
                  </Button>
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setShowCurlExamples(!showCurlExamples)}
                      className="w-full flex items-center justify-between"
                    >
                      <span>API Usage Examples</span>
                      {showCurlExamples ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    {showCurlExamples && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Chat API</h4>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Basic usage:</p>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                <code>{`curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{"message": "今天有什么重要新闻？"}'`}</code>
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Streaming response:</p>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                <code>{`curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{"message": "今天有什么重要新闻？", "stream": true}'`}</code>
                              </pre>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Favorites API</h4>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Get all favorites:</p>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                <code>{`curl -X GET "${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/favorites?limit=50" \\
  -H "x-api-key: ${apiKey}"`}</code>
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Get favorites with pagination:</p>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                <code>{`curl -X GET "${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/favorites?limit=20&offset=0" \\
  -H "x-api-key: ${apiKey}"`}</code>
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Button onClick={generateApiKey} disabled={loading}>
                  {loading ? "Generating..." : "Generate API Key"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Email:</span> {session.user?.email}
                </p>
                <p>
                  <span className="font-semibold">Name:</span> {session.user?.name || "Not set"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notion 同步配置</CardTitle>
              <CardDescription>配置 Notion API 凭证以同步收藏的简报</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Notion Token</label>
                <Input
                  type="password"
                  placeholder="ntn_..."
                  value={syncConfig.notion_token}
                  onChange={(e) =>
                    setSyncConfig({ ...syncConfig, notion_token: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Source ID</label>
                <Input
                  placeholder="2ab0201a-0dbc-806f-8f14-000bf6f9de11"
                  value={syncConfig.notion_data_source_id}
                  onChange={(e) =>
                    setSyncConfig({ ...syncConfig, notion_data_source_id: e.target.value })
                  }
                />
              </div>
              <Button onClick={saveSyncConfig} disabled={syncConfigLoading}>
                {syncConfigLoading ? "保存中..." : "保存配置"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>飞书同步配置</CardTitle>
              <CardDescription>配置飞书 API 凭证以同步收藏的简报</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">飞书 Token</label>
                <Input
                  type="password"
                  placeholder="u-..."
                  value={syncConfig.feishu_token}
                  onChange={(e) =>
                    setSyncConfig({ ...syncConfig, feishu_token: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Folder Token</label>
                <Input
                  placeholder="CF6jfWaXFlRCB4dJnBfciML5ned"
                  value={syncConfig.feishu_folder_token}
                  onChange={(e) =>
                    setSyncConfig({ ...syncConfig, feishu_folder_token: e.target.value })
                  }
                />
              </div>
              <Button onClick={saveSyncConfig} disabled={syncConfigLoading}>
                {syncConfigLoading ? "保存中..." : "保存配置"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}

