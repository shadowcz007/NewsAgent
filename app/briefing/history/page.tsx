"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Header } from "@/components/header";
import { BriefingCard } from "@/components/briefing-card";

function BriefingHistoryContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchHistory();
    }
  }, [session]);

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/briefing/history");
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-3xl font-bold mb-6">Briefing History</h1>

        <div className="space-y-4">
          {history.length > 0 ? (
            history.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Briefing</h3>
                    <span className="text-sm text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">{item.content}</p>
                  {item.sources && item.sources.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <p className="font-semibold mb-2">Sources:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {item.sources.map((source: string, index: number) => (
                          <li key={index}>
                            <a href={source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {source}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No briefing history available</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function BriefingHistoryPage() {
  return <BriefingHistoryContent />;
}

