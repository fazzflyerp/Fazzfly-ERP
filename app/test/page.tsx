"use client";

import { useEffect, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function TestPage() {
  const { data: session, status } = useSession();
  const [apiResult, setApiResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const testAPI = async () => {
    try {
      setLoading(true);
      setError("");
      
      const response = await fetch('/api/user/modules');
      const data = await response.json();
      
      setApiResult(data);
      
      if (!response.ok) {
        setError(`Error ${response.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setError(`Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-800 mb-8">
          🧪 API Testing Page
        </h1>

        {/* Session Status */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            1️⃣ Session Status
          </h2>
          
          {status === "loading" && (
            <p className="text-slate-600">Loading session...</p>
          )}
          
          {status === "unauthenticated" && (
            <div>
              <p className="text-red-600 mb-4">❌ Not logged in</p>
              <button
                onClick={() => signIn("google")}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Login with Google
              </button>
            </div>
          )}
          
          {status === "authenticated" && session && (
            <div>
              <p className="text-green-600 font-semibold mb-2">
                ✅ Logged in
              </p>
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-slate-600">
                  <strong>Email:</strong> {session.user?.email}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Name:</strong> {session.user?.name}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Access Token:</strong> {(session as any).accessToken ? '✅ Available' : '❌ Missing'}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* API Test */}
        {status === "authenticated" && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              2️⃣ Test API: Get User Modules
            </h2>
            
            <button
              onClick={testAPI}
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {loading ? "Testing..." : "🚀 Test API"}
            </button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-700 font-semibold">❌ Error:</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {apiResult && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-bold text-slate-800 mb-2">
                  API Response:
                </h3>
                <pre className="text-xs overflow-auto bg-slate-900 text-green-400 p-4 rounded">
                  {JSON.stringify(apiResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Environment Check */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            3️⃣ Environment Variables
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-slate-600">
              <strong>MASTER_SHEET_ID:</strong>{' '}
              {process.env.NEXT_PUBLIC_MASTER_SHEET_ID || '❌ Not set (add NEXT_PUBLIC_MASTER_SHEET_ID)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}