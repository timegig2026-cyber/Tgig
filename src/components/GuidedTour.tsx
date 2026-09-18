import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ChevronRight, ChevronLeft, Map as MapIcon, 
  Search, Bell, User as UserIcon, TrendingUp, ShieldCheck 
} from 'lucide-react';
import { db, doc, updateDoc } from '../lib/firebase';

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string;
}

const steps: Step[] = [
  {
    title: "Welcome to TimeGiG",
    description: "Your all-in-one platform to find GiGs, hire seekers, and manage your own service network.",
    icon: <div className="p-4 bg-gray-900 text-white rounded-3xl"><TrendingUp className="w-8 h-8" /></div>
  },
  {
    title: "Find & Post GiGs",
    description: "Use the map to find active GiGs around you or tap anywhere on the map to pin a new opportunity.",
    icon: <div className="p-4 bg-blue-600 text-white rounded-3xl"><MapIcon className="w-8 h-8" /></div>,
    highlight: "map"
  },
  {
    title: "Hire Top Seekers",
    description: "Browse the Seekers tab to find reliable professionals. View their profiles, ratings, and locations in real-time.",
    icon: <div className="p-4 bg-emerald-600 text-white rounded-3xl"><Search className="w-8 h-8" /></div>,
    highlight: "seekers"
  },
  {
    title: "Stay Notified",
    description: "Get instant alerts for new GiGs, seekers, and status updates in your notification center.",
    icon: <div className="p-4 bg-amber-500 text-white rounded-3xl"><Bell className="w-8 h-8" /></div>,
    highlight: "alerts"
  },
  {
    title: "Become a Tenant",
    description: "Limited Opportunity! Only 1,000 spots available to become a Tenant. Tenants earn passive income by managing their own network of seekers.",
    icon: <div className="p-4 bg-indigo-600 text-white rounded-3xl"><ShieldCheck className="w-8 h-8" /></div>,
    highlight: "profile"
  }
];

interface GuidedTourProps {
  userId: string;
  onComplete: () => void;
}

export default function GuidedTour({ userId, onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        hasSeenTour: true,
        updatedAt: new Date().toISOString()
      });
      onComplete();
    } catch (err) {
      console.warn("Could not save tour state", err);
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: -20 }}
          className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative"
        >
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 flex">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`flex-1 transition-all duration-500 ${i <= currentStep ? 'bg-gray-900' : 'bg-gray-100'}`} 
              />
            ))}
          </div>

          <div className="p-8 pt-12 flex flex-col items-center text-center space-y-6">
            <motion.div
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
            >
              {steps[currentStep].icon}
            </motion.div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none">
                {steps[currentStep].title}
              </h2>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                {steps[currentStep].description}
              </p>
            </div>

            {steps[currentStep].title === "Become a Tenant" && (
              <div className="bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-4 w-full">
                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em]">
                  Exclusive Access
                </p>
                <p className="text-xl font-black text-indigo-900 mt-1">
                  1,000 SPOTS ONLY
                </p>
                <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mt-1">
                  Apply in your profile settings
                </p>
              </div>
            )}

            <div className="flex items-center justify-between w-full pt-4">
              <button
                onClick={handleBack}
                disabled={currentStep === 0}
                className={`p-4 rounded-2xl transition-all ${currentStep === 0 ? 'text-gray-200' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={handleNext}
                className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 hover:bg-gray-800 shadow-xl shadow-gray-200 transition-all active:scale-95"
              >
                <span>{currentStep === steps.length - 1 ? "Get Started" : "Next Step"}</span>
                {currentStep !== steps.length - 1 && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={handleComplete}
              className="text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-gray-900 transition-colors pt-2"
            >
              Skip Tour
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
