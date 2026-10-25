import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "retriever_user";

function readStoredUser() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(readStoredUser);

  function setUser(newUser) {
    setUserState(newUser);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    } catch {
      // Private browsing or blocked storage - login still works,
      // it just won't survive a refresh.
    }
  }

  function logout() {
    setUserState(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}