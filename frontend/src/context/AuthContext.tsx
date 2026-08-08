import { useCallback, useEffect, useState, type ReactNode } from "react";
import { authApi, getToken } from "../lib/api";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Al montar: si hay un token guardado, valida la sesión contra /auth/me.
  useEffect(() => {
    let ignore = false;

    const restore = getToken()
      ? authApi.me().then(
          (currentEmail) => {
            if (!ignore) setEmail(currentEmail);
          },
          () => {
            // Token vencido o inválido: se descarta sin molestar al usuario.
            authApi.logout();
          }
        )
      : Promise.resolve();

    restore.finally(() => {
      if (!ignore) setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, []);

  const login = useCallback(async (loginEmail: string, password: string) => {
    await authApi.login(loginEmail, password);
    setEmail(await authApi.me());
  }, []);

  const register = useCallback(async (registerEmail: string, password: string) => {
    await authApi.register({ email: registerEmail, password });
    setEmail(await authApi.me());
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setEmail(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ email, isAuthenticated: email !== null, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
