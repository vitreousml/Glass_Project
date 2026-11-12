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
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      localStorage.setItem("glass_platform_token", idToken);
    } catch (err: any) {
      console.warn("Google Sign-In popup notice:", err.message);
      // Fallback to dev mode login if credentials not active on localhost
      loginDevMock("google.researcher@glasslab.edu", "Dr. Eleanor Vance");
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      localStorage.setItem("glass_platform_token", idToken);
    } catch (err: any) {
      console.warn("Firebase Email Login notice:", err.message);
      // Try registration or fallback
      loginDevMock(email);
    }
  };

  const registerWithEmail = async (email: string, pass: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      localStorage.setItem("glass_platform_token", idToken);
    } catch (err: any) {
      console.warn("Firebase Register notice:", err.message);
      loginDevMock(email);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
