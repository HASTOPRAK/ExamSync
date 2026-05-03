import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe } from "@/api/authApi";

const AuthContext = createContext(null);

const TOKEN_KEY = "examsync_token";

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);  // { id, email, role }
  const [profile, setProfile] = useState(null);  // instructor or student row
  const [token, setToken]     = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);  // true while validating stored token

  // Validate the stored token on first render
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getMe(token)
      .then(({ user, profile }) => {
        setUser(user);
        setProfile(profile);
      })
      .catch(() => {
        // Token invalid / expired — clear it
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(({ token: newToken, user: newUser, profile: newProfile }) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setProfile(newProfile ?? null);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
