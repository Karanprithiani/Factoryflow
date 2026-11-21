// AuthContext.jsx — stores the logged-in user and token for the whole app.
// Using React Context avoids having to pass user/token as props through every component.

import { createContext, useContext, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

// Keys used to persist login across browser refreshes
const TOKEN_KEY = 'ff_token';
const USER_KEY  = 'ff_user';

export function AuthProvider({ children }) {
  // Load from localStorage on first render (so a page refresh keeps you logged in)
  const [user,  setUser]  = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);

  // Called from LoginPage. Sends credentials to the API and saves the response.
  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY,  JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook so pages can do: const { user, login, logout } = useAuth()
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
