import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { apiClient } from "../lib/api";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("ninu_arts_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate session on app initialization
  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem("ninu_arts_token");
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiClient.get("/auth/me");
        if (response.data?.success && response.data?.data?.user) {
          const authUser = response.data.data.user;
          setUser(authUser);
          localStorage.setItem("ninu_arts_user", JSON.stringify(authUser));
        }
      } catch (err) {
        localStorage.removeItem("ninu_arts_token");
        localStorage.removeItem("ninu_arts_user");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/login", { email, password });
      if (response.data?.success && response.data?.data) {
        const { user: authUser, token } = response.data.data;
        localStorage.setItem("ninu_arts_token", token);
        localStorage.setItem("ninu_arts_user", JSON.stringify(authUser));
        setUser(authUser);
        return authUser as User;
      } else {
        throw new Error(response.data?.message || "Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout").catch(() => {});
    } finally {
      localStorage.removeItem("ninu_arts_token");
      localStorage.removeItem("ninu_arts_user");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
