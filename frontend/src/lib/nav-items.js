import { CalendarRange, Database, LayoutDashboard, Upload } from "lucide-react";

export const teacherNavItems = [
  { title: "Dashboard",            path: "/",                   icon: LayoutDashboard },
  { title: "Data Management",      path: "/data-management",    icon: Database },
  { title: "Exam Setup",           path: "/exam-setup",         icon: CalendarRange },
  { title: "Imports & Validation", path: "/imports-validation", icon: Upload },
];

export const navItems = teacherNavItems;
