import { CalendarCheck, CalendarRange, Database, LayoutDashboard, Upload } from "lucide-react";

export const teacherNavItems = [
  { title: "Dashboard",            path: "/",                   icon: LayoutDashboard },
  { title: "Data Management",      path: "/data-management",    icon: Database },
  { title: "Exam Setup",           path: "/exam-setup",         icon: CalendarRange },
  { title: "Imports & Validation", path: "/imports-validation", icon: Upload },
];

export const studentNavItems = [
  { title: "My Schedule", path: "/schedule", icon: CalendarCheck },
];

// Legacy export — kept so any existing import doesn't break
export const navItems = teacherNavItems;
