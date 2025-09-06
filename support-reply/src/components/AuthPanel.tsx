"use client";

import { useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";

interface AuthPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

type AuthMode = 'signin' | 'signup';

export default function AuthPanel({ isOpen, onClose, onAuthSuccess }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  // Initialize Supabase client with error handling
  let supabase: ReturnType<typeof createClientComponentClient> | null = null;
  try {
    supabase = createClientComponentClient();
    // Supabase client ready
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }

  const validateForm = () => {
    if (!email || !password) {
      setMessage("Please fill in all fields.");
      return false;
    }
    
    if (mode === 'signup' && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return false;
    }
    
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters long.");
      return false;
    }
    
    return true;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !supabase) return;
    
    setIsLoading(true);
    setMessage("");
    
    try {
      // Attempting sign up
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password
      });
      
      // Handle sign up response
      
      if (error) {
        throw error;
      }
      
      if (data.user) {
        setMessage("Account created successfully! You are now signed in.");
        // Don't close immediately - let the auth state change listener handle the UI update
        // The modal will close when the parent component detects the auth state change
      } else {
        setMessage("Account created! Please check your email to confirm your account.");
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      setMessage(error.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !supabase) return;
    
    setIsLoading(true);
    setMessage("");
    
    try {
      // Attempting sign in
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      
      // Handle sign in response
      
      if (error) {
        throw error;
      }
      
      if (data.user) {
        setMessage("Signed in successfully!");
        // Don't close immediately - let the auth state change listener handle the UI update
        // The modal will close when the parent component detects the auth state change
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      setMessage(error.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (mode === 'signup') {
      handleSignUp(e);
    } else {
      handleSignIn(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="text-xl">×</span>
          </button>
        </div>

        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'signin'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading 
                ? (mode === 'signin' ? "Signing in..." : "Creating account...") 
                : (mode === 'signin' ? "Sign In" : "Sign Up")
              }
            </button>
          </form>

          {/* Message */}
          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes("successfully") || message.includes("created")
                ? "bg-green-50 text-green-700 border border-green-200" 
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
