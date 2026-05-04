import { apiClient } from './client';

export const workspaceApi = {
  getMe: () => apiClient.get('/workspace/me'),
  getAnalytics: (opts?: { displayCurrency?: string }) =>
    apiClient.get('/workspace/me/analytics', {
      params: opts?.displayCurrency ? { displayCurrency: opts.displayCurrency } : undefined,
    }),
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

  /**
   * Owner/admin only — paginated members list with sort. Used by the
   * Reports + team-overview screens to render big teams without
   * loading every member at once.
   */
  listMembers: async (opts?: {
    page?: number;
    limit?: number;
    sort?: 'spend' | 'name' | 'role';
  }) => {
    const params = new URLSearchParams();
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.sort) params.set('sort', opts.sort);
    const qs = params.toString();
    const { data } = await apiClient.get(`/workspace/me/members${qs ? `?${qs}` : ''}`);
    return data as {
      pagination: { page: number; limit: number; total: number; hasMore: boolean };
      members: Array<{
        memberId: string;
        userId: string;
        name: string | null;
        email: string | null;
        role: 'OWNER' | 'ADMIN' | 'MEMBER';
        subscriptionCount: number;
        rawSpend: number;
      }>;
    };
  },

  /**
   * Owner-only — most recent AI-detected overlap summary.
   */
  getOverlaps: async () => {
    const { data } = await apiClient.get('/workspace/me/overlaps');
    return data as {
      workspaceId: string;
      overlaps: Array<{
        serviceName: string;
        members?: Array<{ userId: string; name: string | null; amount: number }>;
        currentTotalMonthly?: number;
        suggestedPlan?: string;
        savingsMonthly?: number;
      }>;
      potentialSavingsMonthly: number;
      lastAnalysisAt: string | null;
    };
  },

  /**
   * Owner-only — kicks off a team-scope PDF. Same response shape as
   * /reports/generate, downloaded via GET /reports/{id}/download.
   */
  generateTeamReport: async (
    type: 'SUMMARY' | 'DETAILED' | 'TAX',
    opts?: { from?: string; to?: string; locale?: string; displayCurrency?: string },
  ) => {
    const { data } = await apiClient.post('/workspace/me/reports/generate', {
      type,
      from: opts?.from,
      to: opts?.to,
      locale: opts?.locale,
      displayCurrency: opts?.displayCurrency,
    });
    return data as {
      id: string;
      status: string;
      type: string;
      from: string;
      to: string;
    };
  },
};
