"use client";

import { useState, useEffect } from "react";
import ReplyCard from "../components/ReplyCard";
import AuthPanel from "../components/AuthPanel";
import { createClientComponentClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";

type Tone = "friendly" | "professional" | "concise";

export default function Home() {
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [isLoading, setIsLoading] = useState(false);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [quota, setQuota] = useState<{
    limit: number | null;
    used: number;
    remaining: number | null;
    pro: boolean;
  } | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const handleGenerate = async () => {
    if (message.length < 10) return;
    
    setIsLoading(true);
    setError(null);
    
    // Check auth state before making API call
    console.log('Generating reply for user:', user ? user.email : 'anonymous');
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // This is crucial for sending auth cookies
        body: JSON.stringify({
          message: message.trim(),
          tone: tone.charAt(0).toUpperCase() + tone.slice(1), // Convert to proper case
          language: 'Auto'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle quota exceeded (429)
        if (response.status === 429 && errorData.error === 'DAILY_LIMIT_REACHED') {
          setIsQuotaExceeded(true);
          setError('QUOTA_EXCEEDED');
          setDrafts([]);
          return;
        }
        
        // Handle specific server configuration error
        if (errorData.code === 'MISSING_API_KEY') {
          throw new Error('MISSING_CONFIG');
        }
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.drafts || !Array.isArray(data.drafts)) {
        throw new Error('Invalid response format');
      }

      setDrafts(data.drafts);
      setError(null);
      setIsQuotaExceeded(false);
      
      // Update quota information from response
      if (data.quota) {
        setQuota(data.quota);
      }
    } catch (err: any) {
      console.error('Generate error:', err);
      // Handle specific error types
      if (err.message === 'MISSING_CONFIG') {
        setError('MISSING_CONFIG');
      } else {
        setError(err.message || 'Failed to generate replies. Please try again.');
      }
      setDrafts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    handleGenerate();
  };

  // Auth functions
  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent multiple clicks
    
    setIsSigningOut(true);
    try {
      // Add timeout to prevent hanging
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => resolve('timeout'), 5000)
      );
      
      const result = await Promise.race([signOutPromise, timeoutPromise]);
      
      if (result === 'timeout') {
        console.log('Sign out timed out, forcing state reset');
        // Force state reset if sign out times out
        setUser(null);
        setIsPro(false);
        setQuota(null);
        setIsQuotaExceeded(false);
      }
      // If sign out succeeded, let the auth state change listener handle state updates
    } catch (error) {
      console.error('Error signing out:', error);
      // Force state reset if sign out fails
      setUser(null);
      setIsPro(false);
      setQuota(null);
      setIsQuotaExceeded(false);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthPanelOpen(false);
  };

  const handleSignInClick = () => {
    setIsAuthPanelOpen(true);
  };

  const handleUpgradeClick = async () => {
    if (isUpgrading) return;
    
    setIsUpgrading(true);
    setUpgradeError(null);
    
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.status === 401) {
        setUpgradeError('Sign in to upgrade');
        setIsAuthPanelOpen(true);
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific error types
        if (errorData.error === 'CONFIG_ERROR') {
          setUpgradeError('Upgrade temporarily unavailable. Please try again later.');
          return;
        }
        
        throw new Error(errorData.message || 'Failed to create checkout session');
      }
      
      const { url } = await response.json();
      window.location.href = url;
      
    } catch (error: any) {
      console.error('Upgrade error:', error);
      setUpgradeError(error.message || 'Failed to start upgrade process');
    } finally {
      setIsUpgrading(false);
    }
  };

  const renderQuotaDisplay = () => {
    if (!quota) return null;

    const { limit, used, remaining, pro } = quota;

    if (pro) {
      return (
        <div className="text-center text-sm text-gray-600 mt-2">
          Pro: Unlimited today
        </div>
      );
    }

    if (user) {
      // Signed-in Free user
      return (
        <div className="text-center text-sm text-gray-600 mt-2">
          Free: {used}/{limit} today.{' '}
          <button
            onClick={handleUpgradeClick}
            className="text-orange-600 hover:text-orange-700 underline"
          >
            Upgrade for unlimited
          </button>
        </div>
      );
    } else {
      // Anonymous user
      return (
        <div className="text-center text-sm text-gray-600 mt-2">
          Free anonymous: {used}/{limit} today.{' '}
          <button
            onClick={handleSignInClick}
            className="text-orange-600 hover:text-orange-700 underline"
          >
            Sign in for 20/day
          </button>
        </div>
      );
    }
  };

  // Check auth state on mount
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          return;
        }
        
        console.log('Session loaded:', session ? session.user.email : 'No session');
        setUser(session?.user || null);
        
        // Reset quota state on initial load
        setQuota(null);
        setIsQuotaExceeded(false);
        
        if (session?.user) {
          await fetchUserProfile(session.user);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
      }
    };

    // Function to fetch user profile
    const fetchUserProfile = async (user: any) => {
      try {
        // Fetch user profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('pro')
          .eq('user_id', user.id)
          .single();
      
        if (error) {
          // Handle specific error cases
          if (error.code === 'PGRST116') {
            // Profile doesn't exist - this is normal for new users
            // Profile will be created on first generation
            setIsPro(false);
          } else {
            // Log more detailed error information
            console.error('Error fetching profile:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint
            });
            setIsPro(false);
          }
        } else {
          const proStatus = (profile as any)?.pro || false;
          console.log('Profile fetched - Pro status:', proStatus);
          setIsPro(proStatus);
        }
      } catch (error) {
        console.error('Error in fetchUserProfile:', error);
        setIsPro(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        console.log('Auth state changed:', event, session?.user?.email || 'signed out');
        setUser(session?.user || null);
        
        // Close auth panel if user successfully signed in
        if (event === 'SIGNED_IN' && session?.user) {
          setIsAuthPanelOpen(false);
        }
        
        // Reset quota state on auth changes
        setQuota(null);
        setIsQuotaExceeded(false);
        
        if (session?.user) {
          // Create or get profile when user signs in
          try {
            // Fetch profile for signed-in user
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('pro')
              .eq('user_id', session.user.id)
              .single();
            
            // Handle profile fetch result
            
            if (profileError && profileError.code === 'PGRST116') {
              // Profile doesn't exist, create it
              const { error: insertError } = await (supabase as any)
                .from('profiles')
                .insert({
                  user_id: session.user.id,
                  email: session.user.email,
                  pro: false,
                  created_at: new Date().toISOString()
                });
              
              if (insertError) {
                console.error('Error creating profile:', {
                  code: insertError.code || 'unknown',
                  message: insertError.message || 'No message',
                  details: insertError.details || 'No details',
                  hint: insertError.hint || 'No hint'
                });
              }
              setIsPro(false);
            } else if (profileError) {
              // Other profile errors
              console.error('Error fetching profile in auth change:', {
                code: profileError.code || 'unknown',
                message: profileError.message || 'No message',
                details: profileError.details || 'No details',
                hint: profileError.hint || 'No hint'
              });
              setIsPro(false);
            } else if (profile) {
              const proStatus = (profile as any).pro || false;
              console.log('Auth change - Profile fetched - Pro status:', proStatus);
              setIsPro(proStatus);
            } else {
              setIsPro(false);
            }
          } catch (error) {
            console.error('Error handling profile:', error);
            setIsPro(false);
          }
        } else {
          setIsPro(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header with subtle background */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 max-w-6xl">
          <div className="flex items-center justify-between">
            {/* Left: SupportGen logo + wordmark */}
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/supportgein-logo.png"
                alt="SupportGen"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
              <h1 className="text-xl font-bold text-gray-900">SupportGen</h1>
            </Link>
            
            {/* Right: Auth state + Pro badge + Upgrade + Sign out */}
            <div className="flex items-center space-x-3">
              {isPro && (
                <span className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                  Pro
                </span>
              )}
              {!isPro && (
                <button
                  onClick={handleUpgradeClick}
                  disabled={isUpgrading}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-medium rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {isUpgrading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Upgrading...
                    </div>
                  ) : (
                    '✨ Upgrade to Pro'
                  )}
                </button>
              )}
              {user ? (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-700">Signed in as {user.email}</span>
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSigningOut ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent mr-1"></div>
                        Signing out...
                      </div>
                    ) : (
                      'Sign out'
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthPanelOpen(true)}
                  className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Error Display */}
      {upgradeError && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="container mx-auto px-4 py-3 max-w-6xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-red-600 mr-2">⚠️</span>
                <span className="text-sm text-red-800">{upgradeError}</span>
              </div>
              <button
                onClick={() => setUpgradeError(null)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section - Title and Main Form */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Generate Perfect Support Replies
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Transform customer messages into professional, tone-perfect responses in seconds. 
            Save time and maintain consistency across your support team.
          </p>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8">
          {/* Customer Message Input */}
          <div className="mb-8">
            <label htmlFor="message" className="block text-sm font-semibold text-gray-900 mb-3">
              Customer Message
            </label>
            <div className="relative">
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Paste the customer's message here... (e.g., 'I'm having trouble with my order and it's been 3 days since I placed it. Can you help?')"
                className="w-full h-40 p-4 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all duration-200 text-gray-900 placeholder-gray-400"
                maxLength={2500}
              />
              <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white px-2 py-1 rounded">
                {message.length}/2500
              </div>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className={`text-sm ${message.length < 10 ? "text-red-500" : "text-green-600"}`}>
                {message.length < 10 ? "⚠️ Minimum 10 characters required" : "✅ Ready to generate"}
              </span>
            </div>
          </div>

          {/* Tone Selection */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-900 mb-4">Reply Tone</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { value: "friendly", label: "Friendly", description: "Warm and approachable" },
                { value: "professional", label: "Professional", description: "Formal and polished" },
                { value: "concise", label: "Concise", description: "Brief and direct" }
              ].map((option) => (
                <label key={option.value} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="tone"
                    value={option.value}
                    checked={tone === option.value}
                    onChange={(e) => setTone(e.target.value as Tone)}
                    className="sr-only"
                  />
                  <div className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    tone === option.value 
                      ? "border-orange-500 bg-orange-50 shadow-md" 
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}>
                    <div className="flex items-center mb-2">
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                        tone === option.value 
                          ? "border-orange-500 bg-orange-500" 
                          : "border-gray-300"
                      }`}>
                        {tone === option.value && (
                          <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                        )}
                      </div>
                      <span className="font-medium text-gray-900">{option.label}</span>
                    </div>
                    <p className="text-sm text-gray-600 ml-7">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={message.length < 10 || isLoading || isQuotaExceeded}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                Generating your replies...
              </div>
            ) : isQuotaExceeded ? (
              <div className="flex items-center justify-center">
                <span>⏰</span>
                <span className="ml-2">Daily Limit Reached</span>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <span>🚀</span>
                <span className="ml-2">Generate Replies</span>
              </div>
            )}
          </button>
          
          {/* Quota Display */}
          {renderQuotaDisplay()}
          
          {/* Inline Configuration Error */}
          {error === 'MISSING_CONFIG' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-yellow-600 mr-2">⚠️</span>
                <span className="text-sm text-yellow-800">
                  Missing server configuration
                </span>
              </div>
            </div>
          )}

          {/* Quota Exceeded Error */}
          {error === 'QUOTA_EXCEEDED' && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-orange-600 mr-2">⏰</span>
                  <span className="text-sm font-medium text-orange-800">
                    Daily limit reached
                  </span>
                </div>
                <p className="text-sm text-orange-700 mb-3">
                  {user 
                    ? "You've used all your free generations today. Upgrade for unlimited access."
                    : "You've used all your anonymous generations today. Sign in for 20/day or upgrade for unlimited."
                  }
                </p>
                <div className="flex justify-center space-x-3">
                  {user ? (
                    <button
                      onClick={handleUpgradeClick}
                      className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Upgrade Now
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSignInClick}
                        className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={handleUpgradeClick}
                        className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Upgrade
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && error !== 'MISSING_CONFIG' && error !== 'QUOTA_EXCEEDED' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-red-500 text-xl">⚠️</span>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800 mb-2">
                  Failed to Generate Replies
                </h3>
                <p className="text-sm text-red-700 mb-4">
                  {error}
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Retrying...' : 'Try Again'}
                  </button>
                  <button
                    onClick={() => setError(null)}
                    className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {drafts.length > 0 ? (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Generated Replies</h2>
              <p className="text-gray-600">Choose the best reply and copy it to your clipboard</p>
            </div>
            <div className="grid gap-6">
              {drafts.map((draft, index) => (
                <ReplyCard key={index} text={draft} index={index} />
              ))}
            </div>
          </div>
        ) : !error && (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Ready to Generate Replies
              </h3>
              <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                Paste a customer message above, select your preferred tone, and click 
                <span className="font-medium text-orange-600"> Generate Replies</span> to get 
                three AI-powered response options.
              </p>
              <div className="mt-6 flex items-center justify-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                  <span>3 reply options</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                  <span>Copy with one click</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                  <span>Under 150 words each</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Marketing blocks - Only for signed-out users */}
        {!user && (
          <>
            {/* Benefits Section */}
            <div className="mt-20 mb-16">
              <h3 className="text-2xl font-semibold text-gray-900 text-center mb-12">Benefits</h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Consistent tone</h4>
                  <p className="text-gray-600">Maintain your brand voice across every customer interaction.</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Faster replies</h4>
                  <p className="text-gray-600">Generate professional responses in seconds, not minutes.</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🔒</span>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">No data stored</h4>
                  <p className="text-gray-600">Your messages are processed and discarded immediately.</p>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="mb-16">
              <h3 className="text-2xl font-semibold text-gray-900 text-center mb-12">How it works</h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold mb-4 mx-auto">1</div>
                  <h4 className="font-semibold text-gray-900 mb-3">Paste customer message</h4>
                  <p className="text-gray-600 text-sm">Copy and paste any customer inquiry or complaint.</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold mb-4 mx-auto">2</div>
                  <h4 className="font-semibold text-gray-900 mb-3">Choose your tone</h4>
                  <p className="text-gray-600 text-sm">Select friendly, professional, or concise response style.</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold mb-4 mx-auto">3</div>
                  <h4 className="font-semibold text-gray-900 mb-3">Get 3 drafts</h4>
                  <p className="text-gray-600 text-sm">Receive three different response options to choose from.</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Pricing Footer - Only for signed-out users */}
        {!user && (
          <div className="mt-16 text-center">
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Pricing</h3>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Free:</span> 5/day · <span className="font-medium">Pro:</span> Unlimited
              </p>
            </div>
          </div>
        )}

        {/* Privacy Footer */}
        <footer className="mt-16 text-center">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-center mb-2">
              <span className="text-green-500 mr-2">🔒</span>
              <span className="font-medium text-gray-900">Your Privacy is Protected</span>
            </div>
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              We don't store your messages. They're sent to our AI provider to generate replies, then immediately discarded. 
              Your data never leaves our secure processing pipeline.
            </p>
          </div>
        </footer>
      </div>

      {/* Auth Panel */}
      <AuthPanel
        isOpen={isAuthPanelOpen}
        onClose={() => setIsAuthPanelOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
