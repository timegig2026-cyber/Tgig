import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, onAuthStateChanged, User, doc, getDoc, setDoc, db, serverTimestamp, handleFirestoreError, OperationType, onSnapshot } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (user) {
        const profileRef = doc(db, 'users', user.uid);
        
        // Use onSnapshot for real-time profile updates
        profileUnsubscribe = onSnapshot(profileRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            
            // Ensure main admin always has admin rights
            if (user.email === 'timegig2026@gmail.com' && !data.isAdmin) {
              import('../lib/firebase').then(async ({ updateDoc }) => {
                try {
                  await updateDoc(profileRef, { 
                    isAdmin: true,
                    role: 'admin',
                    updatedAt: new Date().toISOString()
                  });
                } catch (e) {
                  console.warn("Could not auto-promote main admin", e);
                }
              });
            }

            setProfile(data);

            // Auto-disable tenant if subscription failed/expired
            if (data.isTenantApproved && data.subscriptionExpiresAt && !data.isTenantDisabled) {
              const expires = new Date(data.subscriptionExpiresAt);
              if (expires < new Date()) {
                import('../lib/firebase').then(async ({ updateDoc }) => {
                  try {
                    await updateDoc(profileRef, { 
                      isTenantDisabled: true,
                      subscriptionActive: false,
                      updatedAt: new Date().toISOString()
                    });
                  } catch (e) {
                    console.warn("Could not auto-disable expired tenant", e);
                  }
                });
              }
            }

            const tenantRef = typeof window !== 'undefined' ? (localStorage.getItem('tenant_ref') || '') : '';
            if (tenantRef && tenantRef !== user.uid && !data.tenantId && !data.isTenantApproved && !data.isAdmin) {
              import('../lib/firebase').then(async ({ updateDoc }) => {
                try {
                  await updateDoc(profileRef, {
                    tenantId: tenantRef,
                    tenantApproved: false,
                    userSubscriptionActive: false,
                    updatedAt: new Date().toISOString()
                  });
                } catch (e) {
                  console.warn("Could not associate existing user with tenant link", e);
                }
              });
            }
          } else {
            // Create initial profile if it doesn't exist
            const tenantRef = typeof window !== 'undefined' ? (localStorage.getItem('tenant_ref') || '') : '';
            const now = new Date();
            const trialExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
            
            const isAdmin = user.email === 'timegig2026@gmail.com';
            const newProfile: any = {
              userId: user.uid,
              displayName: user.displayName || 'Anonymous User',
              role: isAdmin ? 'admin' : 'seeker',
              isAdmin: isAdmin,
              createdAt: now.toISOString(),
              trialExpiresAt: trialExpiresAt,
              lastViewedSeekers: now.toISOString(),
              lastViewedGigs: now.toISOString(),
              notifications: []
            };
            if (tenantRef && tenantRef !== user.uid) {
              newProfile.tenantId = tenantRef;
              newProfile.tenantApproved = false;
              newProfile.userSubscriptionActive = false;
            }
            try {
              await setDoc(profileRef, newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
            }
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
