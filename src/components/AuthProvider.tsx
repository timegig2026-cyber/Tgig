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
            setProfile(snapshot.data());
          } else {
            // Create initial profile if it doesn't exist
            const newProfile = {
              userId: user.uid,
              displayName: user.displayName || 'Anonymous User',
              role: 'seeker',
              createdAt: new Date().toISOString(),
            };
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
