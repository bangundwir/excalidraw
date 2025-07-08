import {
  CanvasData,
  CanvasMetadata,
  dehydrateCanvasData,
  hydrateCanvasData,
  IStorageAdapter,
} from "../storage";
import { nanoid } from "nanoid";
import { jwtDecode } from "jwt-decode";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

const API_BASE_URL = "/api/v2/kv";

interface AppJwtPayload {
  sub: string;
}

// The backend uses the GitHub user ID as the subject in the JWT.
// We can decode the token to get this ID for frontend purposes.
function getUserIdFromJwt(token: string): number | null {
  try {
    const decodedToken = jwtDecode<AppJwtPayload>(token);
    if (decodedToken && decodedToken.sub) {
      const userId = parseInt(decodedToken.sub, 10);
      if (!isNaN(userId) && Number.isInteger(userId)) {
        return userId;
      }
    }
    return null;
  } catch (e) {
    console.error("Failed to decode JWT", e);
    return null;
  }
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export class BackendStorageAdapter implements IStorageAdapter {
  async listCanvases(): Promise<CanvasMetadata[]> {
    const response = await fetch(API_BASE_URL, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // For list, we can just return an empty array as if the user has no canvases.
        // This prevents an error popup when a logged-out user opens the app.
        return [];
      }
      throw new Error(`Failed to list canvases: ${response.statusText}`);
    }
    // Backend doesn't send userId, so we enrich the data here.
    const canvases: Omit<CanvasMetadata, "userId">[] = await response.json();
    const token = localStorage.getItem("token");
    if (!token) {
      return [];
    }
    const userId = getUserIdFromJwt(token);
    if (!userId) {
      console.error("Could not determine userId from token.");
      return [];
    }

    return canvases.map((canvas) => ({ ...canvas, userId }));
  }

  async loadCanvas(id: string): Promise<CanvasData | null> {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError("User is not authenticated");
      }
      throw new Error(`Failed to load canvas: ${response.statusText}`);
    }
    const rawData = await response.json();
    return hydrateCanvasData(rawData);
  }

  async saveCanvas(id: string, data: CanvasData): Promise<void> {
    const saveData = dehydrateCanvasData(data);

    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(saveData),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError("User is not authenticated");
      }
      throw new Error(`Failed to save canvas:  ${response.statusText}`);
    }
  }

  async createCanvas(data: CanvasData): Promise<CanvasMetadata> {
    const newId = nanoid();
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authentication token not found.");
    }
    const userId = getUserIdFromJwt(token);
    if (!userId) {
      throw new Error("Could not parse user ID from token.");
    }

    await this.saveCanvas(newId, data);
    return {
      id: newId,
      name: data.appState?.name || "Untitled",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId,
    };
  }

  async deleteCanvas(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError("User is not authenticated");
      }
      throw new Error(`Failed to delete canvas: ${response.statusText}`);
    }
  }

  async renameCanvas(id: string, newName: string): Promise<void> {
    const canvasData = await this.loadCanvas(id);
    if (!canvasData) {
      throw new Error("Canvas not found, cannot rename.");
    }

    const updatedData: CanvasData = {
      ...canvasData,
      appState: {
        ...canvasData.appState,
        name: newName,
      },
    };

    await this.saveCanvas(id, updatedData);
  }
}
