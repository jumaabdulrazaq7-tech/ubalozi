import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  size = "md",
  showText = true,
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}) {
  const imageSize = size === "lg" ? 64 : size === "sm" ? 36 : 44;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image
        src="/ubalozi-logo.jpeg"
        alt="Ubalozini Electronics logo"
        width={imageSize}
        height={imageSize}
        priority={size === "lg"}
        className={cn(
          "shrink-0 rounded-md border border-sidebar-border object-cover shadow-sm",
          size === "lg" && "rounded-lg"
        )}
      />
      {showText ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-none text-[#ffc247]">UBALOZINI</p>
          <p className="mt-1 truncate text-xs tracking-[0.18em] text-sidebar-foreground/70">SMART WORLD</p>
        </div>
      ) : null}
    </div>
  );
}
