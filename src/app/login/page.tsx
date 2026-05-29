import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · TripCraft" };

export default async function LoginPage() {
  const u = await getSessionUser();
  if (u) redirect("/");

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-10 justify-center w-full"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] text-[var(--on-dark)]" style={{ background: "linear-gradient(150deg, var(--gold), #B0863F)" }}>
            <Compass className="h-4 w-4" />
          </span>
          <span className="font-display text-2xl tracking-tight text-ink">
            Trip<b className="text-gold-deep">Craft</b>
          </span>
        </Link>

        <div className="rounded-lg border border-line bg-paper p-8 shadow-soft">
          <div className="text-center mb-6">
            <p className="tc-eyebrow gold">Welcome back</p>
            <h1 className="mt-2 font-display text-3xl text-ink">Sign in</h1>
          </div>
          <LoginForm />
          <p className="mt-6 text-center text-xs text-muted">
            New to TripCraft?{" "}
            <Link href="/signup" className="text-ink underline">
              Create an agency account
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.2em] text-muted">
          Crafted for premium travel
        </p>
      </div>
    </main>
  );
}
