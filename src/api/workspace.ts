import { apiClient } from './client';

export const workspaceApi = {
  getMe: () => apiClient.get('/workspace/me'),
  getAnalytics: () => apiClient.get('/workspace/me/analytics'),
  create: (name: string) => apiClient.post('/workspace', { name }),
  invite: (workspaceId: string, email: string, role = 'MEMBER') =>
    apiClient.post(`/workspace/${workspaceId}/invite`, { email, role }),
  removeMember: (workspaceId: string, memberId: string) =>
    apiClient.delete(`/workspace/${workspaceId}/members/${memberId}`),
};
