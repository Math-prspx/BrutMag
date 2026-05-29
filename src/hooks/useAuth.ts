// Hook pour gérer l'authentification utilisateur

import { useState, useEffect } from 'react';
import type { Feed } from '../types';
import {
  loginUser,
  registerUser,
  loadFeedsFromAccount,
  pushFeedsToAccount,
} from '../utils/api';
import {
  saveAccountSession,
  loadAccountSession,
  clearAccountSession as clearAccountSessionStorage,
} from '../utils/storage';

export type AccountMode = 'local' | 'signed-in' | 'syncing';

export function useAuth() {
  const [accountToken, setAccountToken] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountMode, setAccountMode] = useState<AccountMode>('local');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);

  // Charger la session au démarrage
  useEffect(() => {
    loadAccountSession()
      .then((session) => {
        if (session) {
          setAccountToken(session.token);
          setAccountEmail(session.email);
          setAccountMode('signed-in');
        }
      })
      .catch(() => {
        // Ignorer les erreurs de chargement
      });
  }, []);

  /**
   * Connexion ou création de compte
   */
  const submitAccount = async (
    mode: 'login' | 'register',
    email: string,
    password: string,
    onSuccess?: (token: string, feeds: Feed[]) => void
  ) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setAccountMessage('Email et mot de passe requis.');
      return;
    }

    setAccountBusy(true);
    setAccountMode('syncing');
    setAccountMessage(mode === 'login' ? 'Connexion en cours...' : 'Création du compte en cours...');

    try {
      const authFn = mode === 'login' ? loginUser : registerUser;
      const payload = await authFn(trimmedEmail, trimmedPassword);

      // Sauvegarder la session
      await saveAccountSession(payload.token, payload.user.email);
      setAccountToken(payload.token);
      setAccountEmail(payload.user.email);

      setAccountMode('signed-in');
      setAccountMessage(`Compte synchronisé: ${payload.user.email}`);

      // Callback avec les feeds
      if (onSuccess) {
        onSuccess(payload.token, payload.feeds || []);
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'SYNC_FAILED';
      if (mode === 'register' && code === 'ACCOUNT_EXISTS') {
        setAccountMessage('Ce compte existe déjà. Utilise Connexion.');
      } else if (mode === 'login' && code === 'INVALID_CREDENTIALS') {
        setAccountMessage('Identifiants invalides.');
      } else {
        setAccountMessage('Connexion au serveur de synchronisation impossible.');
      }
      setAccountMode('local');
    } finally {
      setAccountBusy(false);
    }
  };

  /**
   * Déconnexion
   */
  const logoutAccount = async () => {
    await clearAccountSessionStorage();
    setAccountToken('');
    setAccountEmail('');
    setAccountBusy(false);
    setAccountMode('local');
    setAccountMessage('Compte déconnecté.');
  };

  /**
   * Synchroniser les feeds avec le serveur
   */
  const syncFeedsWithAccount = async (feeds: Feed[]): Promise<Feed[]> => {
    if (!accountToken) {
      return feeds;
    }

    try {
      const synced = await pushFeedsToAccount(feeds, accountToken);
      setAccountMessage(`Flux synchronisés avec ${accountEmail}.`);
      return synced;
    } catch {
      setAccountMessage('Sauvegarde locale faite, mais la synchro du compte a échoué.');
      return feeds;
    }
  };

  /**
   * Charger les feeds depuis le compte
   */
  const loadFeedsFromAccountIfSignedIn = async (): Promise<Feed[]> => {
    if (!accountToken) {
      return [];
    }

    try {
      return await loadFeedsFromAccount(accountToken);
    } catch {
      return [];
    }
  };

  return {
    accountToken,
    accountEmail,
    accountMode,
    accountMessage,
    accountBusy,
    submitAccount,
    logoutAccount,
    syncFeedsWithAccount,
    loadFeedsFromAccountIfSignedIn,
    setAccountMessage,
  };
}
