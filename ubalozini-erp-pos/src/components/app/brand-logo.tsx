import { cn } from "@/lib/utils";

export function BrandLogo({
  size = "md",
  showText = true,
  centered = false,
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  centered?: boolean;
}) {
  const imageSize = size === "lg" ? 64 : size === "sm" ? 36 : 44;
  const logoSrc = process.env.NEXT_PUBLIC_BASE_PATH
    ? `${process.env.NEXT_PUBLIC_BASE_PATH}/ubalozi-logo.jpeg`
    : "/ubalozi-logo.jpeg";

  return (
    <div className={cn("flex min-w-0 items-center gap-3", centered && "justify-center text-center")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSrc}
        alt="Ubalozini Electronics logo"
        width={imageSize}
        height={imageSize}
        className={cn(
          "shrink-0 rounded-md border border-sidebar-border object-cover shadow-sm",
          size === "lg" && "rounded-lg"
        )}
      />
      {showText ? (
        <div className={cn("min-w-0", centered && "text-center")}>
          <p className="truncate text-sm font-semibold leading-none text-[#ffc247]">UBALOZINI</p>
          <p className="mt-1 truncate text-xs tracking-[0.18em] text-sidebar-foreground/70">SMART WORLD</p>
        </div>
      ) : null}
    </div>
  );
}
