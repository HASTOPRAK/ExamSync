import { Navigate, Route, Routes } from "react-router";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import DashboardPage from "@/pages/DashboardPage";
import DataManagementPage from "@/pages/DataManagementPage";
import SetupPage from "@/pages/SetupPage";
import NewExamPeriodPage from "@/pages/NewExamPeriodPage";
import ExamPeriodPage from "@/pages/ExamPeriodPage";
import CheckSchedulePage from "@/pages/CheckSchedulePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/login"          element={<LoginPage />} />
      <Route path="/register"       element={<RegisterPage />} />
      <Route path="/check-schedule" element={<CheckSchedulePage />} />

      {/* Teacher / Admin only */}
      <Route element={<ProtectedRoute roles={["teacher", "admin"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/"                   element={<DashboardPage />} />
          <Route path="/data/setup"         element={<SetupPage />} />
          <Route path="/data/management"    element={<DataManagementPage />} />
          <Route path="/exams/new"          element={<NewExamPeriodPage />} />
          <Route path="/exams/:id"          element={<ExamPeriodPage />} />

          {/* Legacy redirects */}
          <Route path="/setup"              element={<Navigate to="/data/setup" replace />} />
          <Route path="/data-management"    element={<Navigate to="/data/management" replace />} />
          <Route path="/exam-setup"         element={<Navigate to="/exams/new" replace />} />
          <Route path="/imports-validation" element={<Navigate to="/data/setup" replace />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
