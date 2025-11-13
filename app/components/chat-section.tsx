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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        message: data.response || "Sorry, I couldn't process that request.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
        sources: data.sources || [],
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        message: "Error: Failed to send message",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <div className="flex items-center gap-2 p-4 border-b">
        <MessageCircle className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Chat with AI Assistant</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Start a conversation with the AI assistant
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg.message}
            isUser={msg.isUser}
            timestamp={msg.timestamp}
            sources={msg.sources}
          />
        ))}
        {isLoading && (
          <ChatMessage
            message="Thinking..."
            isUser={false}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}

