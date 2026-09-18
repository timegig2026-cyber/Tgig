import { useAuth } from './AuthProvider';
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, db, doc, updateDoc, setDoc, getDoc, collection, query, where, onSnapshot, handleFirestoreError, OperationType } from '../lib/firebase';
import { User as UserIcon, LogOut, LogIn, Share2, Check, Mail, Lock, UserPlus, Camera, Loader2, Edit3, MapPin, ShieldCheck, TrendingUp, CreditCard, Upload, CheckCircle2, Clock, AlertCircle, Building2, Download, Briefcase } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import ProfileEdit from './ProfileEdit';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TenantPortalView from './TenantPortalView';
import AdminView from './AdminView';
import { PWAInstallButton } from './PWAControls';
import { speak } from '../lib/voice';

// Fix for default marker icon issue in Leaflet with bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export default function ProfileView() {
  const { user, profile, loading } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTenantPortal, setShowTenantPortal] = useState(false);
  const [tenantPortalTab, setTenantPortalTab] = useState<'overview' | 'pop' | 'users' | 'subscription'>('overview');
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  
  // Business Registration States
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessDocName, setBusinessDocName] = useState('CIPC Certificate');
  const [businessDesc, setBusinessDesc] = useState('');
  const [uploadingBusinessDoc, setUploadingBusinessDoc] = useState(false);
  const [businessSuccess, setBusinessSuccess] = useState(false);
  const [businessesList, setBusinessesList] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tenantPayments, setTenantPayments] = useState<any[]>([]);
  const [uploadingTenantPop, setUploadingTenantPop] = useState(false);
  const [tenantPopSuccess, setTenantPopSuccess] = useState(false);
  const tenantPopInputRef = useRef<HTMLInputElement>(null);
  const [hostTenant, setHostTenant] = useState<{ 
    displayName?: string; 
    monthlySubscriptionFee?: number; 
    isTenantDisabled?: boolean;
    bankDetails?: {
      bankName: string;
      accountHolder: string;
      accountNumber: string;
      accountType: string;
      branchCode?: string;
    }
  } | null>(null);
  const [activeGigs, setActiveGigs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'gigApplications'),
      where('applicantId', '==', user.uid),
      where('status', 'in', ['accepted', 'arrived'])
    );
    const unsub = onSnapshot(q, async (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Fetch gig details for each active application
      const gigsWithDetails = await Promise.all(apps.map(async (app: any) => {
        const gigDoc = await getDoc(doc(db, 'gigs', app.gigId));
        return { ...app, gig: gigDoc.exists() ? { id: gigDoc.id, ...gigDoc.data() } : null };
      }));
      setActiveGigs(gigsWithDetails.filter(g => g.gig !== null));
    }, (err) => {
      console.warn("Could not listen to active seeker gigs", err);
    });
    return () => unsub();
  }, [user]);

  const handleNavigateToGig = (gig: any) => {
    if (!gig.location) return;
    
    speak("Navigation started. Please follow the map to reach the GiG destination.");

    navigator.geolocation.getCurrentPosition((position) => {
      const originLat = position.coords.latitude;
      const originLng = position.coords.longitude;
      const destLat = gig.location.lat;
      const destLng = gig.location.lng;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const url = isIOS 
        ? `http://maps.apple.com/?saddr=${originLat},${originLng}&daddr=${destLat},${destLng}`
        : `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
      window.open(url, '_blank');
    });
  };

  const handleArrival = async (appId: string, gigOwnerId: string, gigTitle: string, applicantName: string) => {
    try {
      await updateDoc(doc(db, 'gigApplications', appId), {
        status: 'arrived',
        updatedAt: new Date().toISOString()
      });

      speak("You have arrived at your destination. We have notified the GiG owner of your arrival.");

      // Notify owner
      const notifRef = doc(collection(db, 'users', gigOwnerId, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        title: 'Seeker Arrived!',
        message: `${applicantName} has arrived at your GiG: ${gigTitle}`,
        type: 'gig',
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to mark arrival", error);
    }
  };

  useEffect(() => {
    if (!profile?.tenantId) {
      setHostTenant(null);
      return;
    }
    const unsubHost = onSnapshot(doc(db, 'users', profile.tenantId), (docSnap) => {
      if (docSnap.exists()) {
        setHostTenant(docSnap.data() as any);
      }
    }, (err) => {
      console.warn("Could not load host tenant profile", err);
    });
    return () => unsubHost();
  }, [profile?.tenantId]);

  const hostTenantFee = hostTenant?.monthlySubscriptionFee !== undefined ? Number(hostTenant.monthlySubscriptionFee) : 99.00;

  useEffect(() => {
    if (!user || !profile?.tenantId) return;
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', user.uid),
      where('tenantId', '==', profile.tenantId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        paymentId: doc.id,
        ...doc.data()
      }));
      setTenantPayments(list);
    }, (err) => {
      console.warn("Could not listen to tenant payments", err);
    });
    return () => unsub();
  }, [user, profile?.tenantId]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'businesses'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        businessId: doc.id,
        ...doc.data()
      }));
      setBusinessesList(list);
    }, (err) => {
      console.warn("Could not listen to businesses list", err);
    });
    return () => unsub();
  }, [user]);

  const handleUploadBusinessDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile?.tenantId) return;

    if (!businessName.trim()) {
      setError("Please fill out Business Name before uploading document.");
      return;
    }

    setUploadingBusinessDoc(true);
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > height && width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        } else if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64String = canvas.toDataURL('image/jpeg', 0.7);

        try {
          const businessId = `biz_${Date.now()}`;
          const { setDoc } = await import('../lib/firebase');
          
          await setDoc(doc(db, 'businesses', businessId), {
            businessId,
            tenantId: profile.tenantId,
            ownerId: user.uid,
            ownerName: profile.displayName || 'Anonymous',
            name: businessName,
            email: businessEmail || user.email || '',
            description: businessDesc,
            documentName: businessDocName,
            proofImage: base64String,
            status: 'pending',
            createdAt: new Date().toISOString()
          });

          setBusinessSuccess(true);
          setBusinessName('');
          setBusinessEmail('');
          setBusinessDesc('');
          setTimeout(() => setBusinessSuccess(false), 8000);
        } catch (err: any) {
          console.error("Error submitting business document", err);
          setError(`Business Submission Failed: ${err.message}`);
        } finally {
          setUploadingBusinessDoc(false);
        }
      };
      img.onerror = () => {
        setError("Failed to process image file");
        setUploadingBusinessDoc(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setUploadingBusinessDoc(false);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadTenantPop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile?.tenantId) return;

    setUploadingTenantPop(true);
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > height && width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        } else if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const base64String = canvas.toDataURL('image/jpeg', 0.7);

        try {
          const paymentId = `pay_${Date.now()}`;
          await setDoc(doc(db, 'payments', paymentId), {
            paymentId,
            userId: user.uid,
            tenantId: profile.tenantId,
            userDisplayName: profile.displayName || user.displayName || 'Member',
            userPhotoURL: profile.photoURL || '',
            proofImage: base64String,
            amount: hostTenantFee,
            status: 'pending',
            createdAt: new Date().toISOString()
          });

          setTenantPopSuccess(true);
          setTimeout(() => setTenantPopSuccess(false), 7000);
        } catch (err: any) {
          console.error("Error submitting PoP to tenant", err);
          setError(`Proof of payment submission failed: ${err.message}`);
        } finally {
          setUploadingTenantPop(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setError(`Failed to read proof file`);
      setUploadingTenantPop(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSignUp && !acceptTerms) {
      setError('You must accept the terms and conditions to sign up.');
      return;
    }

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        // Profile creation is handled in AuthProvider's onAuthStateChanged
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      const fullErrorDetails = `Auth Error Code: ${err.code || 'UNKNOWN'}\nMessage: ${err.message || String(err)}`;
      setError(fullErrorDetails);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 300;

          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL('image/jpeg', 0.5);

          // Update only Firestore (redundant updateProfile removed as it is slow with base64)
          const profileRef = doc(db, 'users', user.uid);
          try {
            await updateDoc(profileRef, { photoURL: base64 });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
          } catch (err: any) {
            setError(err.message || 'Failed to update database');
            handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
          }
          
          setUploading(false);
        };
        img.onerror = () => {
          setError('Failed to process image');
          setUploading(false);
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError('Failed to upload image');
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'GiGs',
      text: 'Join me on GiGs - find opportunities and connect in South Africa!',
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error("Error sharing", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.origin);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("Clipboard failed", error);
      }
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  if (showTenantPortal) return <TenantPortalView onClose={() => setShowTenantPortal(false)} initialTab={tenantPortalTab} />;
  if (showAdminPortal) return <AdminView onClose={() => setShowAdminPortal(false)} />;

  if (isEditing) return <ProfileEdit onClose={() => setIsEditing(false)} />;

  if (!user) {
    return (
      <div className="flex-1 flex flex-col p-8 bg-white overflow-y-auto pb-20">
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
            <UserIcon className="w-8 h-8 text-gray-300" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-gray-500 font-medium italic">
              {isSignUp ? 'Join the GiGs community today' : 'Sign in to continue your journey'}
            </p>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-xs font-mono font-bold rounded-2xl border-2 border-red-200 whitespace-pre-wrap leading-relaxed shadow-sm">
              {error}
            </div>
          )}

          {isSignUp && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Display Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-gray-50 border-none rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-gray-50 border-none rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-50 border-none rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                required
              />
            </div>
          </div>

          {isSignUp && (
            <div className="flex items-start space-x-3 py-2">
              <input
                type="checkbox"
                id="terms"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <label htmlFor="terms" className="text-xs text-gray-500 font-medium leading-relaxed">
                I accept the <span className="text-gray-900 font-bold border-b border-gray-900">Terms and Conditions</span> and <span className="text-gray-900 font-bold border-b border-gray-900">Privacy Policy</span>.
              </label>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gray-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
          >
            {isSignUp ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-8 overflow-y-auto pb-20">
      <div className="flex justify-center">
        <PWAInstallButton />
      </div>

      {(!profile?.photoURL || profile.photoURL.trim() === '') && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-5 flex items-center space-x-4 shadow-sm animate-pulse">
          <div className="w-10 h-10 bg-amber-500 text-white rounded-2xl flex items-center justify-center font-black flex-shrink-0">
            !
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest">Profile Inactive</h4>
            <p className="text-[11px] text-amber-700 font-medium">Please upload your face picture using the camera button below to activate your profile and appear in search results.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center border-4 border-white shadow-sm overflow-hidden">
              {profile?.photoURL ? (
                <img key={profile.photoURL} src={profile.photoURL} alt={profile.displayName || ''} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-10 h-10 text-gray-300" />
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 bg-gray-900 text-white p-1.5 rounded-lg shadow-lg hover:scale-110 transition-transform"
              disabled={uploading}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] py-1 px-2 rounded font-black whitespace-nowrap uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              Face Picture Only
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">{profile?.displayName || 'User'}</h2>
              {profile?.isTenantApproved && (
                <ShieldCheck className="w-5 h-5 text-green-500 fill-green-50" />
              )}
            </div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
              {profile?.isTenantApproved ? 'Tenant Portal' : profile?.role}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsEditing(true)}
            className="p-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Edit Profile"
          >
            <Edit3 className="w-5 h-5" />
          </button>
          <button 
            onClick={handleShare}
            className="p-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors relative"
            aria-label="Share App"
          >
            {copied ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
            {copied && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded font-bold whitespace-nowrap">
                Link Copied!
              </span>
            )}
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-xl border border-green-100 flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>Profile picture updated successfully!</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {/* Active GiGs Section for Seekers */}
      {activeGigs.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border-2 border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Briefcase className="w-5 h-5 text-emerald-600" />
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Active GiG Navigation</h3>
          </div>
          <div className="space-y-3">
            {activeGigs.map((active) => (
              <div key={active.id} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-black text-gray-900">{active.gig?.title || 'Unknown GiG'}</h4>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status: {active.status}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                    active.status === 'accepted' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {active.status}
                  </span>
                </div>

                {active.status === 'accepted' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleNavigateToGig(active.gig)}
                      className="bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-1"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Navigate</span>
                    </button>
                    <button 
                      onClick={() => handleArrival(active.id, active.gigOwnerId, active.gig?.title || 'GiG', profile?.displayName || 'Seeker')}
                      className="bg-gray-900 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Arrived</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">You have arrived at this GiG</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Address & Location Details */}
      <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Address & Location</h3>
        <div className="space-y-3 text-xs">
          {profile?.streetAddress && (
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-400 uppercase tracking-wider">Street Address</span>
              <span className="font-bold text-gray-900">{profile.streetAddress}</span>
            </div>
          )}
          {profile?.city && (
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-400 uppercase tracking-wider">Location / City</span>
              <span className="font-bold text-gray-900">{profile.city}</span>
            </div>
          )}
          {profile?.province && (
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-400 uppercase tracking-wider">Province</span>
              <span className="font-bold text-gray-900">{profile.province}</span>
            </div>
          )}
          {!profile?.streetAddress && !profile?.city && !profile?.province && (
            <p className="text-gray-400 italic">No address details provided yet.</p>
          )}
        </div>
      </div>

      {/* User Location Map (Optional) */}
      {profile?.location && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Map Pin Point</h3>
          </div>
          <div className="h-40 w-full rounded-2xl overflow-hidden border-4 border-gray-50 shadow-sm relative z-0">
            <MapContainer 
              center={[profile.location.lat || -30.5595, profile.location.lng || 22.9375]} 
              zoom={13} 
              className="h-full w-full"
              zoomControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[profile.location.lat || -30.5595, profile.location.lng || 22.9375]} />
            </MapContainer>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Account Overview</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Email</span>
            <span className="text-sm font-bold text-gray-900">{user.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Status</span>
            <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${
              profile?.isTenantDisabled ? 'bg-red-100 text-red-700' :
              profile?.isTenantApproved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {profile?.isTenantDisabled ? 'Disabled by Admin' : profile?.isTenantApproved ? 'Verified Tenant' : 'Active'}
            </span>
          </div>

          {/* Tenant Feature */}
          <div className="pt-4 border-t border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Tenant Program</span>
              </div>
              <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${
                profile?.isTenantDisabled ? 'bg-red-100 text-red-600' :
                profile?.isTenantApproved ? 'bg-green-100 text-green-600' : 
                profile?.isTenantRequest ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {profile?.isTenantDisabled ? 'Disabled by Admin' : profile?.isTenantApproved ? 'Approved' : profile?.isTenantRequest ? 'Pending' : 'Off'}
              </div>
            </div>
            
            <p className="text-[10px] text-gray-500 font-medium leading-relaxed italic">
              {profile?.isTenantDisabled
                ? 'Your tenant account is disabled by administration. Features and earnings are paused.'
                : profile?.isTenantApproved 
                ? 'Your tenant account is active. Access your portal to manage services and payments.' 
                : 'Limited Opportunity! Only 1,000 spots available to become a Tenant. Earn passive income by managing your own network of seekers.'}
            </p>

            {!profile?.isTenantApproved && !profile?.isTenantRequest && !profile?.isTenantDisabled && (
              <div className="bg-indigo-50 border-2 border-indigo-100 p-4 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2 text-indigo-700 font-black">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="uppercase tracking-widest text-[10px]">Exclusive Tenant Offer</span>
                </div>
                <div className="flex justify-between items-center">
                   <p className="text-xl font-black text-indigo-900 uppercase">1000 Spots</p>
                   <span className="text-[9px] font-black bg-indigo-200 text-indigo-800 px-2 py-1 rounded-lg uppercase tracking-widest animate-pulse">Limited</span>
                </div>
                <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                  Become a tenant and unlock the power to manage your own community. Only 1000 slots are available on the platform.
                </p>
                <button
                  onClick={async () => {
                    if (!user) return;
                    try {
                      await updateDoc(doc(db, 'users', user.uid), {
                        isTenantRequest: true,
                        updatedAt: new Date().toISOString()
                      });
                      speak("Tenant request submitted. Our admin will review your application shortly. Remember, there are only 1000 spots available.");
                    } catch (e) {
                      console.error("Error requesting tenant", e);
                    }
                  }}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Request Tenant Access
                </button>
              </div>
            )}

            {profile?.isTenantRequest && !profile?.isTenantApproved && (
              <div className="bg-orange-50 border-2 border-orange-100 p-4 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-orange-700 font-black">
                  <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                  <span className="uppercase tracking-widest text-[10px]">Request Pending</span>
                </div>
                <p className="text-[10px] text-orange-700 leading-relaxed font-medium">
                  Your request to become a tenant is being reviewed. We will notify you once you're approved. 1000 spots total capacity.
                </p>
              </div>
            )}

            {profile?.isTenantDisabled && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center space-x-2 text-red-700 font-black">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="uppercase tracking-widest text-[10px]">Tenant Account Disabled</span>
                </div>
                <p className="text-[11px] text-red-700 leading-relaxed font-medium">
                  Your tenant account has been disabled immediately. Features and referral link onboarding are currently paused. Please pay your Admin Subscription fee to restore access.
                </p>
                <button
                  onClick={() => {
                    setTenantPortalTab('subscription');
                    setShowTenantPortal(true);
                  }}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-200"
                >
                  Go to Payment Feature
                </button>
              </div>
            )}

            {profile?.isTenantApproved && !profile?.subscriptionActive && !profile?.isTenantDisabled && (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl space-y-3"
              >
                <div className="flex items-center space-x-2 text-red-600">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Subscription Expired</span>
                </div>
                <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest leading-relaxed">
                  Tenant features & branding are locked. Standard Seekers/Gigs features remain active. Renew to restore your portal and earnings.
                </p>
                <button
                  onClick={() => {
                    setTenantPortalTab('subscription');
                    setShowTenantPortal(true);
                  }}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-200"
                >
                  Pay Subscription Fee
                </button>
              </motion.div>
            )}

            <button
              onClick={() => {
                if (profile?.isTenantApproved && !profile?.isTenantDisabled) {
                  setTenantPortalTab('overview');
                  setShowTenantPortal(true);
                }
              }}
              disabled={!profile?.isTenantApproved || profile?.isTenantDisabled}
              className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center space-x-2 border shadow-sm ${
                profile?.isTenantDisabled
                  ? 'bg-red-50 text-red-500 border-red-200 cursor-not-allowed'
                  : profile?.isTenantApproved 
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 active:scale-95' 
                  : 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed opacity-60'
              }`}
            >
              {profile?.isTenantDisabled ? (
                <>
                  <Lock className="w-3 h-3" />
                  <span>Tenant Disabled by Admin</span>
                </>
              ) : !profile?.isTenantApproved ? (
                <>
                  <Lock className="w-3 h-3" />
                  <span>Tenant Portal Locked</span>
                </>
              ) : (
                <span>Open Tenant Portal</span>
              )}
            </button>

            {profile?.isTenantApproved && (
              <div className="bg-white p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Tenant Earnings</span>
                <span className="text-xs font-black text-gray-900">
                  {profile?.isTenantDisabled ? 'Account Suspended' : profile?.subscriptionActive ? 'R 0.00' : 'Earnings Disabled'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tenant Network Membership & Monthly Subscription for Referred Users */}
      {profile?.tenantId && (
        <div className="bg-white rounded-2xl p-6 border-2 border-blue-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                  Tenant Member Subscription
                </h3>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                  Joined via Tenant Referral Link
                </p>
              </div>
            </div>

            <div>
              {(() => {
                const now = new Date();
                const trialActive = profile?.trialExpiresAt ? new Date(profile.trialExpiresAt) > now : false;
                const trialDaysLeft = profile?.trialExpiresAt ? Math.max(0, Math.ceil((new Date(profile.trialExpiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

                if (profile?.tenantApproved || profile?.userSubscriptionActive) {
                  return (
                    <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Active & Approved</span>
                    </span>
                  );
                } else if (trialActive) {
                  return (
                    <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                      <Clock className="w-3 h-3 text-blue-600" />
                      <span>Trial Active ({trialDaysLeft}d left)</span>
                    </span>
                  );
                } else {
                  return (
                    <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Subscription Due</span>
                    </span>
                  );
                }
              })()}
            </div>
          </div>

          <div className="bg-blue-50/60 rounded-xl p-4 space-y-2 border border-blue-100/60 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Monthly Subscription</span>
              <span className="text-gray-900 font-black">R {hostTenantFee.toFixed(2)} / month</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Tenant Host</span>
              <span className="font-mono text-[10px] text-blue-900 font-bold truncate max-w-[180px]">
                {hostTenant?.displayName || profile.tenantId}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-blue-100/50">
              <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Approval Authority</span>
              <span className="text-blue-900 font-black text-[10px] uppercase">
                Tenant (Direct Approval)
              </span>
            </div>
          </div>

          {hostTenant?.isTenantDisabled && (
            <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Your host tenant account is currently paused by platform administration.</span>
            </div>
          )}

          <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
            As a user who joined through your tenant's link, your monthly subscription of <strong className="text-gray-800">R {hostTenantFee.toFixed(2)}</strong> is paid directly to your host tenant. <span className="font-bold text-gray-800">Your host tenant approves your account directly</span> upon verifying your Proof of Payment.
          </p>

          {hostTenant?.bankDetails && (
            <div className="bg-gray-900 text-white rounded-2xl p-5 space-y-4 shadow-xl border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                <Building2 className="w-12 h-12" />
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Host Banking Details</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div className="space-y-0.5">
                    <p className="text-[7px] font-black text-white/40 uppercase tracking-widest">Bank Name</p>
                    <p className="text-[11px] font-black text-white uppercase tracking-tight">{hostTenant.bankDetails.bankName}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[7px] font-black text-white/40 uppercase tracking-widest">Account Holder</p>
                    <p className="text-[11px] font-black text-white uppercase tracking-tight truncate">{hostTenant.bankDetails.accountHolder}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[7px] font-black text-white/40 uppercase tracking-widest">Account Number</p>
                    <p className="text-[11px] font-mono font-black text-blue-300 tracking-wider">{hostTenant.bankDetails.accountNumber}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[7px] font-black text-white/40 uppercase tracking-widest">Account Type</p>
                    <p className="text-[11px] font-black text-white uppercase tracking-tight">{hostTenant.bankDetails.accountType}</p>
                  </div>
                  {hostTenant.bankDetails.branchCode && (
                    <div className="space-y-0.5">
                      <p className="text-[7px] font-black text-white/40 uppercase tracking-widest">Branch Code</p>
                      <p className="text-[11px] font-black text-white uppercase tracking-tight">{hostTenant.bankDetails.branchCode}</p>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <p className="text-[7px] font-black text-white/40 uppercase tracking-widest">Reference</p>
                    <p className="text-[11px] font-black text-emerald-400 uppercase tracking-tight">Your Full Name</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tenantPopSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Proof of Payment sent to your tenant! Awaiting tenant approval.</span>
            </div>
          )}

          {tenantPayments.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Recent Payment Status</p>
              {tenantPayments.slice(0, 2).map((p: any) => (
                <div key={p.paymentId} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl text-xs">
                  <span className="font-bold text-gray-700">R {p.amount?.toFixed(2) || hostTenantFee.toFixed(2)}</span>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                    p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    p.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {p.status === 'approved' ? 'Approved by Tenant' : p.status === 'rejected' ? 'Rejected by Tenant' : 'Pending Tenant Review'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div>
            <input
              type="file"
              ref={tenantPopInputRef}
              onChange={handleUploadTenantPop}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => tenantPopInputRef.current?.click()}
              disabled={uploadingTenantPop || hostTenant?.isTenantDisabled}
              className="w-full bg-blue-900 hover:bg-blue-800 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center space-x-2 transition-all shadow-sm disabled:opacity-50"
            >
              {uploadingTenantPop ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Monthly PoP to Tenant (R {hostTenantFee.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {profile?.tenantId && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center space-x-2.5">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                Register Your Business
              </h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                Submit documents to {hostTenant?.displayName || 'your tenant'} for verification
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Business Name</label>
              <input
                type="text"
                placeholder="e.g. Apex Cleaning Services"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Business Email (Optional)</label>
                <input
                  type="email"
                  placeholder="contact@apexcleaning.co.za"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Document Type</label>
                <select
                  value={businessDocName}
                  onChange={(e) => setBusinessDocName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CIPC Registration Certificate">CIPC Registration Certificate</option>
                  <option value="Company Tax Certificate">Company Tax Certificate</option>
                  <option value="ID Copies of Directors">ID Copies of Directors</option>
                  <option value="Proof of Address">Proof of Address</option>
                  <option value="Other Registration Document">Other Supporting Document</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Business Description</label>
              <textarea
                placeholder="Briefly describe what your business does..."
                value={businessDesc}
                onChange={(e) => setBusinessDesc(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {businessSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 flex items-center space-x-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Business details and document successfully submitted to your tenant!</span>
              </div>
            )}

            <div>
              <input
                type="file"
                id="business-doc-upload"
                onChange={handleUploadBusinessDocument}
                accept="image/*"
                className="hidden"
                disabled={uploadingBusinessDoc}
              />
              <label
                htmlFor="business-doc-upload"
                className={`w-full bg-blue-900 hover:bg-blue-800 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center space-x-2 transition-all shadow-sm cursor-pointer ${
                  uploadingBusinessDoc ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {uploadingBusinessDoc ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Supporting Document & Submit Business</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Registered Businesses Status List */}
          {businessesList.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">My Businesses</p>
              <div className="space-y-3">
                {businessesList.map((b) => (
                  <div key={b.businessId} className="bg-gray-50 p-4 rounded-xl border border-gray-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-gray-900 text-sm">{b.name}</span>
                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          b.status === 'approved' ? 'bg-green-100 text-green-700' :
                          b.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {b.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{b.documentName}</p>
                      {b.description && (
                        <p className="text-[11px] text-gray-600 font-medium leading-relaxed max-w-md">{b.description}</p>
                      )}
                    </div>

                    <a
                      href={b.proofImage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 self-start sm:self-auto shrink-0 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>View Document</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 rounded-2xl p-6 space-y-3">
        <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest">Invite Friends</h3>
        <p className="text-xs text-blue-700 font-medium leading-relaxed">Share your GiGs link with friends and colleagues to join the community.</p>
        <button 
          onClick={handleShare}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm hover:shadow-md flex items-center justify-center space-x-2"
        >
          <Share2 className="w-3 h-3" />
          <span>Share Link</span>
        </button>
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center space-x-2 border border-gray-100 text-gray-400 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all mb-4"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out</span>
      </button>

      {profile?.isAdmin && (
        <div className="bg-red-50 rounded-2xl p-6 border border-red-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span className="text-xs font-black text-red-900 uppercase tracking-widest">Admin Dashboard</span>
            </div>
            <div className="px-2 py-1 bg-red-600 text-white rounded text-[8px] font-black uppercase tracking-widest">
              Root Access
            </div>
          </div>
          <button 
            onClick={() => setShowAdminPortal(true)}
            className="w-full bg-red-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center space-x-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Enter Admin Control</span>
          </button>
        </div>
      )}
    </div>
  );
}
