import { useCallback } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function useAuth() {
  const router = useRouter();

  // Obter usuário do localStorage
  const user = typeof window !== "undefined" 
    ? (() => {
        const userData = localStorage.getItem("user");
        if (userData) {
          try {
            return JSON.parse(userData) as User;
          } catch (error) {
            console.error("Erro ao parsear usuário:", error);
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
          }
        }
        return null;
      })()
    : null;

  const logout = useCallback(() => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    router.push("/login");
  }, [router]);

  return { user, logout };
}
