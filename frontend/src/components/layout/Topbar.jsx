import { LogOut, User } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

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
      <div>
        <p className="text-sm font-medium text-slate-200">ExamSync</p>
        <p className="text-xs text-slate-500">{roleLabel} Panel</p>
      </div>

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
