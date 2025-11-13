"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { BriefingSection } from "./components/briefing-section";
import { ChatSection } from "./components/chat-section";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("All");

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onSearch={setSearchQuery}
        onCategoryChange={setCategory}
        currentCategory={category}
      />
      <main className="flex-1 container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6 h-[calc(100vh-8rem)]">
          <div className="overflow-y-auto pr-4">
            <BriefingSection searchQuery={searchQuery} category={category} />
          </div>
          <div className="h-full">
            <ChatSection />
          </div>
        </div>
      </main>
    </div>
  );
}
