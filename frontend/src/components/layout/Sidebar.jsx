import { NavLink } from "react-router";
import { teacherNavItems, studentNavItems } from "@/lib/nav-items";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import markUrl from "@/assets/mark-40.svg";

export default function Sidebar() {
  const { user } = useAuth();
  const items = user?.role === "student" ? studentNavItems : teacherNavItems;

  return (
    <aside className="hidden w-72 border-r border-slate-800 bg-slate-950/95 lg:flex lg:flex-col">
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex items-center gap-3">
          <img src={markUrl} alt="ExamSync mark" className="h-10 w-10 shrink-0" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-slate-100">Exam</span>
              <span className="text-sky-400">Sync</span>
            </h1>
            <p className="text-xs text-slate-500">
              {user?.role === "student" ? "Student Portal" : "Admin Panel"}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {items.map(({ title, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "border-slate-700 bg-slate-800 text-white"
                  : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900 hover:text-slate-100",
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span>{title}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
