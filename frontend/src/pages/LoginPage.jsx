import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { loginUser, googleLoginUser } from "@/api/authApi";
import { getApiErrorMessage } from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CenterGlow, DotGridBackground, GrainOverlay } from "@/components/common/PageBackground";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const from = location.state?.from?.pathname ?? "/dashboard";

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

  async function handleGoogleSuccess({ credential }) {
    try {
      const data = await googleLoginUser(credential);
      login({ token: data.token, user: data.user, profile: data.profile });
      toast.success("Welcome!");
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Google sign-in failed"));
    }
  }

  const shouldReduce = useReducedMotion();
  const fadeUp = shouldReduce
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <DotGridBackground />
      <GrainOverlay />
      <CenterGlow />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <motion.div
          className="mb-8 flex flex-col items-center gap-3"
          {...fadeUp}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <img
              src={resolvedTheme === "dark"
                ? "/examsync-brand/mark-40px-dark.svg"
                : "/examsync-brand/mark-40px.svg"}
              alt="ExamSync mark"
              className="h-10 w-10"
            />
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
        </motion.div>

        {/* Card */}
        <motion.div
          className="rounded-2xl border border-border bg-card p-8 shadow-sm"
          {...fadeUp}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
        >
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

          {/* Google */}
          <div className="mt-5 flex flex-col items-center gap-3 border-t border-border pt-5">
            <p className="text-xs text-muted-foreground">or continue with</p>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("Google sign-in failed")}
              theme="outline"
              size="large"
              width="100%"
              text="signin_with"
            />
          </div>

          <div className="mt-4 space-y-2 text-center text-sm text-muted-foreground">
            <p>
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Register
              </Link>
            </p>
            <p>
              Looking for your schedule?{" "}
              <Link
                to="/check-schedule"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Check here
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
