"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface BriefingCardProps {
  title: string;
  summary?: string;
  source: string;
  category?: string;
  url?: string;
  translatedFrom?: string;
}

export function BriefingCard({
  title,
  summary,
  source,
  category = "OTHER",
  url,
  translatedFrom,
}: BriefingCardProps) {
  const categoryColor = CATEGORY_COLORS[category] || "gray";

  const handleClick = () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card 
      className={cn(
        "hover:shadow-lg transition-shadow",
        url && "cursor-pointer"
      )}
      onClick={handleClick}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-semibold",
              categoryColor === "blue" && "border-blue-500 text-blue-700 bg-blue-50",
              categoryColor === "red" && "border-red-500 text-red-700 bg-red-50",
              categoryColor === "green" && "border-green-500 text-green-700 bg-green-50",
              categoryColor === "purple" && "border-purple-500 text-purple-700 bg-purple-50",
              categoryColor === "gray" && "border-gray-500 text-gray-700 bg-gray-50"
            )}
          >
            {category}
          </Badge>
          {translatedFrom && (
            <span className="text-xs text-muted-foreground">
              Translated from: {translatedFrom}
            </span>
          )}
        </div>
        <h3 className="text-lg font-bold mt-2">{title}</h3>
      </CardHeader>
      <CardContent>
        {summary && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">{summary}</p>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span>Source: {source}</span>
        </div>
      </CardContent>
    </Card>
  );
}




