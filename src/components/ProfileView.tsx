import { useAuth } from './AuthProvider';
import { auth, googleProvider, signInWithPopup, signOut } from '../lib/firebase';
import { User as UserIcon, LogOut, LogIn, Share2, Check } from 'lucide-react';
import { useState } from 'react';

export default function ProfileView() {
  const { user, profile, loading } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
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
      // Fallback to clipboard
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
          <UserIcon className="w-10 h-10 text-gray-300" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Welcome to GiGs</h2>
          <p className="text-gray-500">Sign in to create your profile and connect with others.</p>
        </div>
        <button
          onClick={handleLogin}
          className="flex items-center space-x-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors"
        >
          <LogIn className="w-5 h-5" />
          <span>Sign in with Google</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-8 overflow-y-auto pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img 
            src={user.photoURL || ''} 
            alt={user.displayName || ''} 
            className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-sm"
          />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{profile?.displayName}</h2>
            <p className="text-gray-500 capitalize">{profile?.role}</p>
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
        <h3 className="font-semibold text-gray-900">Profile Details</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-900">{user.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Status</span>
            <span className="text-gray-900">Active</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-2xl p-6 space-y-3">
        <h3 className="font-semibold text-blue-900">Invite Friends</h3>
        <p className="text-sm text-blue-700">Share your GiGs link with friends and colleagues to join the community.</p>
        <button 
          onClick={handleShare}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
        >
          <Share2 className="w-4 h-4" />
          <span>Share Link</span>
        </button>
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center space-x-2 border border-gray-200 text-gray-600 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span>Log Out</span>
      </button>
    </div>
  );
}
