import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<unknown>;
  signUp: (email: string, password: string) => Promise<unknown>;
  signInWithGoogle: () => Promise<unknown>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
