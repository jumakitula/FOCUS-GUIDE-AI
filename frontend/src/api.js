import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  withCredentials: false,
});

export async function checkFocus(userEmail, accessToken, settings) {
  const res = await api.post("/focus/check", {
    user_email: userEmail,
    access_token: accessToken,
    user_settings: settings || null,
  });
  return res.data;
}

export async function getActiveSession(userEmail) {
  const res = await api.get(`/focus/active/${userEmail}`);
  return res.data;
}

export async function getSessionHistory(userEmail, limit = 10) {
  const res = await api.get(`/focus/history/${userEmail}`, {
    params: { limit },
  });
  return res.data.history || [];
}

export async function endSession(sessionId) {
  const res = await api.post("/focus/end", { session_id: sessionId });
  return res.data;
}

export async function getSettings(userEmail) {
  const res = await api.get(`/settings/${userEmail}`);
  return res.data.settings;
}

export async function saveSettings(userEmail, settings) {
  const res = await api.post("/settings/save", {
    user_email: userEmail,
    settings,
  });
  return res.data;
}

export default api;
