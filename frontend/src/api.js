// In dev: API_BASE is empty — Vite proxy forwards /user, /wallet etc. to localhost:8080
// In production: VITE_API_BASE points to Render deployment URL
export const API_BASE = import.meta.env.VITE_API_BASE || '';

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}