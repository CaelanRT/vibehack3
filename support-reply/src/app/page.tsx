"use client";

import { useState } from "react";
import ReplyCard from "../components/ReplyCard";

type Tone = "friendly" | "professional" | "concise";

export default function Home() {
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [isLoading, setIsLoading] = useState(false);
  const [drafts, setDrafts] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (message.length < 10) return;
    
    setIsLoading(true);
    // TODO: Implement API call to /api/generate
    setTimeout(() => {
      setDrafts([
        "Thank you for reaching out! I understand your concern and I'm here to help resolve this issue for you.",
        "I appreciate you taking the time to contact us. Let me look into this matter and get back to you with a solution.",
        "Thanks for your message. I'll investigate this and provide you with an update shortly."
      ]);
      setIsLoading(false);
    }, 2000);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header with subtle background */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 max-w-6xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Support Reply Suggestor</h1>
            </div>
            <div className="hidden md:flex items-center space-x-4 text-sm text-gray-600">
              <span>✨ AI-Powered</span>
              <span>⚡ Fast</span>
              <span>🔒 Private</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Generate Perfect Support Replies
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
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
            disabled={message.length < 10 || isLoading}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                Generating your replies...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <span>🚀</span>
                <span className="ml-2">Generate Replies</span>
              </div>
            )}
          </button>
        </div>

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
        ) : (
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
    </div>
  );
}
