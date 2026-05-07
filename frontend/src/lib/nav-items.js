import { CalendarRange, Database, LayoutDashboard, ListChecks } from "lucide-react";

export const teacherNavItems = [
  { title: "Dashboard",       path: "/",                icon: LayoutDashboard },
  { title: "Setup",           path: "/setup",           icon: ListChecks },
  { title: "Data Management", path: "/data-management", icon: Database },
  { title: "Exam Setup",      path: "/exam-setup",      icon: CalendarRange },
];

export const navItems = teacherNavItems;
