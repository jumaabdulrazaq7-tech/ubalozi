"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  ChevronRight,
  Gauge,
  Languages,
  LogOut,
  Menu,
  Moon,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sun,
  Users,
  WalletCards,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { BrandLogo } from "@/components/app/brand-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/branches", label: "Branches", icon: Building2 },
  { href: "/products", label: "Products", icon: PackageSearch },
  { href: "/imei", label: "IMEI Devices", icon: Smartphone },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/pos", label: "Sales POS", icon: ReceiptText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/debts", label: "Debts", icon: WalletCards },
];

function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
      <div className="flex h-20 items-center px-6">
        <BrandLogo />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <item.icon className="size-4" />
            {item.label}
            <ChevronRight className="ml-auto size-4 opacity-40" />
          </Link>
        ))}
      </nav>
      <div className="p-4">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4" />
            Admin workspace
          </div>
          <p className="mt-2 text-xs leading-5 text-sidebar-foreground/65">
            Role based access is enforced through Supabase RLS and app guards.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; role: string; avatar_url: string | null } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [loadingSession, setLoadingSession] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const stored = window.localStorage.getItem("ubalozini-theme");
    const nextTheme = stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      if (data.user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name,role,avatar_url")
          .eq("id", data.user.id)
          .single();
        if (mounted) setProfile((profileData as { full_name: string; role: string; avatar_url: string | null } | null) ?? null);
      }
      setLoadingSession(false);
      if (!data.user && pathname !== "/login") {
        router.replace("/login");
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
      if (!session?.user && pathname !== "/login") {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [pathname, router, supabase]);

  async function handleLogout() {
    await supabase?.auth.signOut();
    router.replace("/login");
  }

  function setAppTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    window.localStorage.setItem("ubalozini-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-4">
        <Alert className="max-w-xl">
          <ShieldCheck />
          <AlertTitle>Supabase key is required</AlertTitle>
          <AlertDescription>
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to run live database features.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loadingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-4 text-sm text-muted-foreground">
        Loading secure workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-4 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    );
  }

  const initials =
    user.email
      ?.split("@")[0]
      .split(/[._-]/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "UB";

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation" />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-20 items-center px-6">
                  <BrandLogo />
                </div>
                <Separator />
                <nav className="flex flex-col gap-1 p-3">
                  {navigation.map((item) => (
                    <Link key={item.href} href={item.href} className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-accent">
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#ffc247]">UBALOZINI ELECTRONICS</p>
              <p className="truncate text-xs text-muted-foreground">Smart World operations across Lumumba, Sokoni, and Kariakoo</p>
            </div>
            <Button variant="outline" size="icon" aria-label="Switch language">
              <Languages />
            </Button>
            <Button variant={theme === "light" ? "secondary" : "outline"} size="icon" aria-label="Light mode" onClick={() => setAppTheme("light")}>
              <Sun />
            </Button>
            <Button variant={theme === "dark" ? "secondary" : "outline"} size="icon" aria-label="Dark mode" onClick={() => setAppTheme("dark")}>
              <Moon />
            </Button>
            <Avatar className="size-9">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.full_name} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" aria-label="Logout" onClick={handleLogout}>
              <LogOut />
            </Button>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
