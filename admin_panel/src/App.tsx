import React from "react";
import { useAuthController } from "./controllers/AuthController";
import { LoginView } from "./views/LoginView";
import { DashboardView } from "./views/DashboardView";

export const App: React.FC = () => {
  const { isAuthenticated, error, login, logout } = useAuthController();

  return (
    <div className="app-container">
      {!isAuthenticated ? (
        <LoginView onLogin={login} error={error} />
      ) : (
        <DashboardView onLogout={logout} />
      )}
    </div>
  );
};

export default App;
