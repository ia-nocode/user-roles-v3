import { getAuth, Auth } from 'firebase/auth';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import { app } from '../lib/firebase';

// Main auth instance for admin session
const adminAuth = getAuth(app);

// Secondary app instance for user management
let secondaryApp: FirebaseApp | null = null;
let userManagementAuth: Auth | null = null;

export function getAdminAuth(): Auth {
  return adminAuth;
}

export function getUserManagementAuth(): Auth {
  if (!userManagementAuth) {
    try {
      // Initialize a secondary Firebase app instance
      secondaryApp = initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      }, 'userManagement');

      userManagementAuth = getAuth(secondaryApp);
    } catch (error) {
      console.error('Error initializing user management auth:', error);
      throw error;
    }
  }
  return userManagementAuth;
}

export function cleanupUserManagementAuth(): void {
  if (secondaryApp) {
    try {
      deleteApp(secondaryApp);
    } catch (error) {
      console.error('Error cleaning up secondary app:', error);
    } finally {
      secondaryApp = null;
      userManagementAuth = null;
    }
  }
}