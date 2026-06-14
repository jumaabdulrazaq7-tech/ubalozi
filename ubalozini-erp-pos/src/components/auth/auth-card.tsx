"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, CheckCircle2, LockKeyhole, Mail } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function LoginCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supabase = createClient();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!supabase) {
      setError("Supabase is not configured. Add the public Supabase key before logging in.");
      return;
    }

    setPending(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setStatus("Login successful. Opening dashboard...");
    router.replace("/dashboard");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-5 flex flex-col items-center gap-4 text-center">
          <BrandLogo size="lg" showText={false} centered imageClassName="size-28 border-[#ffc247]/35" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-xl font-semibold tracking-wide text-[#ffc247]">UBALOZINI ELECTRONICS</p>
            <p className="text-xs tracking-[0.35em] text-muted-foreground">SMART WORLD</p>
          </div>
        </div>
        <CardTitle className="text-center">Sign in to UBALOZINI ERP</CardTitle>
        <CardDescription className="text-center">Admin and sales staff access for branch operations.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {!isSupabaseConfigured() ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Missing Supabase key</AlertTitle>
              <AlertDescription>Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to enable login.</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Login failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {status ? (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Authenticated</AlertTitle>
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" placeholder="admin@ubalozini.co.tz" className="pl-10" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" placeholder="Enter password" className="pl-10" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
            </Field>
          </FieldGroup>
          <Button type="submit" className="w-full" disabled={pending || !isSupabaseConfigured()}>
            {pending ? "Signing in..." : "Login"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
            <span className="text-muted-foreground">Role: Admin / Sales</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ForgotPasswordCard() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supabase = createClient();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!supabase) {
      setError("Supabase is not configured. Add the public Supabase key before sending reset links.");
      return;
    }

    setPending(true);
    const baseSegment = window.location.pathname.startsWith("/ubalozi") ? "/ubalozi" : "";
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${baseSegment}/login`,
    });
    setPending(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setStatus("Password reset link sent. Check the staff email inbox.");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Send a secure Supabase Auth reset link to the staff email.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Reset failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {status ? (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Reset email sent</AlertTitle>
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" placeholder="staff@ubalozini.co.tz" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={pending || !isSupabaseConfigured()}>{pending ? "Sending..." : "Send reset link"}</Button>
          <Button render={<Link href="/login" />} variant="ghost" nativeButton={false}>
            Back to login
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
