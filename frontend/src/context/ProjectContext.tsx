"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  Project,
  ProjectDetails,
  listProjects,
  createProject,
  deleteProject,
  deletePrediction,
  getProjectDetails,
} from "@/lib/api";

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;
  setActiveProject: (project: Project | null) => void;
  selectProjectById: (id: string) => void;
  fetchProjects: () => Promise<Project[]>;
  createNewProject: (name: string, description?: string) => Promise<Project>;
  removeProject: (projectId: string) => Promise<void>;
  removePrediction: (projectId: string, predictionId: string) => Promise<void>;
  loadProjectDetails: (projectId: string) => Promise<ProjectDetails>;
  refreshActiveProject: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  activeProject: null,
  isLoading: false,
  error: null,
  setActiveProject: () => {},
  selectProjectById: () => {},
  fetchProjects: async () => [],
  createNewProject: async () => {
    throw new Error("ProjectContext not initialized");
  },
  removeProject: async () => {},
  removePrediction: async () => {},
  loadProjectDetails: async () => {
    throw new Error("ProjectContext not initialized");
  },
  refreshActiveProject: async () => {},
});

export const ProjectProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setActiveProject = useCallback((p: Project | null) => {
    setActiveProjectState(p);
    if (p) {
      localStorage.setItem("glass_active_project_id", p.id);
    } else {
      localStorage.removeItem("glass_active_project_id");
    }
  }, []);

  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    if (!token && !user) return [];
    setIsLoading(true);
    setError(null);
    try {
      const data = await listProjects(token);
      const list = data.projects || [];
      setProjects(list);

      // Restore active project only if explicitly selected before
      const savedActiveId = localStorage.getItem("glass_active_project_id");
      if (savedActiveId) {
        const found = list.find((p) => p.id === savedActiveId);
        if (found) {
          setActiveProjectState(found);
        } else {
          setActiveProject(null);
        }
      } else {
        setActiveProject(null);
      }

      return list;
    } catch (err: any) {
      console.error("Failed to fetch projects:", err);
      setError(err?.message || "Failed to load projects");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [token, user, setActiveProject]);

  useEffect(() => {
    if (user || token) {
      fetchProjects();
    } else {
      setProjects([]);
      setActiveProject(null);
    }
  }, [user, token, fetchProjects, setActiveProject]);

  const selectProjectById = useCallback(
    (id: string) => {
      const found = projects.find((p) => p.id === id);
      if (found) {
        setActiveProject(found);
      }
    },
    [projects, setActiveProject]
  );

  const createNewProject = async (name: string, description: string = ""): Promise<Project> => {
    setIsLoading(true);
    setError(null);
    try {
      const newProj = await createProject(name, description, token);
      setProjects((prev) => [newProj, ...prev]);
      setActiveProject(newProj);
      return newProj;
    } catch (err: any) {
      const msg = err?.message || "Failed to create project";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const removeProject = async (projectId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteProject(projectId, token);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (activeProject?.id === projectId) {
        const remaining = projects.filter((p) => p.id !== projectId);
        if (remaining.length > 0) {
          setActiveProject(remaining[0]);
        } else {
          setActiveProject(null);
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to delete project";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const removePrediction = async (projectId: string, predictionId: string): Promise<void> => {
    await deletePrediction(projectId, predictionId, token);
    await refreshActiveProject();
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, predictionCount: Math.max(0, p.predictionCount - 1) }
          : p
      )
    );
  };

  const loadProjectDetails = async (projectId: string): Promise<ProjectDetails> => {
    return await getProjectDetails(projectId, token);
  };

  const refreshActiveProject = async (): Promise<void> => {
    if (!activeProject) return;
    try {
      const details = await getProjectDetails(activeProject.id, token);
      if (details?.project) {
        setActiveProjectState(details.project);
        setProjects((prev) =>
          prev.map((p) => (p.id === details.project.id ? details.project : p))
        );
      }
    } catch (err) {
      console.error("Failed to refresh active project:", err);
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        isLoading,
        error,
        setActiveProject,
        selectProjectById,
        fetchProjects,
        createNewProject,
        removeProject,
        removePrediction,
        loadProjectDetails,
        refreshActiveProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => useContext(ProjectContext);
