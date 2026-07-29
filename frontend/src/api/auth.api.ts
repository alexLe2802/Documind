import { FirebaseError } from "firebase/app";
import {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  signInWithEmailAndPassword,
  updateProfile,
  verifyPasswordResetCode,
} from "firebase/auth";
import { apiRequest } from "../lib/http";
import { getFirebaseAuth } from "../lib/firebase";
import { ROUTES } from "../lib/routes";
import type {
  CurrentUser,
  GoogleLoginPayload,
  LoginPayload,
  RegisterPayload,
} from "../types/auth";

type AuthLoginResponse = {
  user: CurrentUser;
  role: CurrentUser["role"];
  permissions: string[];
  isNewUser: boolean;
};

type AuthMeResponse = Omit<AuthLoginResponse, "isNewUser">;

export async function register(payload: RegisterPayload) {
  const firebaseAuth = getFirebaseAuth();
  const currentUser = firebaseAuth.currentUser;
  const isGoogleRegistration = currentUser?.providerData.some(
    (provider) => provider.providerId === "google.com",
  );
  const hasPasswordProvider = currentUser?.providerData.some(
    (provider) => provider.providerId === "password",
  );
  const credential =
    isGoogleRegistration && currentUser && !hasPasswordProvider
      ? await linkWithCredential(
          currentUser,
          EmailAuthProvider.credential(payload.email, payload.password),
        )
      : isGoogleRegistration && currentUser
        ? { user: currentUser }
        : await createUserWithEmailAndPassword(
            firebaseAuth,
            payload.email,
            payload.password,
          );

  await updateProfile(credential.user, { displayName: payload.fullName });
  const idToken = await credential.user.getIdToken(true);

  await apiRequest<AuthLoginResponse>("/auth/register", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: {
      fullName: payload.fullName,
      acceptedTerms: payload.acceptedTerms,
    },
  });

  await sendEmailVerification(credential.user, {
    // Firebase's hosted handler consumes the code before redirecting here.
    url: `${window.location.origin}${ROUTES.verifyEmail}?verified=true`,
    handleCodeInApp: false,
  });
  await signOut(firebaseAuth);
}

export async function login(payload: LoginPayload) {
  try {
    const firebaseAuth = getFirebaseAuth();
    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      payload.email,
      payload.password,
    );
    // Reload user from Firebase server to get latest emailVerified state (not cached)
    await credential.user.reload();
    const refreshedUser = firebaseAuth.currentUser;
    if (!refreshedUser?.emailVerified) {
      await signOut(firebaseAuth);
      throw new Error("Vui lòng xác thực email trước khi đăng nhập.");
    }
    // Get fresh token after reload to ensure it reflects current emailVerified
    const idToken = await refreshedUser.getIdToken(true);

    return loginWithFirebaseToken({ idToken });
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

export function loginWithFirebaseToken(payload: GoogleLoginPayload) {
  return apiRequest<AuthLoginResponse>("/auth/firebase-login", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.idToken}`,
    },
  }).then((response) => response.user);
}

export function getCurrentUser() {
  return apiRequest<AuthMeResponse>("/auth/me").then(
    (response) => response.user,
  );
}

export function forgotPassword(email: string) {
  return sendPasswordResetEmail(getFirebaseAuth(), email, {
    url: `${window.location.origin}${ROUTES.login}?reset=success`,
  });
}

export function verifyEmailActionCode(code: string) {
  return applyActionCode(getFirebaseAuth(), code);
}

export function verifyResetPasswordCode(token: string) {
  return verifyPasswordResetCode(getFirebaseAuth(), token);
}

export function resetPassword(token: string, password: string) {
  return confirmPasswordReset(getFirebaseAuth(), token, password);
}

function normalizeAuthError(error: unknown): Error {
  if (
    error instanceof FirebaseError &&
    [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
    ].includes(error.code)
  ) {
    return new Error("Thông tin tài khoản không hợp lệ");
  }

  return error instanceof Error ? error : new Error("Authentication failed");
}
