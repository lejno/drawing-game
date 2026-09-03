import { useEffect, useState } from "react";
import socket from "./client";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("http://localhost:3000/api/me", { credentials: "include" })
      .then((response) => setIsLoggedIn(response.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  function login() {
    setIsLoggedIn(true);
    socket.disconnect();
    socket.connect();
  }

  function logout() {
    fetch("http://localhost:3000/api/logout", {
      method: "POST",
      credentials: "include",
    }).finally(() => setIsLoggedIn(false));
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
