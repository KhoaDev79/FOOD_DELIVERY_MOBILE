import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateAddressPayload, usersApi } from '../api/users';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/useAuthStore';
import { useDeliveryAddressStore } from '../store/useDeliveryAddressStore';

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
  const setSelectedAddressId = useDeliveryAddressStore((s) => s.setSelectedAddressId);

  return useMutation({
    mutationFn: (data: CreateAddressPayload & { isManual?: boolean }) => usersApi.createAddress(data),
    onSuccess: (newAddress) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses });
      if (newAddress?.isDefault) {
        setSelectedAddressId(newAddress.id);
      }
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateAddressPayload> & { isManual?: boolean; needsConfirmation?: boolean };
    }) => usersApi.updateAddress(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses });
    },
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  const setSelectedAddressId = useDeliveryAddressStore((s) => s.setSelectedAddressId);

  return useMutation({
    mutationFn: (id: string) => usersApi.setDefaultAddress(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses });
      setSelectedAddressId(id);
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  const selectedAddressId = useDeliveryAddressStore.getState().selectedAddressId;
  const setSelectedAddressId = useDeliveryAddressStore.getState().setSelectedAddressId;

  return useMutation({
    mutationFn: (id: string) => usersApi.deleteAddress(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses });
      if (selectedAddressId === deletedId) {
        // Tự động xoá id đang chọn nếu địa chỉ đó bị xoá
        setSelectedAddressId(null);
      }
    },
  });
}
