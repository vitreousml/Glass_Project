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

export interface BankQueryResult {
  oxides: string[];
  properties: string[];
  total: number;
  rows: Record<string, number | null>[];
  unit_info: Record<string, string>;
  composition_basis: string;
}

export const queryBankData = (
  oxides: string[],
  properties: string[],
  token?: string | null,
): Promise<BankQueryResult> =>
  call("/api/v1/bank/query", {
    method: "POST",
    body: JSON.stringify({ oxides, properties }),
  }, token);

// Tells the backend "this person just signed in": it saves their name and email.
export const recordLogin = (token: string | null) => call("/api/v1/auth/me", {}, token);

export type Position = "student" | "faculty" | "industry" | "other";

// Asked once, right after a new account's first sign-in.
export interface ProfileDetails {
  university: string;
  position: Position;
  position_other?: string; // when position is "other"
  course?: string; // when position is "student"
}

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  university?: string;
  position?: Position;
  positionOther?: string;
  course?: string;
  profileComplete: boolean;
  recorded: boolean;
}

export const getProfile = (token: string | null): Promise<UserProfile> => call("/api/v1/auth/profile", {}, token);

export const saveProfile = (details: ProfileDetails, token: string | null): Promise<UserProfile> =>
  call("/api/v1/auth/profile", { method: "PUT", body: JSON.stringify(details) }, token);

// "mol" = mol %, "wt" = weight %. The backend converts weight % to mol % itself.
export type CompositionBasis = "mol" | "wt";

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: string;
  predictionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PredictionRecord {
  id: string;
  projectId: string;
  projectName: string;
  userId: string;
  composition: Record<string, number>;
  compositionBasis: CompositionBasis;
  compositionMolPercent: Record<string, number>;
  selectedModel: string;
  properties: string[];
  results: {
    property: string;
    model: string;
    value: number; // Kelvin
    unit: string;
    warnings: string[];
  }[];
  createdAt: string;
}

export interface ProjectDetails {
  project: Project;
  predictions: PredictionRecord[];
}

// Project APIs
export const listProjects = (token?: string | null): Promise<{ projects: Project[]; total: number }> =>
  call("/api/v1/projects", { method: "GET" }, token);

export const createProject = (name: string, description: string = "", token?: string | null): Promise<Project> =>
  call("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  }, token);

export const getProjectDetails = (projectId: string, token?: string | null): Promise<ProjectDetails> =>
  call(`/api/v1/projects/${projectId}`, { method: "GET" }, token);

export const deleteProject = (projectId: string, token?: string | null): Promise<{ success: boolean; deletedProjectId: string; deletedPredictionsCount: number; message: string }> =>
  call(`/api/v1/projects/${projectId}`, { method: "DELETE" }, token);

// Returns every value in Kelvin; the page converts to °C for display.
// Mandatorily associated with a project.
export const predictProperties = (
  projectId: string,
  composition: Record<string, number>,
  basis: CompositionBasis,
  model: string,
  properties: string[],
  token: string | null,
) =>
  call("/api/v1/predict", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
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
