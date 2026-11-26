import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken as getAppCheckToken,
  type AppCheck,
} from 'firebase/app-check';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Enable App Check debug token on localhost / dev builds (accepted by #BuildHybridAI 2026 rules)
if (
  typeof window !== 'undefined' &&
  (import.meta.env.DEV ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1')
) {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    true;
}

export const appCheck: AppCheck | null =
  typeof window !== 'undefined'
    ? initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(
          import.meta.env.VITE_RECAPTCHA_SITE_KEY ||
            '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
        ),
        isTokenAutoRefreshEnabled: true,
      })
    : null;

export async function getAppCheckHeader(): Promise<Record<string, string>> {
  if (!appCheck) return {};
  try {
    const { token } = await getAppCheckToken(appCheck, false);
    return token ? { 'X-Firebase-AppCheck': token } : {};
  } catch {
    return {};
  }
}

export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(firebaseApp);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string,
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const trimmedName = fullName.trim();
  if (trimmedName) {
    await updateProfile(credential.user, { displayName: trimmedName });
  }
  await sendEmailVerification(credential.user).catch(() => {
    // Verification email delivery may be throttled in local preview
  });
  return credential.user;
}

export async function signInAsGuest(): Promise<User> {
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function mapFirebaseAuthError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to Sign In instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid work or personal email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment before trying again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completion.';
    case 'auth/operation-not-allowed':
      return 'This sign-in provider is not yet enabled in the Firebase Console (Authentication > Sign-in method).';
    default:
      return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}