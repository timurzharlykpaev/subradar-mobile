import { apiClient } from './client';

export const workspaceApi = {
  getMe: () => apiClient.get('/workspace/me'),
  getAnalytics: () => apiClient.get('/workspace/me/analytics'),
  create: (name: string) => apiClient.post('/workspace', { name }),
  invite: (workspaceId: string, email: string, role = 'MEMBER') =>
    apiClient.post(`/workspace/${workspaceId}/invite`, { email, role }),
  removeMember: (workspaceId: string, memberId: string) =>
    apiClient.delete(`/workspace/${workspaceId}/members/${memberId}`),

  generateInviteCode: async (workspaceId: string) => {
    const { data } = await apiClient.post(`/workspace/${workspaceId}/invite-code`);
    return data as { code: string; expiresAt: string };
  },

  joinByCode: async (code: string) => {
    const { data } = await apiClient.post(`/workspace/join/${code}`);
    return data;
  },

  leave: async (workspaceId: string) => {
    const { data } = await apiClient.post(`/workspace/${workspaceId}/leave`);
    return data;
  },

  deleteWorkspace: async (workspaceId: string) => {
    const { data } = await apiClient.delete(`/workspace/${workspaceId}`);
    return data;
  },

  rename: async (workspaceId: string, name: string) => {
    const { data } = await apiClient.patch(`/workspace/${workspaceId}`, { name });
    return data;
  },

  changeRole: async (workspaceId: string, memberId: string, role: string) => {
    const { data } = await apiClient.patch(`/workspace/${workspaceId}/members/${memberId}/role`, { role });
    return data;
  },

  getAnalysisLatest: async () => {
    const { data } = await apiClient.get('/workspace/me/analysis/latest');
    return data;
  },

  runAnalysis: async () => {
    const { data } = await apiClient.post('/workspace/me/analysis/run');
    return data;
  },
};
