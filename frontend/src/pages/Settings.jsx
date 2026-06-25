import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSettings, saveSettings } from "../api";

function TagList({ items, onRemove, onAdd, placeholder }) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const val = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (val && !items.includes(val)) {
      onAdd(val);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
        {items.map((item) => (
          <span
            key={item}
            className="bg-slate-700 text-slate-200 text-sm px-3 py-1 rounded-full flex items-center gap-2"
          >
            {item}
            <button
              onClick={() => onRemove(item)}
              className="text-slate-400 hover:text-red-400 transition-colors leading-none"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={placeholder}
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleAdd}
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({
    blocked_sites: [],
    emergency_sites: [],
    trigger_intensity: "medium",
    advance_minutes: 15,
  });
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("focusguard_settings");
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
        return;
      } catch {}
    }
    const user = JSON.parse(localStorage.getItem("focusguard_user") || "{}");
    if (user?.email) {
      getSettings(user.email)
        .then((s) => setSettings(s))
        .catch(() => {});
    }
  }, []);

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const addSite = (key) => (site) => update(key, [...settings[key], site]);
  const removeSite = (key) => (site) =>
    update(key, settings[key].filter((s) => s !== site));

  const handleSave = async () => {
    setSaving(true);
    const user = JSON.parse(localStorage.getItem("focusguard_user") || "{}");
    try {
      await saveSettings(user.email, settings);
      localStorage.setItem("focusguard_settings", JSON.stringify(settings));
      setToast({ type: "success", msg: "Settings saved!" });
    } catch {
      setToast({ type: "error", msg: "Failed to save. Check backend connection." });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-xl text-sm font-medium shadow-lg z-50 transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-slate-400 hover:text-white transition-colors text-sm">
            ← Dashboard
          </Link>
          <span className="text-slate-700">|</span>
          <span className="font-bold text-slate-100">Settings</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Blocked Sites */}
        <section className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
          <h2 className="font-bold text-lg text-white mb-1">Blocked Sites</h2>
          <p className="text-slate-400 text-sm mb-4">
            These sites will be blocked during active focus sessions.
          </p>
          <TagList
            items={settings.blocked_sites}
            onAdd={addSite("blocked_sites")}
            onRemove={removeSite("blocked_sites")}
            placeholder="instagram.com"
          />
        </section>

        {/* Emergency Apps */}
        <section className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
          <h2 className="font-bold text-lg text-white mb-1">
            Emergency Apps (Always Allowed)
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            These sites are never blocked, even during focus mode.
          </p>
          <TagList
            items={settings.emergency_sites}
            onAdd={addSite("emergency_sites")}
            onRemove={removeSite("emergency_sites")}
            placeholder="gmail.com"
          />
        </section>

        {/* Trigger Settings */}
        <section className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h2 className="font-bold text-lg text-white">Focus Trigger Settings</h2>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Minimum focus intensity to trigger
            </label>
            <select
              value={settings.trigger_intensity}
              onChange={(e) => update("trigger_intensity", e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Activate focus mode X minutes before event
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={settings.advance_minutes}
              onChange={(e) =>
                update("advance_minutes", parseInt(e.target.value, 10) || 15)
              }
              className="w-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-slate-400 text-sm ml-2">minutes</span>
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </main>
    </div>
  );
}
