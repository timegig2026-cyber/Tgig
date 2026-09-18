import { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { db, doc, updateDoc, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, MapPin, Phone, Globe, Upload, Plus, X, Loader2, Check, ArrowLeft, FileText, TrendingUp, ShieldCheck, ExternalLink } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { TENANT_AGREEMENT_TEXT } from '../constants/tenantAgreement';

interface ProfileEditProps {
  onClose: () => void;
}

export default function ProfileEdit({ onClose }: ProfileEditProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [middleName, setMiddleName] = useState(profile?.middleName || '');
  const [surname, setSurname] = useState(profile?.surname || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [streetAddress, setStreetAddress] = useState(profile?.streetAddress || '');
  const [city, setCity] = useState(profile?.city || '');
  const [province, setProvince] = useState(profile?.province || '');
  const [includeLocationMap, setIncludeLocationMap] = useState<boolean>(!!profile?.location);
  const [socialLinks, setSocialLinks] = useState<string[]>(profile?.socialLinks || ['']);
  const [location, setLocation] = useState<{ lat: number, lng: number }>(
    profile?.location ? { lat: Number(profile.location.lat || profile.location.latitude || -30.5595), lng: Number(profile.location.lng || profile.location.longitude || 22.9375) } : { lat: -30.5595, lng: 22.9375 }
  );
  const [isTenantRequest, setIsTenantRequest] = useState(profile?.isTenantRequest || false);
  const [acceptTenantAgreement, setAcceptTenantAgreement] = useState(profile?.tenantAgreementAccepted || false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [idDocument, setIdDocument] = useState<string>(profile?.idDocument || '');
  const [idDocName, setIdDocName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Automatically pinpoint location if it's the default and geolocation is available
    if (navigator.geolocation && (!profile?.location)) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: Number(pos.coords.latitude), lng: Number(pos.coords.longitude) });
      });
    }
  }, [profile?.location]);

  const handleAddSocial = () => setSocialLinks([...socialLinks, '']);
  const handleRemoveSocial = (index: number) => {
    const newLinks = socialLinks.filter((_, i) => i !== index);
    setSocialLinks(newLinks.length ? newLinks : ['']);
  };
  const handleSocialChange = (index: number, value: string) => {
    const newLinks = [...socialLinks];
    newLinks[index] = value;
    setSocialLinks(newLinks);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      setError('ID Document must be smaller than 1MB');
      return;
    }

    setIdDocName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setIdDocument(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    if (isTenantRequest && !acceptTenantAgreement) {
      setError('You must accept the Tenant Agreement to apply for the program.');
      setLoading(false);
      return;
    }

    try {
      const profileRef = doc(db, 'users', user.uid);
      const profileData: any = {
        firstName,
        middleName,
        surname,
        displayName: `${firstName} ${surname}`.trim(),
        phone,
        bio,
        streetAddress,
        city,
        province,
        socialLinks: socialLinks.filter(l => l.trim() !== ''),
        idDocument,
        isTenantRequest,
        tenantAgreementAccepted: acceptTenantAgreement,
        tenantAgreementAcceptedAt: acceptTenantAgreement ? (profile?.tenantAgreementAcceptedAt || new Date().toISOString()) : null,
        updatedAt: new Date().toISOString()
      };

      if (includeLocationMap) {
        profileData.location = {
          lat: Number(location?.lat || -30.5595),
          lng: Number(location?.lng || 22.9375)
        };
      } else {
        profileData.location = null;
      }

      await updateDoc(profileRef, profileData);
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  function MapEvents() {
    useMapEvents({
      click(e) {
        setLocation({ lat: Number(e.latlng.lat), lng: Number(e.latlng.lng) });
      },
    });
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center space-x-4">
        <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Edit Profile</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-xs font-black uppercase tracking-widest rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {/* Personal Details */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Personal Details</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Middle Name (Optional)</label>
              <input
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Surname</label>
              <input
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                required
              />
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact & Bio</h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                  placeholder="+27..."
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Short Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200 min-h-[100px]"
                placeholder="Tell us about yourself..."
              />
            </div>
          </div>
        </section>

        {/* Address Details */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Address Details</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Street Address</label>
              <input
                type="text"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="123 Main Street"
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Location / City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Johannesburg"
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Province</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="Gauteng"
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Map Pin Point (Optional) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Map Pin Point (Optional)</h3>
            <button
              type="button"
              onClick={() => setIncludeLocationMap(!includeLocationMap)}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl transition-colors ${
                includeLocationMap ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {includeLocationMap ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          {includeLocationMap ? (
            <div className="space-y-2">
              <span className="text-[9px] text-gray-400 font-bold italic">Tap map to pin exact coordinates</span>
              <div className="h-48 w-full rounded-2xl overflow-hidden border-4 border-gray-50">
                <MapContainer center={[location.lat, location.lng]} zoom={13} className="h-full w-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[location.lat, location.lng]} />
                  <MapEvents />
                </MapContainer>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 italic">Map coordinates are optional. Enable above if you want to pin your exact GPS location.</p>
          )}
        </section>

        {/* Social Media Links */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Social Media</h3>
            <button
              type="button"
              onClick={handleAddSocial}
              className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center"
            >
              <Plus className="w-3 h-3 mr-1" /> Add Link
            </button>
          </div>
          <div className="space-y-3">
            {socialLinks.map((link, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => handleSocialChange(index, e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-gray-50 border-none rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                  />
                </div>
                {socialLinks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSocial(index)}
                    className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ID Document */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Identity Verification</h3>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-100 rounded-2xl p-8 flex flex-col items-center justify-center space-y-2 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            {idDocument ? (
              <div className="flex items-center space-x-2 text-green-600">
                <FileText className="w-6 h-6" />
                <span className="text-xs font-bold uppercase tracking-tight">{idDocName || 'Document Uploaded'}</span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-300" />
                <div className="text-center">
                  <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Upload ID Document</p>
                  <p className="text-[10px] text-gray-400 font-medium">Max 1MB (JPG/PNG)</p>
                </div>
              </>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        </section>

        {/* Tenant Request */}
        <section className="bg-blue-50 rounded-2xl p-6 space-y-4 border border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest">Tenant Program</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsTenantRequest(!isTenantRequest)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isTenantRequest ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isTenantRequest ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] text-blue-800 font-bold leading-relaxed">
              Become a verified GiGs Tenant to host services and earn passive income.
            </p>
            <p className="text-[10px] text-blue-600 font-medium italic">
              Once enabled, resubmit your profile. Our team will review your ID and details for approval.
            </p>
          </div>

          {isTenantRequest && !profile?.isTenantApproved && (
            <div className="space-y-4">
              <div className="flex items-start space-x-3 py-2 bg-white/50 p-3 rounded-xl border border-blue-100">
                <input
                  type="checkbox"
                  id="tenantAgreement"
                  checked={acceptTenantAgreement}
                  onChange={(e) => setAcceptTenantAgreement(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                />
                <label htmlFor="tenantAgreement" className="text-[10px] text-blue-900 font-bold leading-relaxed uppercase tracking-tight">
                  I have read and agree to the <button type="button" onClick={() => setShowAgreementModal(true)} className="text-blue-600 underline hover:text-blue-700">TimeGig Tenant Agreement</button>. I confirm that I am legally permitted to enter into this Agreement.
                </label>
              </div>
              
              <button
                type="button"
                onClick={() => setShowAgreementModal(true)}
                className="w-full py-2 px-4 bg-white border border-blue-200 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-blue-50 transition-colors"
              >
                <FileText className="w-3 h-3" />
                <span>Read Full Agreement</span>
              </button>
            </div>
          )}

          {profile?.isTenantApproved && (
            <div className="flex items-center space-x-2 bg-white/50 p-2 rounded-lg border border-blue-100">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Verified Tenant Account</span>
            </div>
          )}
        </section>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading || success}
          className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center space-x-2 ${
            success ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : success ? (
            <Check className="w-4 h-4" />
          ) : (
            <span>Save Profile</span>
          )}
        </button>
      </form>

      {/* Agreement Modal */}
      {showAgreementModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg h-[80vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Tenant Agreement</h3>
                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Please read carefully</p>
              </div>
              <button 
                onClick={() => setShowAgreementModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="prose prose-sm max-w-none">
                {TENANT_AGREEMENT_TEXT.split('\n').map((line, i) => (
                  <p key={i} className={`text-[11px] leading-relaxed text-gray-600 ${line.match(/^\d+\. /) ? 'font-black text-gray-900 mt-6 mb-2 uppercase' : ''}`}>
                    {line}
                  </p>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  setAcceptTenantAgreement(true);
                  setShowAgreementModal(false);
                }}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>I Understand & Agree</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
