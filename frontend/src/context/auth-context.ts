import { createContext } from "react";

export type AuthContextValue = {
  email: string | null;
  isAuthenticated: boolean;
  loading: boolean; // true mientras se restaura la sesión al cargar la app
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
