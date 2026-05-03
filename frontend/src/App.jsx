import { Navigate, Route, Routes } from "react-router";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import DashboardPage from "@/pages/DashboardPage";
import DataManagementPage from "@/pages/DataManagementPage";
import ExamSetupPage from "@/pages/ExamSetupPage";
import ImportsValidationPage from "@/pages/ImportsValidationPage";
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
          <Route path="/data-management"    element={<DataManagementPage />} />
          <Route path="/exam-setup"         element={<ExamSetupPage />} />
          <Route path="/imports-validation" element={<ImportsValidationPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
