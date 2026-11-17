import { auth } from "./firebase";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function call(path: string, init: { method?: string; body?: string } = {}, token?: string | null) {
  // Signed in with Google? Ask Firebase for a fresh token (it renews them automatically).
  // Otherwise use the token we were given (the dev login).
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : token;
  const res = await fetch(API + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);
  return data;
}

export const getBankSummary = () => call("/api/v1/bank/summary");

// Tells the backend "this person just signed in": it saves their name and email.
export const recordLogin = (token: string | null) => call("/api/v1/auth/me", {}, token);

// "mol" = mol %, "wt" = weight %. The backend converts weight % to mol % itself.
export type CompositionBasis = "mol" | "wt";

// Returns every value in Kelvin; the page converts to °C for display.
export const predictProperties = (
  composition: Record<string, number>,
  basis: CompositionBasis,
  model: string,
  properties: string[],
  token: string | null,
) =>
  call("/api/v1/predict", {
    method: "POST",
    // The page uses "ALL" for "every model"; the backend wants no model name for that.
    body: JSON.stringify({
      composition,
      composition_basis: basis,
      model_name: model === "ALL" ? null : model,
      properties,
    }),
  }, token);

export const discoverCompositions = (targetTg: number, tolerance: number, model: string, token: string | null) =>
  call("/api/v1/zen/discover", {
    method: "POST",
    body: JSON.stringify({ target_tg: targetTg, tolerance, model_name: model }),
  }, token);