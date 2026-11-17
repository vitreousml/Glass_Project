"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { getProfile, recordLogin, saveProfile as saveProfileApi, type ProfileDetails, type UserProfile } from "@/lib/api";

export interface User {
  uid: string;
  email: string;
  displayName: string;
  plan: string;
  /** The offline demo login: nothing is sent to or stored on the server. */
  demo?: boolean;
}

type ProfileStatus = "idle" | "loading" | "ready" | "error";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginDemo: () => void;
  logout: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;

  /** The signed-in user's answers to the first-sign-in questions. */
  profile: UserProfile | null;
  profileStatus: ProfileStatus;
  saveProfile: (details: ProfileDetails) => Promise<void>;
  retryProfile: () => void;

  /** True right after a sign-in action (not on a page reload), so the welcome can play once. */
  justSignedIn: boolean;
  ackWelcome: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  loginWithGoogle: async () => {},
  loginDemo: () => {},
  logout: async () => {},
  authError: null,
  clearAuthError: () => {},
  profile: null,
  profileStatus: "idle",
  saveProfile: async () => {},
  retryProfile: () => {},
  justSignedIn: false,
  ackWelcome: () => {},
});

const USER_KEY = "glass_platform_user";
const TOKEN_KEY = "glass_platform_token";
// Demo answers stay in this browser only.
const DEMO_PROFILE_KEY = "glass_platform_demo_profile";

const isDemoToken = (t: string | null) => !!t && t.startsWith("mock_dev_token_");

// Plain-language messages for the Firebase errors people actually hit.
function friendlyAuthError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "auth/network-request-failed":
      return "Couldn't reach Google. Check your connection and try again.";
    case "auth/popup-blocked":
      return "The browser blocked the Google window. Allow pop-ups for this site and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/unauthorized-domain":
      return "Google sign-in isn't enabled for this address yet.";
    default:
      return code ? `${fallback} (${code}).` : `${fallback}.`;
  }
}

function demoProfile(user: User): UserProfile {
  try {
    const saved = localStorage.getItem(DEMO_PROFILE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore unreadable storage
  }
  return { uid: user.uid, email: user.email, profileComplete: false, recorded: false };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [justSignedIn, setJustSignedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setToken(idToken);
          localStorage.setItem(TOKEN_KEY, idToken);
          const appUser: User = {
            uid: fbUser.uid,
            email: fbUser.email || "",
            displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "Researcher",
            plan: "Academic Free Tier",
          };
          setUser(appUser);
          localStorage.setItem(USER_KEY, JSON.stringify(appUser));
        } catch (err) {
          console.error("Error retrieving Firebase token:", err);
        }
      } else {
        // No Google session: restore a saved demo session, if any.
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_KEY);
        if (savedToken && savedUser) {
          try {
            const parsed: User = JSON.parse(savedUser);
            setToken(savedToken);
            setUser({ ...parsed, demo: parsed.demo || isDemoToken(savedToken) });
          } catch {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
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

  // Load the profile whenever someone is signed in, to know whether to ask the questions.
  const uid = user?.uid;
  const demo = !!user?.demo;
  useEffect(() => {
    if (!uid || !user) return;
    let cancelled = false;
    if (demo) {
      Promise.resolve(demoProfile(user)).then((p) => {
        if (cancelled) return;
        setProfile(p);
        setProfileStatus("ready");
      });
      return () => {
        cancelled = true;
      };
    }
    Promise.resolve()
      .then(() => {
        if (!cancelled) setProfileStatus("loading");
        return getProfile(token);
      })
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setProfileStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Could not load profile:", err);
        setProfileStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // Re-run per account and on retry, not on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, demo, profileAttempt]);

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      localStorage.setItem(TOKEN_KEY, idToken);
      setJustSignedIn(true);
      // Save this person's name and email. Never block sign-in if it fails.
      recordLogin(idToken).catch((e) => console.warn("Could not record login:", e.message));
    } catch (caught) {
      const err = caught as { code?: string; message?: string };
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
      console.error("Google sign-in failed:", err.code, err.message);
      setAuthError(friendlyAuthError(err.code, "Google sign-in failed"));
    }
  };

  const loginDemo = () => {
    setAuthError(null);
    const demoUser: User = {
      uid: "usr_" + Math.random().toString(36).substring(2, 9),
      email: "demo.scientist@glasslab.edu",
      displayName: "Demo researcher",
      plan: "Demo (not saved)",
      demo: true,
    };
    const demoToken = "mock_dev_token_" + Date.now();
    setJustSignedIn(true);
    setUser(demoUser);
    setToken(demoToken);
    localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
    localStorage.setItem(TOKEN_KEY, demoToken);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
    setUser(null);
    setToken(null);
    setProfile(null);
    setProfileStatus("idle");
    setJustSignedIn(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(DEMO_PROFILE_KEY);
  };

  const saveProfile = useCallback(
    async (details: ProfileDetails) => {
      if (!user) return;
      if (user.demo) {
        // Demo: keep the answers in this browser only, never on the server.
        const local: UserProfile = {
          uid: user.uid,
          email: user.email,
          university: details.university.trim(),
          position: details.position,
          positionOther: details.position === "other" ? details.position_other?.trim() : undefined,
          course: details.position === "student" ? details.course?.trim() : undefined,
          profileComplete: true,
          recorded: false,
        };
        try {
          localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(local));
        } catch {
          // storage blocked: fine for a demo
        }
        setProfile(local);
        return;
      }
      // Throws with the server's message; the form shows it.
      const saved = await saveProfileApi(details, token);
      setProfile(saved);
    },
    [user, token],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        loginWithGoogle,
        loginDemo,
        logout,
        authError,
        clearAuthError: () => setAuthError(null),
        profile,
        profileStatus,
        saveProfile,
        retryProfile: () => setProfileAttempt((n) => n + 1),
        justSignedIn,
        ackWelcome: () => setJustSignedIn(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
