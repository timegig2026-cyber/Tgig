import { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, where, handleFirestoreError, OperationType, doc, setDoc } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { Building2, Search, Mail, Sliders, MapPin, Plus, Loader2, X, Upload, CheckCircle } from 'lucide-react';

interface Business {
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  description?: string;
  streetAddress?: string;
  province?: string;
  documentName?: string;
  proofImage?: string;
  documentImage?: string;
  status: string;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  tenantId: string;
  location?: { lat: number; lng: number };
}

const TRADES = [
  'All',
  'Plumbing',
  'Electrical',
  'Construction',
  'Cleaning',
  'Catering',
  'Retail',
  'Consulting',
  'IT Services',
  'Logistics'
];

const PROVINCES = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Free State',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape'
];

export default function BusinessesListView() {
  const { user, profile } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('All');

  // Registration Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [description, setDescription] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [province, setProvince] = useState(PROVINCES[0]);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [docBase64, setDocBase64] = useState<string | null>(null);

  const [pinpointing, setPinpointing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCongratulate, setShowCongratulate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Query approved businesses
    const q = query(collection(db, 'businesses'), where('status', '==', 'approved'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        businessId: doc.id,
        ...doc.data()
      })) as Business[];
      setBusinesses(list);
    }, (err) => {
      console.error("Could not fetch approved businesses", err);
      handleFirestoreError(err, OperationType.LIST, 'businesses');
    });

    return () => unsub();
  }, []);

  const handlePinpointLocation = () => {
    setPinpointing(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude.toFixed(6));
          setLng(pos.coords.longitude.toFixed(6));
          setPinpointing(false);
        },
        (err) => {
          alert("Could not pinpoint location automatically. Please enter coordinates manually.");
          setPinpointing(false);
        }
      );
    } else {
      alert("Geolocation not supported by your browser.");
      setPinpointing(false);
    }
  };

  const handleFileConvert = (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (field === 'logo') {
        setLogoBase64(event.target?.result as string);
      } else {
        setDocBase64(event.target?.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !emailAddress || !contactInfo) {
      setErrorMsg("Please fill out Company Name, Contact Email, and Phone Contact.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const businessId = `biz_${Date.now()}`;
      await setDoc(doc(db, 'businesses', businessId), {
        businessId,
        name: companyName,
        phone: contactInfo,
        email: emailAddress,
        description: description,
        streetAddress: streetAddress,
        province: province,
        documentName: documentName || 'CoC Certification',
        proofImage: logoBase64 || '',
        documentImage: docBase64 || '',
        status: 'pending',
        ownerId: user?.uid || 'anonymous',
        ownerName: profile?.displayName || 'Service Provider',
        tenantId: profile?.tenantId || 'all_tenants',
        location: lat && lng ? { lat: Number(lat), lng: Number(lng) } : null,
        createdAt: new Date().toISOString()
      });

      // Clear Form Fields
      setCompanyName('');
      setContactInfo('');
      setEmailAddress('');
      setDescription('');
      setStreetAddress('');
      setProvince(PROVINCES[0]);
      setLat('');
      setLng('');
      setDocumentName('');
      setLogoBase64(null);
      setDocBase64(null);

      setShowCreateModal(false);
      setShowCongratulate(true);
    } catch (err: any) {
      console.error("Submission failed:", err);
      setErrorMsg(`Submission Failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter based on search criteria and trade classification
  const filteredBusinesses = businesses.filter(biz => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (
      biz.name.toLowerCase().includes(term) ||
      (biz.description && biz.description.toLowerCase().includes(term)) ||
      biz.ownerName.toLowerCase().includes(term)
    );

    if (selectedTrade === 'All') {
      return matchesSearch;
    }

    const tradeLower = selectedTrade.toLowerCase();
    const matchesTrade = (
      biz.name.toLowerCase().includes(tradeLower) ||
      (biz.description && biz.description.toLowerCase().includes(tradeLower)) ||
      (biz.documentName && biz.documentName.toLowerCase().includes(tradeLower))
    );

    return matchesSearch && matchesTrade;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="flex-1 bg-gray-50/50 flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
      {/* Directory Title Header & Unified Top Bar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 shrink-0 flex flex-col space-y-4 shadow-sm relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div>
              <h1 className="text-lg font-black text-gray-950 uppercase tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <span>Local Businesses</span>
              </h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                Registered enterprises and verified local services
              </p>
            </div>

            {/* Quick Profile Registration Launcher on Top Bar */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="sm:hidden p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
              title="Create Business Profile"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {/* Integrated Top Search Bar */}
            <div className="flex-1 sm:max-w-xs relative">
              <Search className="absolute left-3.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search businesses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-1.5 text-[11px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Desktop Registration Launcher Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="hidden sm:inline-flex items-center space-x-1.5 bg-indigo-650 hover:bg-indigo-600 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Profile</span>
            </button>
          </div>
        </div>

        {/* Trade Category Selection Row (Under Search Bar) */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
          {TRADES.map((trade) => {
            const isSelected = selectedTrade === trade;
            return (
              <button
                key={trade}
                onClick={() => setSelectedTrade(trade)}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border shrink-0 transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100/70 hover:text-gray-700'
                }`}
              >
                {trade}
              </button>
            );
          })}
        </div>
      </header>

      {/* Simple Businesses Directory Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {filteredBusinesses.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm space-y-4 animate-in fade-in">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                <Building2 className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">No Businesses Found</h4>
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                  We couldn't find any approved businesses matching your search criteria.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBusinesses.map((biz) => (
                <div
                  key={biz.businessId}
                  className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100/50 transition-all flex flex-col justify-between space-y-4 animate-in fade-in"
                >
                  <div className="space-y-4">
                    {/* Header: Profile Logo & Names */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3.5 min-w-0">
                        {biz.proofImage ? (
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200/80 bg-gray-50 flex items-center justify-center shrink-0 shadow-sm">
                            <img
                              src={biz.proofImage}
                              alt={biz.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100/50 rounded-xl flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5 text-indigo-600" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-gray-900 leading-snug truncate">
                            {biz.name}
                          </h3>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                            by {biz.ownerName}
                          </p>
                        </div>
                      </div>

                      {/* Status/Verified Badge */}
                      <span className="bg-green-50 border border-green-100 text-green-700 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg shrink-0">
                        Verified
                      </span>
                    </div>

                    {/* Description */}
                    {biz.description ? (
                      <p className="text-[11px] text-gray-600 font-medium leading-relaxed line-clamp-3">
                        {biz.description}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400 font-bold italic uppercase tracking-wider">
                        No business description provided.
                      </p>
                    )}

                    {/* Attached Verified Information Block */}
                    <div className="bg-gray-50/70 border border-gray-100/60 rounded-2xl p-3 space-y-2 text-[10px] font-bold text-gray-600">
                      {biz.email && (
                        <div className="flex items-center space-x-2 truncate">
                          <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <a href={`mailto:${biz.email}`} className="text-indigo-600 hover:underline truncate font-mono">
                            {biz.email}
                          </a>
                        </div>
                      )}
                      {biz.documentName && (
                        <div className="flex items-center space-x-2 text-[9px] text-gray-400 uppercase tracking-wider">
                          <Sliders className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>Doc: {biz.documentName}</span>
                        </div>
                      )}
                      {biz.location && (
                        <div className="flex items-center space-x-2 text-[9px] text-gray-400 uppercase tracking-wider">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>Coords: {biz.location.lat.toFixed(4)}, {biz.location.lng.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CREATE PROFILE FORM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative my-8 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-150 shrink-0">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black uppercase tracking-tight text-gray-900">Create Business Profile</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields Scrollbox */}
            <form onSubmit={handleCreateProfileSubmit} className="flex-1 overflow-y-auto py-5 space-y-5 text-xs font-bold text-gray-700">
              {errorMsg && (
                <div className="bg-red-50 border border-red-150 text-red-600 p-3.5 rounded-xl text-[11px] font-bold">
                  {errorMsg}
                </div>
              )}

              {/* Company Name */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Company / Service Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Pretoria Premium Plumbing"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none"
                />
              </div>

              {/* Logo Picture Upload */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Business Profile Logo Picture</label>
                <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50 flex flex-col items-center justify-center text-center relative group">
                  {logoBase64 ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                      <img src={logoBase64} alt="Brand Logo Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => setLogoBase64(null)} 
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-opacity text-[10px] uppercase font-black tracking-widest"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center space-y-1.5 w-full h-full">
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-black">Upload Logo Image</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleFileConvert(e, 'logo')} 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Contact Information and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Contact Phone *</label>
                  <input 
                    type="tel"
                    required
                    placeholder="e.g. +27 82 123 4567"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Contact Email Address *</label>
                  <input 
                    type="email"
                    required
                    placeholder="e.g. contact@business.co.za"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description summary */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Service Description</label>
                <textarea 
                  rows={2}
                  placeholder="Provide a brief summary of what services you specialize in..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none resize-none"
                />
              </div>

              {/* Street Address & Province */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Street Address</label>
                  <input 
                    type="text"
                    placeholder="e.g. 123 Church Street"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Province</label>
                  <select 
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    {PROVINCES.map(prov => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location Pinpointing */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pinpoint Location Coordinates</label>
                  <button 
                    type="button"
                    onClick={handlePinpointLocation}
                    className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors underline flex items-center space-x-1"
                  >
                    {pinpointing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                    <span>{pinpointing ? 'Detecting GPS...' : 'Let App Pinpoint Location'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="number"
                    step="any"
                    placeholder="Latitude (e.g. -26.204)"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none"
                  />
                  <input 
                    type="number"
                    step="any"
                    placeholder="Longitude (e.g. 28.047)"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Support Document Upload Block */}
              <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 space-y-3">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Supporting Credentials Upload</span>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Document Classification Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. CIPC Certificate, CoC Electrical"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none"
                  />
                </div>

                <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white flex flex-col items-center justify-center text-center relative group">
                  {docBase64 ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                      <img src={docBase64} alt="Doc Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => setDocBase64(null)} 
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-opacity text-[10px] uppercase font-black tracking-widest"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center space-y-1.5 w-full">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-black">Upload Certificate (Image)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleFileConvert(e, 'document')} 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-2 shrink-0 animate-in fade-in">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-3 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center space-x-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Submitting...' : 'Submit Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONGRATULATIONS FEEDBACK MODAL */}
      {showCongratulate && (
        <div className="fixed inset-0 z-[2200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-gray-950 uppercase tracking-wide">Congratulations!</h3>
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                Your business profile registration has been successfully submitted for review.
              </p>
            </div>
            <div className="bg-amber-50/70 border border-amber-100/60 p-3 rounded-2xl text-[10px] font-bold text-amber-850 leading-relaxed">
              🔍 Credential validation and compliance reviews usually complete within 24 hours. Your host tenant will process this soon!
            </div>
            <button
              type="button"
              onClick={() => setShowCongratulate(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm transition-colors"
            >
              Back to Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
