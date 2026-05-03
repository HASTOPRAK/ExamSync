import { LogOut, User } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import markUrl from "@/assets/mark-28.svg";

const ROLE_LABEL = {
  admin:   "Admin",
  teacher: "Teacher",
  student: "Student",
};

export default function Topbar() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }

  const displayName = profile?.full_name ?? user?.email ?? "";
  const roleLabel   = ROLE_LABEL[user?.role] ?? "";

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 backdrop-blur">
      {/* Mobile logo — only visible when sidebar is hidden */}
      <div className="flex items-center gap-2 lg:hidden">
        <img src={markUrl} alt="ExamSync" className="h-7 w-7" />
        <span className="text-sm font-bold">
          <span className="text-slate-100">Exam</span>
          <span className="text-sky-400">Sync</span>
        </span>
      </div>

      {/* Desktop: just show the role label */}
      <p className="hidden text-sm font-medium text-slate-400 lg:block">
        {roleLabel} Panel
      </p>

      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-300">{displayName}</span>
            <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              {roleLabel}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      )}
    </header>
  );
}
