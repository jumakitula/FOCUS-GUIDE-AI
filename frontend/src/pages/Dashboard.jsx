import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import CountdownTimer from "../components/CountdownTimer";
import { checkFocus, getActiveSession, endSession, getSessionHistory } from "../api";

function IntensityBadge({ intensity }) {
  const colors = {
    low: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    high: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return (
    <span
      className={`text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full border ${
        colors[intensity] || colors.medium
      }`}
    >
      {intensity} intensity
    </span>
  );
}

function HistoryRow({ session }) {
  const start = new Date(session.start_time);
  const badge = {
    low: "text-blue-400",
    medium: "text-yellow-400",
    high: "text-red-400",
  }[session.focus_intensity] || "text-slate-400";

  return (
    <div className="bg-slate-800/50 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`text-xs font-bold uppercase ${badge}`}>
          {session.focus_intensity}
        </span>
        <span className="text-slate-200 text-sm truncate">{session.event_title}</span>
      </div>
      <span className="text-slate-500 text-xs shrink-0">
        {isNaN(start)
          ? "—"
          : start.toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("focusguard_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("focusguard_user");
      }
    }
  }, []);

  const fetchHistory = useCallback(async (email) => {
    setHistoryLoading(true);
    try {
      const items = await getSessionHistory(email, 10);
      setHistory(items);
    } catch {
      // history is optional — silently ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchActive = useCallback(async (email) => {
    try {
      const data = await getActiveSession(email);
      setSession(data?.is_active ? data : null);
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    fetchActive(user.email);
    fetchHistory(user.email);
    const id = setInterval(() => fetchActive(user.email), 60000);
    return () => clearInterval(id);
  }, [user, fetchActive, fetchHistory]);

  const showNotice = (msg, type = "info") => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleCheckNow = async () => {
    if (!user) return;
    setChecking(true);
    setNotice(null);
    try {
      const settings = JSON.parse(
        localStorage.getItem("focusguard_settings") || "null"
      );
      const data = await checkFocus(user.email, user.access_token, settings);
      if (data.session?.is_active) {
        setSession(data.session);
        fetchHistory(user.email);
        showNotice("Focus session activated!", "success");
      } else {
        setSession(null);
        showNotice(data.message || "No focus session needed right now.", "info");
      }
    } catch (err) {
      showNotice(
        err?.response?.data?.detail || "Failed to check. Is the backend running?",
        "error"
      );
    } finally {
      setChecking(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    setLoading(true);
    try {
      await endSession(session.session_id);
      setSession(null);
      fetchHistory(user.email);
      showNotice("Session ended.", "info");
    } catch {
      showNotice("Failed to end session.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("focusguard_user");
    window.location.href = "/login";
  };

  const noticeColors = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-slate-700",
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Toast */}
      {notice && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all ${
            noticeColors[notice.type]
          }`}
        >
          {notice.msg}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <span className="font-bold text-slate-100">FocusGuard AI</span>
        </div>
        <nav className="flex items-center gap-4 text-sm text-slate-400">
          {user?.picture && (
            <img
              src={user.picture}
              alt={user.name}
              className="w-7 h-7 rounded-full hidden sm:block"
            />
          )}
          {user && (
            <span className="hidden sm:block text-slate-300 max-w-[160px] truncate">
              {user.name || user.email}
            </span>
          )}
          <Link to="/settings" className="hover:text-white transition-colors">
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="hover:text-white transition-colors"
          >
            Logout
          </button>
        </nav>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Status card */}
        {session ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-8 text-center shadow-lg shadow-green-500/5">
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 font-bold uppercase tracking-widest text-xs">
                Focus Mode Active
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">
              {session.event_title}
            </h2>

            <div className="flex items-center justify-center gap-3 mb-6">
              <IntensityBadge intensity={session.focus_intensity} />
            </div>

            <div className="text-5xl font-extrabold mb-1">
              <CountdownTimer endTime={session.end_time} />
            </div>
            <p className="text-slate-500 text-sm mb-6">remaining</p>

            {session.ai_reason && (
              <div className="bg-slate-800/60 rounded-xl px-4 py-3 text-slate-300 text-sm mb-6 text-left border border-slate-700/50">
                <span className="text-slate-500 text-xs uppercase tracking-widest block mb-1">
                  AI Reasoning
                </span>
                {session.ai_reason}
              </div>
            )}

            {session.blocked_sites?.length > 0 && (
              <div className="text-left mb-6">
                <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">
                  Blocked Sites ({session.blocked_sites.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {session.blocked_sites.map((site) => (
                    <span
                      key={site}
                      className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-md border border-slate-700"
                    >
                      {site}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleEndSession}
              disabled={loading}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-lg"
            >
              {loading ? "Ending…" : "End Session Early"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-10 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">All Clear</h2>
            <p className="text-slate-400 text-sm">
              No active focus session. Click below to analyze your calendar now.
            </p>
          </div>
        )}

        {/* Check Now */}
        <div className="text-center">
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
          >
            {checking ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Analyzing Calendar…
              </span>
            ) : (
              "Check Now"
            )}
          </button>
        </div>

        {/* Session history */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-500 text-xs uppercase tracking-widest">
              Recent Sessions
            </h3>
            {historyLoading && (
              <span className="text-slate-600 text-xs">Loading…</span>
            )}
          </div>

          {!historyLoading && history.length === 0 && (
            <div className="text-center py-8 text-slate-600 text-sm">
              No sessions yet — run your first check above.
            </div>
          )}

          <div className="space-y-2">
            {history.map((s) => (
              <HistoryRow key={s.session_id} session={s} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
