import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { auth, onAuthStateChanged, User, doc, getDoc, setDoc, updateDoc, db, serverTimestamp, handleFirestoreError, OperationType, onSnapshot } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let heartbeatInterval: any = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (newUser) => {
      setUser(newUser);
      userRef.current = newUser;
      
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      if (newUser) {
        const profileRef = doc(db, 'users', newUser.uid);
        
        // Update online status
        const updateOnlineStatus = async (status: boolean) => {
          try {
            await updateDoc(profileRef, { 
              isOnline: status,
              lastActive: new Date().toISOString()
            });
          } catch (e) {
            console.warn("Could not update online status", e);
          }
        };

        updateOnlineStatus(true);

        // Heartbeat to keep online status fresh
        heartbeatInterval = setInterval(() => {
          updateOnlineStatus(true);
        }, 60000); // every minute

        // Use onSnapshot for real-time profile updates
        profileUnsubscribe = onSnapshot(profileRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            
            // Ensure main admin always has admin rights
            if (newUser.email === 'timegig2026@gmail.com' && !data.isAdmin) {
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
            if (tenantRef && tenantRef !== newUser.uid && !data.tenantId && !data.isTenantApproved && !data.isAdmin) {
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
            
            const isAdmin = newUser.email === 'timegig2026@gmail.com';
            const newProfile: any = {
              userId: newUser.uid,
              displayName: newUser.displayName || 'Anonymous User',
              role: isAdmin ? 'admin' : 'seeker',
              isAdmin: isAdmin,
              createdAt: now.toISOString(),
              trialExpiresAt: trialExpiresAt,
              hasSeenTour: false,
              lastViewedSeekers: now.toISOString(),
              lastViewedGigs: now.toISOString(),
              notifications: []
            };
            if (tenantRef && tenantRef !== newUser.uid) {
              newProfile.tenantId = tenantRef;
              newProfile.tenantApproved = false;
              newProfile.userSubscriptionActive = false;
            }
            try {
              await setDoc(profileRef, newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `users/${newUser.uid}`);
            }
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${newUser.uid}`);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      
      // Attempt to set offline status on unmount if we have a user
      if (userRef.current) {
        const profileRef = doc(db, 'users', userRef.current.uid);
        updateDoc(profileRef, { isOnline: false }).catch(() => {});
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
