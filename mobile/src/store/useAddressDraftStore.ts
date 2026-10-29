import { create } from 'zustand';

export type AddressTag = 'Nhà' | 'Công ty' | 'Khác';

export interface AddressDraftState {
  receiverName: string;
  receiverPhone: string;
  selectedAddressLine: string;
  pickedCoords: { latitude: number; longitude: number } | null;
  isPinConfirmed: boolean;
  buildingFloor: string;
  gateInfo: string;
  selectedTag: AddressTag;
  driverNote: string;
  isManual: boolean;

  // Actions
  setReceiverName: (name: string) => void;
  setReceiverPhone: (phone: string) => void;
  setSelectedAddress: (
    addressLine: string,
    coords: { latitude: number; longitude: number },
    isManual?: boolean,
  ) => void;
  confirmPin: (coords: { latitude: number; longitude: number }) => void;
  setManualAddressLine: (addressLine: string) => void;
  setBuildingFloor: (floor: string) => void;
  setGateInfo: (gate: string) => void;
  setSelectedTag: (tag: AddressTag) => void;
  setDriverNote: (note: string) => void;
  resetDraft: (initial?: Partial<AddressDraftState>) => void;
  initFromAddress: (address: {
    receiverName?: string;
    receiverPhone?: string;
    label?: string;
    addressLine: string;
    latitude: number;
    longitude: number;
    isManual?: boolean;
  }) => void;
  getMissingFields: () => string[];
}

export const isCoordinateAddressString = (address?: string | null): boolean => {
  if (!address || typeof address !== 'string') return true;
  const trimmed = address.trim();
  if (!trimmed) return true;

  if (/^(t[oọ][aạ]\s*đ[oộ]|coordinates?|latlng|vị trí hiện tại \(|toạ độ)/i.test(trimmed)) {
    return true;
  }
  if (/t[oọ][aạ]\s*đ[oộ]:\s*[-+]?\d/i.test(trimmed)) {
    return true;
  }
  const coordRegex = /^\[?\s*[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)\s*[,;\s]\s*[-+]?(180(\.0+)?|((1[0-7]\d)|(\d{1,2}))(\.\d+)?)\s*\]?$/;
  if (coordRegex.test(trimmed)) {
    return true;
  }
  if (trimmed.length < 5 || !/[a-zA-ZÀ-ỹ]/.test(trimmed)) {
    return true;
  }
  return false;
};

export const useAddressDraftStore = create<AddressDraftState>((set, get) => ({
  receiverName: '',
  receiverPhone: '',
  selectedAddressLine: '',
  pickedCoords: null,
  isPinConfirmed: false,
  buildingFloor: '',
  gateInfo: '',
  selectedTag: 'Nhà',
  driverNote: '',
  isManual: false,

  setReceiverName: (receiverName) => set({ receiverName }),
  setReceiverPhone: (receiverPhone) => set({ receiverPhone }),
  setSelectedAddress: (selectedAddressLine, pickedCoords, isManual = false) =>
    set({ selectedAddressLine, pickedCoords, isManual, isPinConfirmed: true }),
  confirmPin: (pickedCoords) => set({ pickedCoords, isPinConfirmed: true }),
  setManualAddressLine: (selectedAddressLine) =>
    set({ selectedAddressLine, isManual: true }),
  setBuildingFloor: (buildingFloor) => set({ buildingFloor }),
  setGateInfo: (gateInfo) => set({ gateInfo }),
  setSelectedTag: (selectedTag) => set({ selectedTag }),
  setDriverNote: (driverNote) => set({ driverNote }),

  resetDraft: (initial) =>
    set({
      receiverName: initial?.receiverName ?? '',
      receiverPhone: initial?.receiverPhone ?? '',
      selectedAddressLine: initial?.selectedAddressLine ?? '',
      pickedCoords: initial?.pickedCoords ?? null,
      isPinConfirmed: initial?.isPinConfirmed ?? false,
      buildingFloor: initial?.buildingFloor ?? '',
      gateInfo: initial?.gateInfo ?? '',
      selectedTag: initial?.selectedTag ?? 'Nhà',
      driverNote: initial?.driverNote ?? '',
      isManual: initial?.isManual ?? false,
    }),

  initFromAddress: (addr) =>
    set({
      receiverName: addr.receiverName ?? get().receiverName,
      receiverPhone: addr.receiverPhone ?? get().receiverPhone,
      selectedAddressLine: addr.addressLine,
      pickedCoords: { latitude: addr.latitude, longitude: addr.longitude },
      isPinConfirmed: true,
      selectedTag: (addr.label as AddressTag) || 'Nhà',
      isManual: addr.isManual ?? false,
    }),

  getMissingFields: () => {
    const s = get();
    const missing: string[] = [];
    if (!s.receiverName.trim()) missing.push('Tên người nhận');
    if (!s.receiverPhone.trim()) missing.push('Số điện thoại liên hệ');
    if (!s.selectedAddressLine.trim()) {
      missing.push('Chưa chọn địa chỉ hoặc chưa nhập tên đường');
    } else if (isCoordinateAddressString(s.selectedAddressLine)) {
      missing.push('Địa chỉ chưa có tên đường (đang là toạ độ thô)');
    }
    if (!s.pickedCoords || !s.isPinConfirmed) {
      missing.push('Chưa xác nhận vị trí ghim giao hàng trên bản đồ');
    }
    return missing;
  },
}));
