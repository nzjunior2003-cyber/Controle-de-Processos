/**
 * Google Sign-In usado APENAS para obter um access token do Google Drive
 * (anexar arquivos a contratos/execuções). É independente da autenticação
 * por e-mail/senha do sistema: roda numa instância secundária do Firebase
 * ("drive"), de forma que abrir o popup do Google não derruba a sessão do
 * usuário logado no sistema.
 */
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, requireFirebaseAuth } from './firebase';

const DRIVE_APP = 'drive';

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
) => {
  const auth = getFirebaseAuth(DRIVE_APP);
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => undefined;
  }

  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const auth = requireFirebaseAuth(DRIVE_APP);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o access token do Google.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  const auth = getFirebaseAuth(DRIVE_APP);
  if (auth) await auth.signOut();
  cachedAccessToken = null;
};
