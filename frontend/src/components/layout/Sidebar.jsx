import { NavLink } from "react-router";
import { teacherNavItems, studentNavItems } from "@/lib/nav-items";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const { user } = useAuth();
  const items = user?.role === "student" ? studentNavItems : teacherNavItems;

  return (
    <aside className="hidden w-72 border-r border-slate-800 bg-slate-950/95 lg:flex lg:flex-col">
      <div className="border-b border-slate-800 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
          Exam Scheduling System
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">ExamSync</h1>
        <p className="mt-2 text-sm text-slate-400">
          {user?.role === "student"
            ? "View your exam schedule."
            : "Scheduling, imports, validation, and admin tools in one place."}
        </p>
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
