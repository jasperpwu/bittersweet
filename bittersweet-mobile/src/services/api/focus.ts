import { client, ApiResponse } from './client';

interface FocusSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  targetDuration: number;
  category: string;
  tags: string[];
  isCompleted: boolean;
  isPaused: boolean;
  pausedAt?: Date;
  resumedAt?: Date;
  totalPauseTime: number;
  seedsEarned: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateSessionData {
  targetDuration: number;
  category: string;
  tags?: string[];
}

interface UpdateSessionData {
  endTime?: Date;
  isCompleted?: boolean;
  isPaused?: boolean;
  pausedAt?: Date;
  resumedAt?: Date;
}

interface SessionStats {
  totalSessions: number;
  totalFocusTime: number;
  averageSessionLength: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  seedsEarned: number;
}

export const FocusService = {
  async createSession(data: CreateSessionData): Promise<ApiResponse<FocusSession>> {
    return client.post<FocusSession>('/focus/sessions', data);
  },

  async updateSession(sessionId: string, data: UpdateSessionData): Promise<ApiResponse<FocusSession>> {
    return client.patch<FocusSession>(`/focus/sessions/${sessionId}`, data);
  },

  async getSession(sessionId: string): Promise<ApiResponse<FocusSession>> {
    return client.get<FocusSession>(`/focus/sessions/${sessionId}`);
  },

  async getSessions(params?: { 
    limit?: number; 
    offset?: number; 
    startDate?: string; 
    endDate?: string;
    category?: string;
  }): Promise<ApiResponse<{ sessions: FocusSession[]; total: number }>> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return client.get<{ sessions: FocusSession[]; total: number }>(`/focus/sessions?${queryParams}`);
  },

  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return client.delete<void>(`/focus/sessions/${sessionId}`);
  },

  async getStats(period?: 'day' | 'week' | 'month' | 'year'): Promise<ApiResponse<SessionStats>> {
    const params = period ? `?period=${period}` : '';
    return client.get<SessionStats>(`/focus/stats${params}`);
  },

  async getCategories(): Promise<ApiResponse<string[]>> {
    return client.get<string[]>('/focus/categories');
  },

  async getTags(): Promise<ApiResponse<string[]>> {
    return client.get<string[]>('/focus/tags');
  },
};

export type {
  FocusSession,
  CreateSessionData,
  UpdateSessionData,
  SessionStats,
};