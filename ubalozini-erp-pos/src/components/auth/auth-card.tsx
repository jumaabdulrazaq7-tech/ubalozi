import Link from "next/link";
import { BadgeDollarSign, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginCard() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-3 grid size-12 place-items-center rounded-md bg-primary text-primary-foreground">
          <BadgeDollarSign />
        </div>
        <CardTitle>Sign in to UBALOZINI ERP</CardTitle>
        <CardDescription>Admin and sales staff access for branch operations.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" placeholder="admin@ubalozini.co.tz" className="pl-10" />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" placeholder="Enter password" className="pl-10" />
              </div>
            </Field>
          </FieldGroup>
          <Button type="button" className="w-full">Login</Button>
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
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Send a secure Supabase Auth reset link to the staff email.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" placeholder="staff@ubalozini.co.tz" />
            </Field>
          </FieldGroup>
          <Button type="button">Send reset link</Button>
          <Button render={<Link href="/login" />} variant="ghost" nativeButton={false}>
            Back to login
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
