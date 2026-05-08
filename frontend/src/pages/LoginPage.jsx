import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { loginUser } from "@/api/authApi";
import { getApiErrorMessage } from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoadingOverlay from "@/components/common/LoadingOverlay";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await loginUser({ email: email.trim(), password });
      login({ token: data.token, user: data.user, profile: data.profile });
      toast.success("Welcome back!");
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingOverlay />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Subtle background gradient */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

      <div className="relative w-full max-w-sm">
        {/* Logo mark */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              <span className="text-foreground">Exam</span>
              <span className="text-primary">Sync</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Exam scheduling platform
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h2 className="font-display mb-6 text-xl font-semibold text-foreground">
            Sign in
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-5 space-y-2 border-t border-border pt-5 text-center text-sm text-muted-foreground">
            <p>
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                Register
              </Link>
            </p>
            <p>
              Looking for your schedule?{" "}
              <Link
                to="/check-schedule"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                Check here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
