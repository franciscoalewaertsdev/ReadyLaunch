"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Check, ChevronRight, Lightbulb, X, Rocket, Crown, Pencil, Mail, User } from 'lucide-react';
import { WhopCheckoutEmbed } from '@whop/checkout/react';


export default function ReadyLaunchApp() {
  const [step, setStep] = useState(0); 
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [checkoutTotal, setCheckoutTotal] = useState<number>(0);
  const [isCheckoutVisible, setIsCheckoutVisible] = useState(false);
  const [checkoutAuthMessage, setCheckoutAuthMessage] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement | null>(null);

  // --- LÓGICA DE WHOP ---
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };

    const name = getCookie('user_name');
    if (name) {
      setUserName(decodeURIComponent(name));
    }
  }, []);

  useEffect(() => {
    if (userName) {
      setCheckoutAuthMessage('');
    }
  }, [userName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // PKCE + OAuth 2.1 helpers (from Whop docs)
  const STORAGE_KEY = 'whop_oauth_pkce';
  const CLIENT_ID = process.env.NEXT_PUBLIC_WHOP_CLIENT_ID;
  const SCOPES = 'openid profile email';

  const countryOptions = useMemo(() => {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    const names: string[] = [];

    for (let first = 65; first <= 90; first++) {
      for (let second = 65; second <= 90; second++) {
        const code = String.fromCharCode(first, second);
        const name = displayNames.of(code);

        if (!name || name === code) {
          continue;
        }

        names.push(name);
      }
    }

    return Array.from(new Set(names))
      .filter((name) => !name.toLowerCase().includes('outlying'))
      .sort((a, b) => a.localeCompare(b));
  }, []);

  function base64url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
  }

  function randomString(len: number): string {
    return base64url(crypto.getRandomValues(new Uint8Array(len)));
  }

  async function sha256(str: string): Promise<string> {
    return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))));
  }

  async function startWhopOAuth() {
    if (!CLIENT_ID) {
      alert('Missing NEXT_PUBLIC_WHOP_CLIENT_ID in environment');
      return;
    }

    const redirectUri =
      process.env.NEXT_PUBLIC_WHOP_REDIRECT_URI ||
      `${window.location.origin}/api/auth/callback`;

    const pkce = {
      codeVerifier: randomString(32),
      state: randomString(16),
      nonce: randomString(16),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pkce));

    const codeChallenge = await sha256(pkce.codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      scope: SCOPES,
      state: pkce.state,
      nonce: pkce.nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `https://api.whop.com/oauth/authorize?${params}`;
  }

  const next = () => {
    setStep(s => s + 1);
  };
  const back = () => {
    setStep(s => s - 1);
  };
  const goToStep = (s: number) => setStep(s);

  const canProceedToNextStep = useMemo(() => {
    if (step === 2) return selectedCountry.trim().length > 0;
    if (step === 3) return companyName.trim().length > 0;
    if (step === 4) return selectedState.trim().length > 0;
    if (step === 5) return selectedPackage.trim().length > 0;
    if (step === 6) return selectedAddress.trim().length > 0;
    return true;
  }, [step, selectedCountry, companyName, selectedState, selectedPackage, selectedAddress]);

  const packagePrice = selectedPackage === 'Premium+' ? 850 : selectedPackage === 'Credit Accelerator' ? 1495 : 0;
  const addressPrice = selectedAddress === 'commercial'
    ? (isYearly ? 350 : 31)
    : selectedAddress === 'residential'
      ? (isYearly ? 1490 : 127)
      : selectedAddress === 'own-setup'
        ? 0
        : 0;
  const totalPrice = packagePrice + addressPrice;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // --- COMPONENTE: BOTÓN DE AUTH ---
  const AuthButton = () => {
    const handleLogout = async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        // Clear local state
        setUserName(null);
        setStep(0);
        // Reload to ensure clean state
        window.location.href = '/';
      } catch (err) {
        alert('Logout failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };

    if (userName) {
      return (
        <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 px-4 py-2 rounded-xl">
          <div className="flex items-center gap-2">
            <User size={16} className="text-[#a5b4fc]" />
            <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider italic">Welcome, {userName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="ml-2 pl-3 border-l border-zinc-700 text-xs font-bold text-zinc-400 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
      );
    }
    return (
      <button 
        onClick={startWhopOAuth}
        className="bg-[#ff385c] hover:bg-[#ff4d6d] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 active:scale-95"
      >
        <img src="/media/whopLogo.png" className="w-6 h-6 object-contain" alt="whop" />
        Log in with Whop
      </button>
    );
  };

  // --- COMPONENTE: LOGO REUTILIZABLE ---
  const Logo = () => (
    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setStep(0)}>
      <img 
        src="/media/logo.png" 
        alt="Readylaunch Logo" 
        className="h-8 w-auto object-contain" 
      />
    </div>
  );

  // --- COMPONENTE: BARRA DE PASOS ---
  const StepTracker = ({ current }: { current: number }) => {
    const steps = ["Your Location", "Company Name", "State of Registration", "Package", "Address", "Review & Pay", "Checkout"];
    return (
      <div className="flex items-center gap-2 lg:gap-3 text-[10px] lg:text-[11px] font-bold tracking-tight">
        {steps.map((label, i) => {
          const stepIdx = i + 2;
          const isDone = current > stepIdx;
          const isCurrent = current === stepIdx;
          return (
            <React.Fragment key={i}>
              <div className={`flex items-center gap-1.5 lg:gap-2 whitespace-nowrap ${isCurrent || isDone ? 'text-[#f59e0b]' : 'text-zinc-600'}`}>
                {isDone ? (
                  <div className="w-4 h-4 rounded-full bg-[#f59e0b] flex items-center justify-center">
                    <Check size={10} className="text-black" strokeWidth={5} />
                  </div>
                ) : (
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isCurrent ? 'border-[#f59e0b]' : 'border-zinc-700'}`}>
                    <div className={`w-1 h-1 rounded-full ${isCurrent ? 'bg-[#f59e0b]' : 'bg-zinc-700'}`} />
                  </div>
                )}
                <span>{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-[1px] w-4 lg:w-8 ${isDone ? 'bg-[#f59e0b]' : 'bg-zinc-800'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // --- STEP 0: HOME ---
  if (step === 0) return (
    <div className="min-h-screen bg-[#0e0718] flex flex-col lg:flex-row font-sans text-white overflow-hidden relative">
      <div className="absolute top-10 left-10 right-10 z-50 flex items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-3">
          <AuthButton />
          <button onClick={() => setIsHelpOpen(true)} className="border border-zinc-800 px-5 py-2 rounded-xl text-xs font-bold text-zinc-400">Need Help?</button>
        </div>
      </div>
      <div className="lg:w-[38%] p-10 lg:p-20 flex flex-col justify-between relative border-r border-zinc-900/50">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-900/20 to-transparent blur-3xl pointer-events-none" />
        <div className="relative z-10 h-8" />
        <div className="relative z-10">
          <h1 className="text-5xl lg:text-6xl font-bold mb-8 leading-[1.1] tracking-tight italic">All-In-One <br/><span className="text-[#a5b4fc] border-b-4 border-indigo-500/20">LLC Platform</span></h1>
          <p className="text-zinc-500 text-lg leading-relaxed max-w-sm font-medium">ReadyLaunch is an all-in-one solution to setup and manage your LLC business in the US. Everything from LLC incorporation to tax ID and bank account, then accounting, compliance and tax filing in one platform.</p>
        </div>
        <div />
      </div>
      <div className="lg:w-[62%] bg-[#0e0718] p-10 lg:p-20 flex flex-col items-center justify-center relative text-center">
        <div className="max-w-md w-full">
          <h2 className="text-4xl font-medium mb-12 italic tracking-tight">Let's get started!</h2>
          <div className="space-y-4 mb-12">
            <button onClick={next} className="w-full bg-[#1e1e2d] border border-zinc-700/50 text-zinc-300 font-bold py-5 rounded-2xl text-lg hover:bg-[#252538] transition shadow-2xl tracking-tight">Form & start my new LLC</button>
            <button className="w-full bg-[#11111d] text-zinc-700 font-bold py-5 rounded-2xl text-lg tracking-tight">Run & grow my existing US company</button>
          </div>
          <div className="p-8 bg-zinc-900/20 border border-zinc-800/50 rounded-[35px] text-left flex items-center justify-between relative group">
            <div className="max-w-[75%] relative z-10">
              <h3 className="font-bold text-lg mb-2 text-white italic tracking-tight">Setting up a new LLC</h3>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">We'll help you setup everything from state filing, registered agent, EIN and a business bank account to set you up for success.</p>
            </div>
            <div className="opacity-20 transform rotate-12 transition-transform group-hover:scale-110"><Rocket size={50} className="text-zinc-700" /></div>
          </div>
        </div>
      </div>
    </div>
  );

  // --- STEP 1: REQUIREMENTS ---
  if (step === 1) return (
    <div className="min-h-screen bg-[#0e0718] text-white flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-10 left-10"><Logo /></div>
      <div className="absolute top-10 right-10 flex gap-3"><AuthButton /><button onClick={() => setIsHelpOpen(true)} className="border border-zinc-800 px-5 py-2 rounded-xl text-xs font-bold text-zinc-400">Need Help?</button></div>
      <h2 className="text-4xl font-medium mb-16 text-center italic tracking-tight">Do you meet this requirements?</h2>
      <div className="bg-zinc-900/10 border border-zinc-800/30 p-10 rounded-[45px] max-w-6xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { n: "1.", t: "Valid Passport", d: "A valid passport is required to open a virtual bank account. (No U.S. visa is needed)." },
            { n: "2.", t: "Proof of Address", d: "A bank statement or utility bill showing the partners residential address in their home country." },
            { n: "3.", t: "Online Business Presence", d: "A website, Instagram, or LinkedIn profile that demonstrates your company's activity." },
            { n: "4.", t: "Eligible Country", d: "Applicants must not reside in a prohibited country, as this decreases the chances of approval for opening a virtual U.S. bank account." }
          ].map((item, i) => (
            <div key={i} className="bg-[#1e1e35] p-8 rounded-[32px] flex flex-col items-center text-center h-full border border-white/5">
              <span className="text-4xl font-bold mb-6 italic">{item.n}</span>
              <h3 className="text-lg font-bold mb-4 italic tracking-tight">{item.t}</h3>
              <p className="text-zinc-400 text-[13px] leading-relaxed font-medium">{item.d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-4 mt-16">
        <button onClick={back} className="bg-zinc-900/50 border border-zinc-800 px-10 py-4 rounded-full text-zinc-400 font-bold text-sm">No, I do not meet these requirements</button>
        <button onClick={next} className="bg-white text-black px-12 py-4 rounded-full font-bold text-sm flex items-center gap-2">Yes, I do <ChevronRight size={18} /></button>
      </div>
    </div>
  );

  // --- FLUJO PRINCIPAL ---
  return (
    <div className="min-h-screen bg-[#0e0718] text-white font-sans flex relative overflow-x-hidden">
      <div className={`flex-1 flex flex-col p-8 lg:p-12 transition-all duration-500 ${isHelpOpen ? 'mr-[350px]' : 'mr-0'}`}>
        <div className="flex justify-between items-center mb-4">
          <Logo />
          <div className="flex items-center gap-3">
            <AuthButton />
            <button onClick={() => setIsHelpOpen(true)} className="border border-zinc-800 px-5 py-2 rounded-xl text-xs font-bold text-zinc-400">Need Help?</button>
          </div>
        </div>
        <div className="flex justify-center mb-10">
          <StepTracker current={step} />
        </div>

        <div key={step} className="flex-1 flex flex-col items-center justify-center w-full animate-in fade-in duration-500 pb-12">
          
          {/* STEP 2: LOCATION */}
          {step === 2 && (
            <div className="max-w-2xl w-full flex flex-col items-center">
              <h2 className="text-[40px] font-medium mb-12 text-center italic tracking-tight leading-tight">Which country do you <br/> reside in? 🌎</h2>
              <div ref={countryDropdownRef} className="w-full max-w-md relative mb-8">
                <button
                  type="button"
                  onClick={() => setIsCountryDropdownOpen((prev) => !prev)}
                  className="w-full bg-[#0c0c14] border border-zinc-800 p-5 rounded-2xl text-left font-medium outline-none cursor-pointer hover:border-zinc-700 transition-colors flex items-center justify-between"
                >
                  <span className={selectedCountry ? 'text-zinc-200' : 'text-zinc-400'}>
                    {selectedCountry || 'Select country of residence'}
                  </span>
                  <ChevronRight
                    size={20}
                    className={`text-zinc-600 transition-transform ${isCountryDropdownOpen ? 'rotate-90' : '-rotate-90'}`}
                  />
                </button>

                {isCountryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-3 bg-[#0c0c14] border border-zinc-800 rounded-2xl max-h-64 overflow-y-auto z-30 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                    {countryOptions.map((country) => (
                      <button
                        key={country}
                        type="button"
                        onClick={() => {
                          setSelectedCountry(country);
                          setIsCountryDropdownOpen(false);
                        }}
                        className={`w-full text-left px-5 py-3 text-sm transition-colors border-b border-zinc-800/50 last:border-b-0 ${
                          selectedCountry === country
                            ? 'bg-[#1e1e35]/50 text-white'
                            : 'text-zinc-300 hover:bg-zinc-800/40'
                        }`}
                      >
                        {country}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="w-full max-w-md bg-[#0c0c14]/50 border border-zinc-800/60 p-6 rounded-[28px] flex gap-4 items-start">
                <Lightbulb className="text-zinc-600 mt-1 shrink-0" size={18} />
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">We may offer recommendations depending on your country of residence.</p>
              </div>
            </div>
          )}

          {/* STEP 3: COMPANY NAME */}
          {step === 3 && (
            <div className="max-w-2xl w-full flex flex-col items-center">
              <h2 className="text-[40px] font-medium mb-12 text-center italic tracking-tight">Choose your desired company name</h2>
              <div className="w-full max-w-lg mb-8">
                <input autoFocus value={companyName} onChange={(e) => setCompanyName(e.target.value)} type="text" placeholder="Readylaunch LLC" className="w-full bg-[#0c0c14] border border-zinc-800 p-5 rounded-2xl text-zinc-300 font-medium focus:border-[#f59e0b]/50 outline-none" />
              </div>
              <div className="w-full max-w-lg bg-[#0c0c14]/50 border border-zinc-800/60 p-8 rounded-[32px] flex flex-col gap-3">
                <div className="flex gap-2 items-center text-white font-bold text-sm italic tracking-tight"><Lightbulb size={18} /><span>Pro Tip:</span></div>
                <p className="text-zinc-500 text-[13.5px] leading-relaxed font-medium">Create a unique name for your new LLC so that you can generate confidence to your customers and it's easy to find and read.</p>
              </div>
            </div>
          )}

          {/* STEP 4: STATE */}
          {step === 4 && (
            <div className="max-w-2xl w-full flex flex-col items-center">
              <h2 className="text-[40px] font-medium mb-12 text-center italic tracking-tight">Choose your registration state</h2>
              <div className="space-y-4 w-full">
                {[
                  { id: 'Wyoming', icon: '🇺🇸', tag: 'Recomended', desc: 'Recommended for LLCs due to lower annual costs and greater flexibility. There\'s no corporate income tax or annual franchise tax.' },
                  { id: 'Florida', icon: '🇺🇸', desc: 'Best for easy banking and a strong U.S. presence, especially if you plan to visit or operate through Miami.' },
                  { id: 'Delaware', icon: '🇺🇸', desc: 'Investor-friendly with strong legal protections—ideal for startups planning to scale or raise capital.' }
                ].map((state) => (
                  <div key={state.id} onClick={() => setSelectedState(state.id)} className={`p-8 rounded-[32px] cursor-pointer transition-all relative border ${selectedState === state.id ? 'bg-[#1e1e35]/40 border-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'bg-zinc-900/20 border-zinc-800/50'}`}>
                    {state.tag && <span className="absolute top-6 right-8 bg-[#166534] text-[#4ade80] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">{state.tag}</span>}
                    <div className="flex justify-between items-start">
                      <div className="max-w-[85%]">
                        <h3 className="text-xl font-bold mb-3 italic tracking-tight">{state.id}</h3>
                        <p className="text-zinc-500 text-[13.5px] leading-relaxed font-medium">{state.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${state.tag ? 'mt-10' : 'mt-1'} ${selectedState === state.id ? 'border-indigo-500' : 'border-zinc-700'}`}>
                        {selectedState === state.id && <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_white]" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: PACKAGE */}
          {step === 5 && (
            <div className="w-full max-w-6xl px-4 flex flex-col items-center">
              <h2 className="text-[42px] font-medium mb-12 text-center italic tracking-tight">Choose your LLC package</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl items-stretch">
                
                {/* Premium+ */}
                <div onClick={() => setSelectedPackage('Premium+')} className={`p-10 rounded-[40px] border-2 transition-all cursor-pointer flex flex-col ${selectedPackage === 'Premium+' ? 'bg-[#0f0f2d] border-indigo-500' : 'bg-[#0c0c14] border-zinc-800 opacity-80'}`}>
                  <div className="w-12 h-12 bg-indigo-900/40 rounded-xl mb-6 flex items-center justify-center border border-indigo-500/30">
                     <div className="w-6 h-6 bg-gradient-to-tr from-indigo-600 to-indigo-300 transform rotate-45" />
                  </div>
                  <h3 className="text-3xl font-bold mb-1 italic tracking-tight">Premium+</h3>
                  <p className="text-zinc-500 text-sm font-medium mb-6 italic">LLC Formation + Banking setup for foreigners</p>
                  <div className="mb-6">
                    <p className="text-zinc-500 text-sm line-through font-bold mb-1 italic">(Total Value: $1,475)</p>
                    <p className="text-6xl font-black italic tracking-tighter">$850</p>
                    <p className="text-zinc-500 text-[10px] font-bold mt-1 uppercase">USD — One-time fee</p>
                  </div>
                  <div className="h-[1px] bg-zinc-800/50 w-full mb-8" />
                  <div className="space-y-4 mb-12 flex-1">
                    {[
                      {t: "LLC formation in Wyoming or Florida", c: true},
                      {t: "Expedited EIN setup (Tax ID)", c: true},
                      {t: "U.S. business bank account setup (Guaranteed)", c: true},
                      {t: "Registered agent for 1 year*", c: true},
                      {t: "BOI report filing", c: true},
                      {t: "Personalized expert support", c: true},
                      {t: "All state filing fees and required documents included", c: true},
                      {t: "Access to over $2,500 in perks and tools", c: true},
                      {t: "Build personal U.S. credit history", c: false},
                      {t: "Access to personal/business banking & credit cards", c: false},
                      {t: "Premium U.S. residential address upgrade", c: false}
                    ].map((item, i) => (
                      <div key={i} className={`flex items-start gap-3 text-[12.5px] font-medium ${item.c ? 'text-zinc-200' : 'text-zinc-600'}`}>
                        {item.c ? <Check size={16} className="text-green-500 shrink-0" strokeWidth={3} /> : <X size={16} className="text-red-600 shrink-0" strokeWidth={3} />}
                        <span>{item.t}</span>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-auto w-8 h-8 rounded-full border-2 self-end ${selectedPackage === 'Premium+' ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-700'} flex items-center justify-center`}>
                    {selectedPackage === 'Premium+' && <div className="w-3 h-3 rounded-full bg-white" />}
                  </div>
                </div>

                {/* Credit Accelerator */}
                <div onClick={() => setSelectedPackage('Credit Accelerator')} className={`p-10 rounded-[40px] border-2 transition-all cursor-pointer flex flex-col relative ${selectedPackage === 'Credit Accelerator' ? 'bg-[#1a1405] border-[#f59e0b]' : 'bg-[#0c0c14] border-zinc-800 opacity-80'}`}>
                  <div className="absolute top-8 right-8 bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-[10px] font-black px-4 py-1.5 rounded-full uppercase italic tracking-widest flex items-center gap-2">
                    <Rocket size={12} className="fill-[#f59e0b]" /> 2X VALUE
                  </div>
                  <div className="w-12 h-12 bg-zinc-900 rounded-xl mb-6 flex items-center justify-center border border-zinc-800">
                     <Rocket size={24} className="text-zinc-500" />
                  </div>
                  <h3 className="text-4xl font-black mb-1 italic tracking-tight">Credit Accelerator</h3>
                  <p className="text-zinc-500 text-[11px] font-bold mb-6 italic">All-in-One: LLC + Banking + ITIN [Allows you to build credit as a foreigners]</p>
                  <div className="mb-6 text-center">
                    <p className="text-zinc-500 text-sm line-through font-bold mb-1 italic">(Total value: $2,997)</p>
                    <p className="text-6xl font-black italic tracking-tighter">ONLY $1,495</p>
                    <p className="text-zinc-500 text-[10px] font-bold mt-1 uppercase">USD — One-time fee</p>
                  </div>
                  <div className="h-[1px] bg-[#f59e0b]/20 w-full mb-8" />
                  <div className="space-y-4 mb-12 flex-1">
                    <div className="flex items-center gap-3 text-sm font-black text-white italic"><Check size={18} className="text-green-500" strokeWidth={3}/> Everything in Platinum+</div>
                    {[
                      {t: "LLC formation in Wyoming or Florida", c: 'check'},
                      {t: "Registered Agent for 1 year", c: 'check'},
                      {t: "U.S. business bank account setup (Guaranteed)", c: 'check'},
                      {t: "BOI Report Filing", c: 'check'},
                      {t: "ITIN application process", c: 'crown'},
                      {t: "Express ITIN (fast delivery)", c: 'crown'},
                      {t: "Full access to the U.S. financial system as a foreigner", c: 'crown'},
                      {t: "Ability to open Stripe/PayPal, and other platforms", c: 'crown'},
                      {t: "Allows you to open a personal U.S. bank account", c: 'crown'},
                      {t: "Eligibility to start building U.S. credit history", c: 'crown'},
                      {t: "Availability to access a U.S. physical address (If needed)", c: 'crown'},
                      {t: "Priority handling on your order", c: 'crown'},
                      {t: "Access to over $7,500 worth of perks and tools", c: 'crown'}
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 text-[12.5px] font-bold text-zinc-100">
                        {item.c === 'check' ? <Check size={16} className="text-green-500 shrink-0" strokeWidth={3} /> : <Crown size={16} className="text-[#f59e0b] fill-[#f59e0b] shrink-0" />}
                        <span>{item.t}</span>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-auto w-8 h-8 rounded-full border-2 self-end ${selectedPackage === 'Credit Accelerator' ? 'border-[#f59e0b] bg-[#f59e0b]' : 'border-zinc-700'} flex items-center justify-center`}>
                    {selectedPackage === 'Credit Accelerator' && <div className="w-3 h-3 rounded-full bg-white" />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: ADDRESS */}
          {step === 6 && (
            <div className="w-full max-w-6xl px-4 flex flex-col items-center">
              <h2 className="text-[44px] font-medium mb-10 text-center italic tracking-tight leading-tight">Select your address type</h2>
              
              <div className="flex items-center gap-4 mb-14 text-xl font-bold italic tracking-tight">
                <span className={!isYearly ? 'text-white' : 'text-zinc-600'}>Monthly</span>
                <div onClick={() => setIsYearly(!isYearly)} className="w-14 h-7 bg-zinc-800 rounded-full relative cursor-pointer p-1">
                  <div className={`w-5 h-5 bg-white rounded-full transition-all duration-300 transform ${isYearly ? 'translate-x-7' : 'translate-x-0'}`} />
                </div>
                <span className={isYearly ? 'text-white' : 'text-zinc-600'}>Yearly</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl items-stretch">
                
                {/* OPCIÓN COMERCIAL */}
                <div onClick={() => setSelectedAddress('commercial')} className={`p-8 rounded-[32px] border transition-all cursor-pointer flex flex-col h-full ${selectedAddress === 'commercial' ? 'bg-[#1a1a1a] border-zinc-700 shadow-xl' : 'bg-[#111111] border-zinc-800/40 opacity-70'}`}>
                  <div className="flex justify-center mb-6">
                    <div className="bg-[#2a2a2a] border border-zinc-700 px-3 py-1 rounded-full flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-orange-500" />
                       <span className="text-[9px] font-bold text-zinc-300 uppercase">A U.S. address is required for incorporation</span>
                    </div>
                  </div>
                  <div className="text-center mb-8">
                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Virtual Address</p>
                    <p className="text-6xl font-black italic tracking-tighter text-white">
                      ${isYearly ? '350' : '31'}
                      <span className="text-2xl font-bold text-zinc-500">{isYearly ? '/yr' : '/mo'}</span>
                    </p>
                    <p className="text-white text-xl font-black uppercase italic mt-2">Commercial</p>
                    <p className="text-zinc-600 text-[10px] font-bold mt-1 uppercase">{isYearly ? 'Billed Yearly' : 'Billed Monthly'}</p>
                  </div>
                  <div className="h-[1px] bg-zinc-800/50 w-full mb-8" />
                  <div className="flex-1 space-y-4 mb-10">
                    <div className="flex items-start gap-3 text-[13px] font-medium text-white">
                      <Check size={16} className="text-green-500 shrink-0" strokeWidth={3} />
                      <span>Open virtual bank accounts only</span>
                    </div>
                    <div className="flex items-start gap-3 text-[13px] font-medium text-white">
                      <Check size={16} className="text-green-500 shrink-0" strokeWidth={3} />
                      <span>Receive documents (Mailbox service)</span>
                    </div>
                    <div className="flex items-start gap-3 text-[13px] font-medium text-zinc-500">
                      <X size={16} className="text-red-800 shrink-0" strokeWidth={3} />
                      <span>Cannot open physical bank accounts (Chase or Bofa)</span>
                    </div>
                    <div className="flex items-start gap-3 text-[13px] font-medium text-zinc-500">
                      <X size={16} className="text-red-800 shrink-0" strokeWidth={3} />
                      <span>Cannot help you build U.S. credit</span>
                    </div>
                    <div className="flex items-start gap-3 text-[13px] font-medium text-zinc-500">
                      <X size={16} className="text-red-800 shrink-0" strokeWidth={3} />
                      <span>Does not include a U.S. lease agreement</span>
                    </div>
                  </div>
                  <button className="w-full py-4 rounded-xl bg-gradient-to-b from-[#4a4a4a] to-[#2a2a2a] border border-zinc-600 text-white font-black text-[11px] uppercase tracking-wider shadow-lg">
                    I'll stick with a commercial address
                  </button>
                  <p className="text-[9px] text-zinc-600 text-center mt-4 font-bold">Note: A credit card or debit card is needed to setup monthly payment</p>
                </div>

                {/* OPCIÓN RESIDENCIAL */}
                <div onClick={() => setSelectedAddress('residential')} className={`p-8 rounded-[32px] border transition-all cursor-pointer flex flex-col relative h-full ${selectedAddress === 'residential' ? 'bg-[#151205] border-[#f59e0b]/60 shadow-2xl' : 'bg-[#111111] border-zinc-800/40 opacity-70'}`}>
                  <div className="text-center mb-8 mt-4">
                    <p className="text-[#f59e0b] text-[10px] font-black uppercase tracking-widest mb-1">Premium Physical Address</p>
                    <p className="text-6xl font-black italic tracking-tighter text-white">
                      ONLY ${isYearly ? '1490' : '127'}
                      <span className="text-2xl font-bold text-zinc-500">{isYearly ? '/yr' : '/mo'}</span>
                    </p>
                    <p className="text-white text-xl font-black uppercase italic mt-2">Residential</p>
                    <p className="text-zinc-600 text-[10px] font-bold mt-1 uppercase">{isYearly ? 'Billed Yearly' : 'Billed Monthly'}</p>
                  </div>
                  <div className="h-[1px] bg-[#f59e0b]/20 w-full mb-8" />
                  <div className="flex-1 space-y-4 mb-10">
                    <div className="flex items-start gap-3 text-[13px] font-medium text-white">
                      <Check size={16} className="text-green-500 shrink-0" strokeWidth={3} />
                      <span>Open Virtual bank accounts</span>
                    </div>
                    <div className="flex items-start gap-3 text-[13px] font-medium text-white">
                      <Check size={16} className="text-green-500 shrink-0" strokeWidth={3} />
                      <span>Receive and forward official documents & mail</span>
                    </div>
                    {[
                      "Open physical business bank accounts (Chase, Bofa)",
                      "Open personal bank account in the U.S.",
                      "Build U.S. personal credit history",
                      "Fractionalized property lease in the U.S. as proof of address",
                      "Stable & bulletproof Bank accounts – Prevents random shutdowns or bans due to address changes"
                    ].map((text, i) => (
                      <div key={i} className="flex items-start gap-3 text-[13px] font-bold text-white">
                        <Crown size={14} className="text-[#f59e0b] fill-[#f59e0b] shrink-0 mt-0.5" />
                        <span dangerouslySetInnerHTML={{ __html: text.replace(/(physical business bank|personal bank|U.S. personal credit history|Stable & bulletproof Bank accounts)/g, "<strong>$1</strong>") }} />
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-4 rounded-xl bg-gradient-to-b from-[#eab308] to-[#ca8a04] text-black font-black text-[11px] uppercase tracking-wider shadow-lg">
                    Upgrade me to premium address
                  </button>
                  <p className="text-[9px] text-zinc-600 text-center mt-4 font-bold">Note: Upgrading later will require additional fees.</p>
                </div>
              </div>

              <button onClick={() => { setSelectedAddress('own-setup'); next(); }} className="mt-10 text-zinc-500 text-[11px] font-medium underline underline-offset-4 hover:text-zinc-300">
                I'll take my chances, I'll set this up myself. I acknowledge that I need to set this up before I can set up my LLC
              </button>
            </div>
          )}

          {/* STEP 7: REVIEW & CHECKOUT */}
          {step === 7 && (
            <div className="w-full max-w-3xl flex flex-col items-center">
              <h2 className="text-[44px] font-medium mb-2 text-center italic tracking-tight">Review and pay</h2>
              <p className="text-zinc-400 text-lg mb-10">You're almost done 🎉</p>
              <div className="w-full space-y-4 mb-10">
                <div className="bg-[#11111d] border border-zinc-800/50 p-6 rounded-[24px] flex justify-between items-center">
                  <div><p className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider mb-1">Desired Company Name:</p><p className="text-xl font-bold italic">{companyName}</p></div>
                  <button onClick={() => goToStep(3)} className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center text-zinc-400 hover:bg-zinc-700 transition-all"><Pencil size={18} /></button>
                </div>
                <div className="bg-[#11111d] border border-zinc-800/50 p-6 rounded-[24px] flex justify-between items-center">
                  <div><p className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider mb-1">Registration State:</p><p className="text-xl font-bold italic">{selectedState || 'Not selected'}</p></div>
                  <button onClick={() => goToStep(4)} className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center text-zinc-400"><Pencil size={18} /></button>
                </div>
                <div className="bg-[#11111d] border border-zinc-800/50 p-6 rounded-[24px] flex justify-between items-center">
                  <div><p className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider mb-1">LLC Package</p><p className="text-xl font-bold italic">{selectedPackage || 'Not selected'}</p></div>
                  <div className="flex items-center gap-4">
                    <p className="text-2xl font-bold italic">
                      ${packagePrice}
                      <span className="text-xs text-zinc-500 not-italic font-medium ml-1">/once</span>
                    </p>
                    <button onClick={() => goToStep(5)} className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center text-zinc-400"><Pencil size={18} /></button>
                  </div>
                </div>
                <div className="bg-[#11111d] border border-zinc-800/50 p-6 rounded-[24px] flex justify-between items-center">
                  <div>
                    <p className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider mb-1">Address Configuration</p>
                    <p className="text-xl font-bold italic">
                      {selectedAddress === 'commercial' ? 'Commercial' : selectedAddress === 'residential' ? 'Residential' : selectedAddress === 'own-setup' ? 'Own Setup' : 'Not selected'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold italic">
                        ${addressPrice}
                      </p>
                      {selectedAddress === 'commercial' || selectedAddress === 'residential' ? (
                        <p className="text-xs text-zinc-500">{isYearly ? '/year' : '/month'}</p>
                      ) : selectedAddress === 'own-setup' ? (
                        <p className="text-xs text-zinc-500">self-managed</p>
                      ) : null}
                    </div>
                    <button onClick={() => goToStep(6)} className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center text-zinc-400"><Pencil size={18} /></button>
                  </div>
                </div>

                {/* total row */}
                <div className="bg-[#11111d] border border-zinc-800/50 p-6 rounded-[24px] flex justify-between items-center mt-4">
                  <div><p className="text-xl font-bold italic">Total</p></div>
                  <div className="flex items-center gap-4">
                    <p className="text-2xl font-bold italic">
                      ${totalPrice.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!userName) {
                    setCheckoutAuthMessage('You must log in with Whop to complete the payment.');
                    return;
                  }

                  setCheckoutAuthMessage('');
                  setIsLoadingCheckout(true);
                  try {
                    console.log(`Preparing checkout: ${selectedPackage} ($${packagePrice}) + ${selectedAddress} ($${addressPrice}) = $${totalPrice}`);

                    // expose the total so the embed UI can display it if needed
                    setCheckoutTotal(totalPrice);

                    const res = await fetch('/api/checkout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        package: selectedPackage,
                        addressType: selectedAddress,
                        isYearly,
                        companyName,
                        selectedState,
                        country: selectedCountry,
                        embed: true,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok && data.sessionId) {
                      console.log('Received embed session id:', data.sessionId);
                      setCheckoutSessionId(data.sessionId);
                      setIsCheckoutVisible(true);
                    } else if (res.ok && data.redirect) {
                      // fallback in case the server still returned a redirect URL
                      console.log('Redirecting to Whop checkout:', data.redirect);
                      window.location.href = data.redirect;
                    } else {
                      alert('Failed to create checkout: ' + (data.error || 'Unknown error'));
                      setIsLoadingCheckout(false);
                    }
                  } catch (err) {
                    alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
                    setIsLoadingCheckout(false);
                  }
                }}
                disabled={isLoadingCheckout || !!checkoutSessionId}
                className="w-full py-6 rounded-2xl bg-[#2a2a3d] border border-zinc-700/50 text-white font-bold text-xl hover:bg-[#35354d] transition-all shadow-2xl active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingCheckout ? 'Creating checkout...' : checkoutSessionId ? 'Checkout ready' : 'Proceed to payment'}
              </button>

              {checkoutAuthMessage && (
                <p className="mt-3 text-center text-sm font-medium text-red-400">
                  {checkoutAuthMessage}
                </p>
              )}

              {checkoutSessionId && (
                <>
                  <div className="mt-8 w-full max-w-lg">
                    <p className="text-center text-lg mb-4">Total price: ${checkoutTotal.toFixed(2)}</p>
                    <button
                      onClick={() => {
                        if (!userName) {
                          setCheckoutAuthMessage('You must log in with Whop to complete the payment.');
                          return;
                        }

                        setCheckoutAuthMessage('');
                        setIsCheckoutVisible(true);
                      }}
                      className="mb-4 px-6 py-3 bg-[#2a2a3d] text-white rounded-xl font-bold"
                    >
                      {isCheckoutVisible ? 'Checkout open' : 'Open checkout'}
                    </button>
                  </div>

                  {isCheckoutVisible && (
                    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
                      <div className="flex justify-end p-4">
                        <button
                          onClick={() => setIsCheckoutVisible(false)}
                          className="text-white text-xl font-bold p-2 rounded-full hover:bg-white/10"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto p-4">
                        <WhopCheckoutEmbed
                          sessionId={checkoutSessionId}
                          returnUrl="http://localhost:3000/checkout/complete"
                          onComplete={(paymentId) => {
                            console.log('Whop payment complete:', paymentId);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-col items-center mt-8 text-center max-w-md">
                <div className="flex items-center gap-2 text-[#4ade80] text-[11px] font-bold mb-2"><Check size={14} /> 7-day money-back guarantee</div>
                <p className="text-zinc-600 text-[10px] italic">on Firstbase fees if services can't proceed or key steps haven't started. Terms and conditions apply.</p>
              </div>
            </div>
          )}
        </div>

        {/* NAVEGACIÓN INFERIOR */}
        <div className="mt-auto flex justify-end items-center gap-3 pt-8">
          <button onClick={back} className="w-12 h-12 rounded-full bg-zinc-800/40 flex items-center justify-center text-zinc-500 hover:text-white transition-all active:scale-90"><ChevronRight className="rotate-180" size={24} /></button>
          {step < 7 && <button onClick={next} disabled={!canProceedToNextStep} className="bg-white text-black px-12 py-4 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-zinc-200 transition-all active:scale-95 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">Next Step <ChevronRight size={18} /></button>}
        </div>
      </div>
    </div>
  );
}