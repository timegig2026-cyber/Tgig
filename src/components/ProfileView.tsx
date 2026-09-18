import { useAuth } from './AuthProvider';
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, db, doc, updateDoc, handleFirestoreError, OperationType } from '../lib/firebase';
import { User as UserIcon, LogOut, LogIn, Share2, Check, Mail, Lock, UserPlus, Camera, Loader2, Edit3, MapPin, ShieldCheck, TrendingUp, CreditCard } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import ProfileEdit from './ProfileEdit';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TenantPortalView from './TenantPortalView';
import AdminView from './AdminView';

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
  const [tenantPortalTab, setTenantPortalTab] = useState<'overview' | 'pop' | 'branding' | 'subscription'>('overview');
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            <span className="text-[10px] font-black bg-green-100 text-green-700 px-2 py-1 rounded-md uppercase tracking-wider">
              {profile?.isTenantApproved ? 'Verified Tenant' : 'Active'}
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
                profile?.isTenantApproved ? 'bg-green-100 text-green-600' : 
                profile?.isTenantRequest ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {profile?.isTenantApproved ? 'Approved' : profile?.isTenantRequest ? 'Pending' : 'Off'}
              </div>
            </div>
            
            <p className="text-[10px] text-gray-500 font-medium leading-relaxed italic">
              {profile?.isTenantApproved 
                ? 'Your tenant account is active. Access your portal to manage services and payments.' 
                : 'Earn passive income by hosting services. Enable this in your profile settings and resubmit for approval.'}
            </p>

            {profile?.isTenantApproved && !profile?.subscriptionActive && (
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
                if (profile?.isTenantApproved) {
                  setTenantPortalTab('overview');
                  setShowTenantPortal(true);
                }
              }}
              disabled={!profile?.isTenantApproved}
              className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center space-x-2 border shadow-sm ${
                profile?.isTenantApproved 
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 active:scale-95' 
                  : 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed opacity-60'
              }`}
            >
              {!profile?.isTenantApproved && <Lock className="w-3 h-3" />}
              <span>{profile?.isTenantApproved ? 'Open Tenant Portal' : 'Tenant Portal Locked'}</span>
            </button>

            {profile?.isTenantApproved && (
              <div className="bg-white p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Tenant Earnings</span>
                <span className="text-xs font-black text-gray-900">
                  {profile?.subscriptionActive ? 'R 0.00' : 'Earnings Disabled'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

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
