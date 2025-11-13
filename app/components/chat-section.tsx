"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";

interface Message {
  id: string;
  message: string;
  isUser: boolean;
  timestamp: string;
  sources?: string[];
}

export function ChatSection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (message: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      message,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // 创建AI消息占位符
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      message: "",
      isUser: false,
      timestamp: new Date().toLocaleTimeString(),
      sources: [],
    };

    setMessages((prev) => [...prev, aiMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) {
        throw new Error("Response body is not readable");
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;
          
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === "content" && data.text) {
                // 更新消息内容
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, message: msg.message + data.text }
                      : msg
                  )
                );
              } else if (data.type === "done") {
                // 更新sources并完成
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, sources: data.sources || [] }
                      : msg
                  )
                );
                setIsLoading(false);
                return;
              } else if (data.type === "error") {
                // 处理错误
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, message: `Error: ${data.message || "Failed to process message"}` }
                      : msg
                  )
                );
                setIsLoading(false);
                return;
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      // 如果流结束但没有收到done事件，设置loading为false
      setIsLoading(false);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? { ...msg, message: "Error: Failed to send message" }
            : msg
        )
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <div className="flex items-center gap-2 p-4 border-b flex-shrink-0">
        <MessageCircle className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Chat with AI Assistant</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Start a conversation with the AI assistant
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg.message || (msg.isUser ? "" : "正在思考...")}
            isUser={msg.isUser}
            timestamp={msg.timestamp}
            sources={msg.sources}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0">
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}

