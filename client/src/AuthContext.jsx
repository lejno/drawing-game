import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("playerToken"));

  function login(newToken) {
    localStorage.setItem("playerToken", newToken);
    setToken(newToken);
  }

  function logout() {
    localStorage.removeItem("playerToken");
    setToken(null);
  }

  return (
    <AuthContext.Provider
      value={{ token, isLoggedIn: Boolean(token), login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
