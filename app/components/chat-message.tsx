"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  sources?: string[];
}

export function ChatMessage({ message, isUser, timestamp, sources }: ChatMessageProps) {
  // 处理换行符：将单个 \n 转换为 markdown 换行格式（两个空格 + \n）
  // 但保留双换行符 \n\n 用于段落分隔，避免在已有空格的行尾重复添加
  const processedMessage = isUser 
    ? message 
    : message
        // 先处理双换行符，用占位符临时替换
        .replace(/\n\n/g, '\0\0')
        // 将单个换行符转换为 markdown 换行（两个空格 + \n）
        .replace(/\n/g, '  \n')
        // 恢复双换行符（移除多余的空格）
        .replace(/\0\0/g, '\n\n');
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar className="h-8 w-8">
        <AvatarFallback>{isUser ? "U" : "AI"}</AvatarFallback>
      </Avatar>
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[80%]`}>
        <div
          className={`rounded-lg px-4 py-2 ${
            isUser
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message}</p>
          ) : (
            <div className="text-sm prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-blue-600 prose-a:underline prose-strong:font-semibold">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                }}
              >
                {processedMessage}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-2 space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">来源：</span>
            <div className="flex flex-wrap gap-2">
              {sources.map((source, index) => (
                <a
                  key={index}
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 underline break-all"
                >
                  {source}
                </a>
              ))}
            </div>
          </div>
        )}
        {!isUser && (
          <span className="text-xs text-muted-foreground mt-1">AI assistant</span>
        )}
        {timestamp && (
          <span className="text-xs text-muted-foreground mt-1">{timestamp}</span>
        )}
      </div>
    </div>
  );
}

