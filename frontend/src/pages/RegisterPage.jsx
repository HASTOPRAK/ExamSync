import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { registerTeacher } from "@/api/authApi";
import { getApiErrorMessage } from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CenterGlow, DotGridBackground, GrainOverlay } from "@/components/common/PageBackground";

const PASSWORD_RULES = [
  { label: "At least 8 characters",  test: (p) => p.length >= 8 },
  { label: "One uppercase letter",    test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter",    test: (p) => /[a-z]/.test(p) },
  { label: "One number",              test: (p) => /[0-9]/.test(p) },
];

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!passwordValid) {
      toast.error("Password does not meet the requirements");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const data = await registerTeacher({
        full_name: fullName,
        email,
        password,
      });
      login({
        token: data.token,
        user: data.user,
        profile: data.profile ?? null,
      });
      toast.success("Account created! Welcome.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  const shouldReduce = useReducedMotion();
  const fadeUp = shouldReduce
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
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
            Create account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                type="text"
                placeholder="Dr. Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

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
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(password);
                    return (
                      <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                        {ok
                          ? <Check className="h-3 w-3 shrink-0" />
                          : <X className="h-3 w-3 shrink-0" />}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 border-t border-border pt-5 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
