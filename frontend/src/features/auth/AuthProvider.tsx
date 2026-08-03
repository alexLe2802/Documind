"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import * as authApi from "../../api/auth.api";
import * as profileApi from "../../api/profile.api";
import { clearStoredAuthToken } from "../../lib/auth-token";
import { getFirebaseAuth, getGoogleAuthProvider } from "../../lib/firebase";
import {
  clearPendingGoogleRegistration,
  storePendingGoogleRegistration,
} from "../../lib/google-registration";
import type {
  CurrentUser,
  GoogleLoginResult,
  GoogleRegistrationProfile,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
} from "../../types/auth";
import { AuthContext } from "./auth-context";

const SESSION_RESTORE_TIMEOUT_MS = 8_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [pendingGoogleRegistration, setPendingGoogleRegistration] =
    useState<GoogleRegistrationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasResolvedInitialSession = useRef(false);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const firebaseAuth = getFirebaseAuth();
    clearStoredAuthToken();
    void refreshUser();

    function handleUnauthorized() {
      clearStoredAuthToken();
      setUser(null);
      void signOut(firebaseAuth);
    }

    window.addEventListener("ai-study-hub:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener(
        "ai-study-hub:unauthorized",
        handleUnauthorized,
      );
    };
  }, [refreshUser]);

  const handleLogin = useCallback(async (payload: LoginPayload) => {
    const currentUser = await authApi.login(payload);
    setUser(currentUser);
    setIsLoading(false);
    return currentUser;
  }, []);

  const handleRegister = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
    clearPendingGoogleRegistration();
    setPendingGoogleRegistration(null);
    clearStoredAuthToken();
    setUser(null);
    setIsLoading(false);
  }, []);

  const handleGoogleLogin =
    useCallback(async (): Promise<GoogleLoginResult> => {
      const firebaseAuth = getFirebaseAuth();
      const googleAuthProvider = getGoogleAuthProvider();
      const credential = await signInWithPopup(
        firebaseAuth,
        googleAuthProvider,
      );
      const idToken = await credential.user.getIdToken();
      try {
        const currentUser = await authApi.loginWithFirebaseToken({ idToken });
        await signOut(firebaseAuth);
        clearPendingGoogleRegistration();
        setPendingGoogleRegistration(null);
        setUser(currentUser);
        setIsLoading(false);
        return { status: "authenticated", user: currentUser };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Account registration is required"
        ) {
          clearStoredAuthToken();
          setUser(null);
          setIsLoading(false);
          const profile = {
            fullName: credential.user.displayName ?? "",
            email: credential.user.email ?? "",
            avatarUrl: credential.user.photoURL,
          };
          storePendingGoogleRegistration(profile);
          setPendingGoogleRegistration(profile);
          return {
            status: "registration-required",
            profile,
          };
        }
        await signOut(firebaseAuth);
        throw error;
      }
    }, []);

  const handleLogout = useCallback(async () => {
    clearStoredAuthToken();
    clearPendingGoogleRegistration();
    setPendingGoogleRegistration(null);
    try {
      await authApi.logout();
    } finally {
      await signOut(getFirebaseAuth());
      setUser(null);
    }
  }, []);

  const handleUpdateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      const profile = await profileApi.updateProfile(payload);
      const updatedUser: CurrentUser = {
        ...profile,
        firebaseUid: user?.firebaseUid,
        authProvider: user?.authProvider,
        roleId: user?.roleId,
        lastLogin: user?.lastLogin ?? null,
      };

      setUser(updatedUser);
      return updatedUser;
    },
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      isLoading,
      pendingGoogleRegistration,
      login: handleLogin,
      loginWithGoogle: handleGoogleLogin,
      register: handleRegister,
      logout: handleLogout,
      refreshUser,
      updateProfile: handleUpdateProfile,
    }),
    [
      handleGoogleLogin,
      handleLogin,
      handleLogout,
      handleRegister,
      handleUpdateProfile,
      isLoading,
      pendingGoogleRegistration,
      refreshUser,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
