"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, ImagePlus, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  id: string;
  full_name: string;
  role: string;
  preferred_language: string;
  is_active: boolean;
  avatar_url: string | null;
  branches: { name: string } | null;
};

export function SettingsModule() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setLoading(false);
      setError(userError?.message || "User session not found.");
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,role,preferred_language,is_active,avatar_url,branches(name)")
      .eq("id", userData.user.id)
      .single();
    setLoading(false);

    if (profileError) {
      setError(profileError.message);
      return;
    }
    setProfile(data as unknown as ProfileRow);
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function uploadAvatar() {
    if (!supabase || !profile || !file) return;
    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `${profile.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(storagePath, file, {
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("profile-avatars").getPublicUrl(storagePath);
      const { error: updateError } = await supabase.rpc("update_own_avatar_url", { p_avatar_url: data.publicUrl });
      if (updateError) throw updateError;

      setFile(null);
      setMessage("Profile picture uploaded successfully. Refresh if the header avatar has not updated yet.");
      await loadProfile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Avatar upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const initials =
    profile?.full_name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "UB";

  return (
    <AppShell>
      <PageHeader title="Settings" description="User profile, account status, language preference, and profile picture." />
      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImagePlus className="size-4" /> Profile Picture</CardTitle>
            <CardDescription>Upload a PNG, JPG, or WebP image for your account avatar.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Settings action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
            {message ? <Alert><Upload /><AlertTitle>Saved</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
            <div className="flex items-center gap-4">
              <Avatar className="size-20" size="lg">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.full_name} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{profile?.full_name ?? "Loading profile..."}</p>
                <p className="text-sm text-muted-foreground">{profile?.branches?.name ?? "No branch assigned"}</p>
              </div>
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel>Profile Image</FieldLabel>
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
              </Field>
            </FieldGroup>
            <div className="flex gap-2">
              <Button type="button" onClick={uploadAvatar} disabled={!file || uploading || !profile}>
                <Upload data-icon="inline-start" />
                {uploading ? "Uploading..." : "Upload Photo"}
              </Button>
              <Button type="button" variant="outline" onClick={loadProfile} disabled={loading}>
                <RefreshCw data-icon="inline-start" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Account Details</CardTitle>
            <CardDescription>Role and access information from Supabase profiles.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Full Name</div>
                <div className="mt-1 font-semibold">{profile?.full_name ?? "-"}</div>
              </div>
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Role</div>
                <div className="mt-1"><Badge>{profile?.role ?? "-"}</Badge></div>
              </div>
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Language</div>
                <div className="mt-1 font-semibold">{profile?.preferred_language === "sw" ? "Swahili" : "English"}</div>
              </div>
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="mt-1"><Badge variant={profile?.is_active ? "secondary" : "destructive"}>{profile?.is_active ? "Active" : "Inactive"}</Badge></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
