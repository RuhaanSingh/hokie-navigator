"use client";
import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export function Tip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root delayDuration={150}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-[80] max-w-xs rounded-[8px] border border-border bg-white px-3 py-2 text-[12.5px] leading-snug text-text shadow-lg">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
export const TipProvider = T.Provider;
