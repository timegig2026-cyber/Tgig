import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Download, WifiOff, X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-20 left-4 right-4 z-[2000] flex items-center justify-between gap-3 rounded-2xl bg-amber-500 p-4 text-xs font-black text-white shadow-2xl uppercase tracking-widest border border-white/20 backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <p>Offline Mode</p>
              <p className="text-[8px] opacity-80">Working with cached data</p>
            </div>
          </div>
          <div className="h-2 w-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center space-x-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
      >
        <Download className="w-3.5 h-3.5 text-blue-400" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center space-x-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>Install App</span>
        </button>

        <AnimatePresence>
          {showIOSGuide && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl relative overflow-hidden"
              >
                <button 
                  onClick={() => setShowIOSGuide(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>

                <div className="w-16 h-16 bg-blue-50 rounded-[24px] flex items-center justify-center mb-6">
                  <Download className="w-8 h-8 text-blue-600" />
                </div>

                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Install on iPhone</h3>
                
                <div className="mt-6 space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                    <p className="text-[11px] text-gray-600 font-bold leading-relaxed">
                      Tap the <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 rounded-md text-gray-900"><Share className="w-3 h-3 mr-1" /> Share</span> button in the Safari toolbar.
                    </p>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                    <p className="text-[11px] text-gray-600 font-bold leading-relaxed">
                      Scroll down and tap <span className="text-gray-900 font-black uppercase">"Add to Home Screen"</span>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="mt-8 w-full rounded-2xl bg-gray-900 py-4 text-xs font-black text-white uppercase tracking-widest shadow-lg hover:bg-gray-800 transition-colors"
                >
                  Got it
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return null;
};
