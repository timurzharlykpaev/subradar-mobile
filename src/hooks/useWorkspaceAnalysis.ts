import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../api/workspace';

export function useWorkspaceAnalysisLatest() {
  const queryClient = useQueryClient();
  const workspace = queryClient.getQueryData(['workspace']);

  return useQuery({
    queryKey: ['workspace-analysis', 'latest'],
    queryFn: workspaceApi.getAnalysisLatest,
    enabled: !!workspace,
    staleTime: 30_000,
    retry: false,
  });
}

export function useRunWorkspaceAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: workspaceApi.runAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-analysis'] });
    },
  });
}
