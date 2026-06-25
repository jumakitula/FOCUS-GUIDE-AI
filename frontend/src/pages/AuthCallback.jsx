import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");

    if (err) {
      setError(`Authentication failed: ${err}`);
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    const email = params.get("email");
    const name = params.get("name");
    const picture = params.get("picture");
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!email || !access_token) {
      setError("Missing credentials from Google. Please try again.");
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    const user = { email, name, picture, access_token, refresh_token };
    localStorage.setItem("focusguard_user", JSON.stringify(user));
    navigate("/", { replace: true });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-center px-6">
        <div>
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-400 text-lg font-medium mb-2">Auth Error</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <p className="text-slate-600 text-xs mt-4">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-spin">⚙️</div>
        <p className="text-slate-400">Completing sign-in…</p>
      </div>
    </div>
  );
}
