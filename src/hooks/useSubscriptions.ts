import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '../api/subscriptions';

export function useSubscriptions(params?: any) {
  return useQuery({
    queryKey: ['subscriptions', params],
    queryFn: () => subscriptionsApi.getAll(params).then((r) => r.data),
  });
}

export function useSubscription(id: string) {
  return useQuery({
    queryKey: ['subscriptions', id],
    queryFn: () => subscriptionsApi.getById(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => subscriptionsApi.create(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      qc.invalidateQueries({ queryKey: ['billing', 'me'] });
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      subscriptionsApi.update(id, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => subscriptionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      qc.invalidateQueries({ queryKey: ['billing', 'me'] });
    },
  });
}
