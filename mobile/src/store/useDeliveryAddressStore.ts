import { create } from 'zustand';
import { Address } from '../types/api';
import { appStorage } from '../utils/storage';

const STORAGE_KEY = 'food_delivery_selected_address_id';

export interface DeliveryAddressResolution {
  address: Address | null;
  displayText: string;
  source: 'selected' | 'default' | 'first' | 'gps' | 'none';
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  roundedCoords: {
    latitude: number;
    longitude: number;
  } | null;
}

/**
 * Hàm làm tròn toạ độ đến 3 chữ số thập phân (độ chính xác ~100m)
 * Giúp tối ưu bộ nhớ đệm TanStack Query khi người dùng di chuyển nhẹ
 */
export function roundCoordinate(coord: number, precision = 3): number {
  const factor = Math.pow(10, precision);
  return Math.round(coord * factor) / factor;
}

/**
 * Quy tắc phân giải địa chỉ giao hàng duy nhất:
 * 1. Địa chỉ theo selectedAddressId (nếu tồn tại trong danh sách addresses)
 * 2. Địa chỉ mặc định (isDefault: true)
 * 3. Địa chỉ đầu tiên trong danh sách (nếu có)
 * 4. Vị trí GPS hiện tại (khi có toạ độ hợp lệ)
 * 5. Mặc định fallback: "Chọn địa chỉ giao hàng" (toạ độ TP.HCM)
 */
export function resolveActiveDeliveryAddress(
  addresses: Address[] | undefined,
  selectedAddressId: string | null,
  gpsCoords?: { latitude: number; longitude: number } | null,
  gpsStreetName?: string,
): DeliveryAddressResolution {
  // 1. Kiểm tra selectedAddressId
  if (selectedAddressId && addresses && addresses.length > 0) {
    const found = addresses.find((a) => a.id === selectedAddressId);
    if (found) {
      return {
        address: found,
        displayText: found.addressLine,
        source: 'selected',
        coordinates: { latitude: found.latitude, longitude: found.longitude },
        roundedCoords: {
          latitude: roundCoordinate(found.latitude),
          longitude: roundCoordinate(found.longitude),
        },
      };
    }
  }

  // 2. Kiểm tra địa chỉ mặc định
  if (addresses && addresses.length > 0) {
    const defaultAddr = addresses.find((a) => a.isDefault);
    if (defaultAddr) {
      return {
        address: defaultAddr,
        displayText: defaultAddr.addressLine,
        source: 'default',
        coordinates: { latitude: defaultAddr.latitude, longitude: defaultAddr.longitude },
        roundedCoords: {
          latitude: roundCoordinate(defaultAddr.latitude),
          longitude: roundCoordinate(defaultAddr.longitude),
        },
      };
    }

    // 3. Địa chỉ đầu tiên
    const firstAddr = addresses[0];
    return {
      address: firstAddr,
      displayText: firstAddr.addressLine,
      source: 'first',
      coordinates: { latitude: firstAddr.latitude, longitude: firstAddr.longitude },
      roundedCoords: {
        latitude: roundCoordinate(firstAddr.latitude),
        longitude: roundCoordinate(firstAddr.longitude),
      },
    };
  }

  // 4. Vị trí GPS
  if (gpsCoords && gpsCoords.latitude && gpsCoords.longitude) {
    const text = gpsStreetName && !/^(t[oọ][aạ]\s*đ[oộ]|[-+]?\d+\.\d+)/i.test(gpsStreetName)
      ? gpsStreetName
      : 'Vị trí hiện tại (GPS)';
    return {
      address: null,
      displayText: text,
      source: 'gps',
      coordinates: { latitude: gpsCoords.latitude, longitude: gpsCoords.longitude },
      roundedCoords: {
        latitude: roundCoordinate(gpsCoords.latitude),
        longitude: roundCoordinate(gpsCoords.longitude),
      },
    };
  }

  // 5. Không có địa chỉ đã lưu và không có GPS -> không giả lập toạ độ mặc định
  return {
    address: null,
    displayText: 'Chọn địa chỉ giao hàng',
    source: 'none',
    coordinates: null,
    roundedCoords: null,
  };
}

interface DeliveryAddressState {
  selectedAddressId: string | null;
  isInitialized: boolean;
  setSelectedAddressId: (id: string | null) => Promise<void>;
  loadSavedSelection: () => Promise<void>;
  resetSelection: () => Promise<void>;
}

export const useDeliveryAddressStore = create<DeliveryAddressState>((set) => ({
  selectedAddressId: null,
  isInitialized: false,

  setSelectedAddressId: async (id: string | null) => {
    set({ selectedAddressId: id });
    try {
      if (id) {
        await appStorage.setItem(STORAGE_KEY, id);
      } else {
        await appStorage.deleteItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  },

  loadSavedSelection: async () => {
    try {
      const savedId = await appStorage.getItem(STORAGE_KEY);
      set({ selectedAddressId: savedId || null, isInitialized: true });
    } catch {
      set({ isInitialized: true });
    }
  },

  resetSelection: async () => {
    set({ selectedAddressId: null });
    try {
      await appStorage.deleteItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
}));

