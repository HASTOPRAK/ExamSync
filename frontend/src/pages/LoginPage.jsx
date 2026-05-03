import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { loginUser } from "@/api/authApi";
import { getApiErrorMessage } from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoUrl from "@/assets/logo-dark.svg";

const STUDENT_EMAIL_SUFFIX = "@ogr.edu.tr";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? null;

  const [tab, setTab]           = useState("teacher"); // "teacher" | "student"
  const [email, setEmail]       = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const resolvedEmail =
      tab === "student" ? `${studentNo.trim()}${STUDENT_EMAIL_SUFFIX}` : email.trim();

    try {
      const data = await loginUser({ email: resolvedEmail, password });
      login({ token: data.token, user: data.user, profile: data.profile });
      toast.success(`Welcome back!`);

      const destination = from ?? (data.user.role === "student" ? "/schedule" : "/");
      navigate(destination, { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img src={logoUrl} alt="ExamSync" className="h-16 w-auto rounded-xl" />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <h2 className="mb-6 text-xl font-semibold text-white">Sign in</h2>

          {/* Role tabs */}
          <div className="mb-6 flex rounded-xl border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setTab("teacher")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === "teacher"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Teacher / Admin
            </button>
            <button
              type="button"
              onClick={() => setTab("student")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === "student"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Student
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "teacher" ? (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-slate-600"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="student-no" className="text-slate-300">Student Number</Label>
                <Input
                  id="student-no"
                  type="text"
                  placeholder="e.g. 202631009"
                  value={studentNo}
                  onChange={(e) => setStudentNo(e.target.value)}
                  required
                  autoComplete="username"
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-slate-600"
                />
                {studentNo && (
                  <p className="text-xs text-slate-500">
                    Login as: {studentNo.trim()}{STUDENT_EMAIL_SUFFIX}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-slate-600"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-slate-900 hover:bg-slate-100"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link to="/register" className="text-slate-300 underline-offset-4 hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
