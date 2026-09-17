import { useAuth } from './AuthProvider';
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from '../lib/firebase';
import { User as UserIcon, LogOut, LogIn, Share2, Check, Mail, Lock, UserPlus } from 'lucide-react';
import { useState } from 'react';

export default function ProfileView() {
  const { user, profile, loading } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');

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
      setError(err.message || 'Authentication failed');
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

  if (!user) {
    return (
      <div className="flex-1 flex flex-col p-8 bg-white overflow-y-auto pb-24">
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
            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 uppercase tracking-wider">
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
    <div className="flex-1 p-6 space-y-8 overflow-y-auto pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center border-4 border-white shadow-sm overflow-hidden">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-10 h-10 text-gray-300" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">{profile?.displayName || 'User'}</h2>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{profile?.role}</p>
          </div>
        </div>
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

      <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Account Overview</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Email</span>
            <span className="text-sm font-bold text-gray-900">{user.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Status</span>
            <span className="text-[10px] font-black bg-green-100 text-green-700 px-2 py-1 rounded-md uppercase tracking-wider">Active</span>
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
        className="w-full flex items-center justify-center space-x-2 border border-gray-100 text-gray-400 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out</span>
      </button>
    </div>
  );
}
