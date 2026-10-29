import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateAddressPayload, usersApi } from '../api/users';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/useAuthStore';

export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => usersApi.getMe(),
    enabled: isAuthenticated,
  });
}

export function useAddresses() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.user.addresses,
    queryFn: () => usersApi.getAddresses(),
    enabled: isAuthenticated,
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAddressPayload) => usersApi.createAddress(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses });
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses });
    },
  });
}

