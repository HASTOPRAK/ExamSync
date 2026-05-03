import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { registerTeacher, registerStudent } from "@/api/authApi";
import { getApiErrorMessage } from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]               = useState("teacher");
  const [loading, setLoading]       = useState(false);

  // Teacher fields
  const [fullName, setFullName]     = useState("");
  const [email, setEmail]           = useState("");

  // Shared
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");

  // Student fields
  const [studentNo, setStudentNo]   = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      let data;
      if (tab === "teacher") {
        data = await registerTeacher({ full_name: fullName, email, password });
        login({ token: data.token, user: data.user, profile: data.instructor ?? null });
        toast.success("Account created! Welcome.");
        navigate("/", { replace: true });
      } else {
        data = await registerStudent({ student_no: studentNo, password });
        login({ token: data.token, user: data.user, profile: data.student ?? null });
        toast.success("Account created! Welcome.");
        navigate("/schedule", { replace: true });
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
            Exam Scheduling System
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">ExamSync</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <h2 className="mb-6 text-xl font-semibold text-white">Create account</h2>

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
              <>
                <div className="space-y-2">
                  <Label htmlFor="full-name" className="text-slate-300">Full name</Label>
                  <Input
                    id="full-name"
                    type="text"
                    placeholder="Dr. Jane Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-slate-600"
                  />
                </div>
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
              </>
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
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-slate-600"
                />
                <p className="text-xs text-slate-500">
                  Your student number must already be registered in the system by your institution.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-slate-300">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-slate-600"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-slate-900 hover:bg-slate-100"
            >
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="text-slate-300 underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
