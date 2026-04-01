import { useState, useCallback } from "react";

// Auth Controller
export const useAuthController = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Check local storage for dummy auth token
    return localStorage.getItem("adminAuth") === "true";
  });

  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, pass: string) => {
    // Dummy authentication
    if (email === "yuvaraj@reidiusinfra.com" && pass === "Yuvaraj@2003") {
      setIsAuthenticated(true);
      setError(null);
      localStorage.setItem("adminAuth", "true");
      return true;
    } else {
      setError("Invalid Email or Password");
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem("adminAuth");
  }, []);

  return { isAuthenticated, error, login, logout, setError };
};
