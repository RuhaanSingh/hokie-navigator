"use client";
import type { ReactNode } from "react";
import { StoreProvider } from "./store-provider";
import { ChatProvider } from "@/components/chat/chat-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <ChatProvider>{children}</ChatProvider>
    </StoreProvider>
  );
}
