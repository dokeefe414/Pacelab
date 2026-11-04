/**
 * Optional authenticated backend transport.
 * Tokens are tab-scoped (sessionStorage); never export them in CSV or localStorage.
 */
const API_URL_KEY = 'pacelab.apiBase.v1';
const TOKEN_KEY = 'pacelab.sessionToken.v1';
let token = sessionStorage.getItem(TOKEN_KEY);
let currentUser = null;

export function getApiBase() {
  const configured = localStorage.getItem(API_URL_KEY);
  if (configured) return configured.replace(/\/$/, '');
  return '/api';
}
export function apiIsConnected() { return Boolean(token && currentUser); }
export function hasSavedSession() { return Boolean(token); }
export function apiUser() { return currentUser; }
export function setApiBase(value) {
  const trimmed = String(value).trim().replace(/\/$/, '');
  if (!trimmed) { localStorage.removeItem(API_URL_KEY); return; }
  if (trimmed === '/api') { localStorage.removeItem(API_URL_KEY); return; }
  const url = new URL(trimmed);
  const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) throw Error('Use an HTTPS API URL, except for local development.');
  if (url.username || url.password || url.search || url.hash) throw Error('API URL must not contain credentials or query parameters.');
  localStorage.setItem(API_URL_KEY, trimmed.endsWith('/api') ? trimmed : trimmed + '/api');
}
export function logout() {
  token = null; currentUser = null;
  sessionStorage.removeItem(TOKEN_KEY);
}
async function request(path, options = {}) {
  const response = await fetch(getApiBase() + path, {
    ...options,
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {}), ...options.headers},
  });
  let data = null;
  try {data = await response.json();} catch { /* 204, proxy error, non-JSON */ }
  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : ('Request failed (HTTP ' + response.status + ')');
    if (response.status === 401 && !path.startsWith('/auth/')) logout();
    throw new Error(detail);
  }
  return data;
}
export async function authenticate(action, email, password) {
  if (!['login','register'].includes(action)) throw Error('Unknown authentication action');
  const result = await request('/auth/' + action, {method: 'POST', body: JSON.stringify({email, password})});
  token = result.access_token;
  currentUser = result.user;
  sessionStorage.setItem(TOKEN_KEY, token);
  return currentUser;
}
export async function restoreSession() {
  if (!token) return null;
  try {currentUser = await request('/auth/me'); return currentUser;}
  catch {logout(); return null;}
}
export async function fetchWorkouts() {
  const result = [];
  let offset = 0;
  while (true) {
    const batch = await request('/workouts?limit=500&offset=' + offset);
    result.push(...batch);
    if (batch.length < 500) break;
    offset += batch.length;
    if (offset > 250000) throw Error('Too many workouts to retrieve automatically.');
  }
  return result;
}
export function createRemoteWorkout(workout) {
  const {date,type,distanceMiles,durationSeconds,notes} = workout;
  return request('/workouts', {method:'POST',body:JSON.stringify({date,type,distanceMiles,durationSeconds,notes})});
}
export function deleteRemoteWorkout(id) {
  return request('/workouts/' + encodeURIComponent(id), {method:'DELETE'});
}

export function requestMLPrediction(features) {
  return request('/predict/ml', {method:'POST',body:JSON.stringify(features)});
}
