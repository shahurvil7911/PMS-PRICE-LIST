import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null = loading, false = anon
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("pms_token");
    if (!token) { setUser(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      localStorage.removeItem("pms_token");
      setUser(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (username, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("pms_token", data.token);
      setUser(data.user);
      return true;
    } catch (e) {
      setError(formatApiError(e));
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("pms_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, error, setError, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
