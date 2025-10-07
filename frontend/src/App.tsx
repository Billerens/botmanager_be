import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "antd";

import { useAuthStore } from "@/store/authStore";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { LandingPage } from "@/pages/LandingPage";
import { DemoPage } from "@/pages/DemoPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { BotsPage } from "@/pages/BotsPage";
import { BotDetailsPage } from "@/pages/BotDetailsPage";
import { LeadsPage } from "@/pages/LeadsPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { SettingsPage } from "@/pages/SettingsPage";

const { Content } = Layout;

function App() {
  const { isAuthenticated, user } = useAuthStore();

  console.log("App render - isAuthenticated:", isAuthenticated, "user:", user);
  console.log(
    "App render - localStorage auth-storage:",
    localStorage.getItem("auth-storage")
  );

  // Отслеживаем изменения состояния аутентификации
  useEffect(() => {
    console.log("App useEffect - isAuthenticated changed:", isAuthenticated);
    console.log("App useEffect - user changed:", user);
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <AppSidebar />
      <Layout>
        <AppHeader />
        <Content>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/bots" element={<BotsPage />} />
            <Route path="/bots/:id" element={<BotDetailsPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
