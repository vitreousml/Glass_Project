"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { recordLogin } from "@/lib/api";

export interface User {
  uid: string;
  email: string;
  displayName: string;
  plan: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  loginDevMock: (email: string, name?: string) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  loginDevMock: () => {},
  logout: async () => {},
  isLoading: true,
  authError: null,
  clearAuthError: () => {},
});

// Plain-language messages for the Firebase errors people actually hit.
function friendlyAuthError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match an account.";
    case "auth/invalid-email":
      return "That doesn't look like an email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "Couldn't reach the sign-in service. Check your connection.";
    case "auth/popup-blocked":
      return "The browser blocked the Google window. Allow pop-ups for this site and try again.";
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/weak-password":
      return "Choose a password of at least 6 characters.";
    default:
      return code ? `${fallback} (${code}).` : `${fallback}.`;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Listen to real Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setToken(idToken);
          localStorage.setItem("glass_platform_token", idToken);

          const appUser: User = {
            uid: fbUser.uid,
            email: fbUser.email || "",
            displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "Researcher",
            plan: "Academic Free Tier",
          };
          setUser(appUser);
          localStorage.setItem("glass_platform_user", JSON.stringify(appUser));
        } catch (err) {
          console.error("Error retrieving Firebase token:", err);
        }
      } else {
        // Fallback: check localStorage for saved session
        const savedToken = localStorage.getItem("glass_platform_token");
        const savedUser = localStorage.getItem("glass_platform_user");
        if (savedToken && savedUser) {
          try {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
          } catch {
            localStorage.removeItem("glass_platform_token");
            localStorage.removeItem("glass_platform_user");
          }
        } else {
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      localStorage.setItem("glass_platform_token", idToken);
      // Save this person's name and email. Never block sign-in if it fails.
      recordLogin(idToken).catch((e) => console.warn("Could not record login:", e.message));
    } catch (caught) {
      const err = caught as { code?: string; message?: string };
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
      console.error("Google sign-in failed:", err.code, err.message);
      setAuthError(friendlyAuthError(err.code, "Google sign-in failed"));
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      localStorage.setItem("glass_platform_token", idToken);
      recordLogin(idToken).catch((e) => console.warn("Could not record login:", e.message));
    } catch (caught) {
      const err = caught as { code?: string; message?: string };
      console.error("Email sign-in failed:", err.code, err.message);
      setAuthError(friendlyAuthError(err.code, "Sign-in failed"));
    }
  };

  const registerWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      localStorage.setItem("glass_platform_token", idToken);
      recordLogin(idToken).catch((e) => console.warn("Could not record login:", e.message));
    } catch (caught) {
      const err = caught as { code?: string; message?: string };
      console.error("Email sign-up failed:", err.code, err.message);
      setAuthError(friendlyAuthError(err.code, "Sign-up failed"));
    }
  };

  const loginDevMock = (email: string, name?: string) => {
    const mockUser: User = {
      uid: "usr_" + Math.random().toString(36).substring(2, 9),
      email: email,
      displayName: name || email.split("@")[0],
      plan: "Academic Free Tier",
    };
    const mockToken = "mock_dev_token_" + Date.now();
    setUser(mockUser);
    setToken(mockToken);
    localStorage.setItem("glass_platform_user", JSON.stringify(mockUser));
    localStorage.setItem("glass_platform_token", mockToken);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem("glass_platform_token");
    localStorage.removeItem("glass_platform_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        loginDevMock,
        logout,
        isLoading,
        authError,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
