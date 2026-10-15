"use client";
import * as S from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...p }: S.SwitchProps) {
  return (
    <S.Root
      className={cn("relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-[#d6d3d1] transition-colors data-[state=checked]:bg-primary disabled:opacity-50", className)}
      {...p}
    >
      <S.Thumb className="block h-[18px] w-[18px] translate-x-[1px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[17px]" />
    </S.Root>
  );
}
