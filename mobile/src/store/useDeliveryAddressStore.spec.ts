import {
  resolveActiveDeliveryAddress,
  roundCoordinate,
  useDeliveryAddressStore,
} from './useDeliveryAddressStore';
import { Address } from '../types/api';

jest.mock('../utils/storage', () => {
  let mockStore: Record<string, string> = {};
  return {
    appStorage: {
      setItem: jest.fn(async (key: string, val: string) => {
        mockStore[key] = val;
      }),
      getItem: jest.fn(async (key: string) => mockStore[key] || null),
      deleteItem: jest.fn(async (key: string) => {
        delete mockStore[key];
      }),
      __clear: () => {
        mockStore = {};
      },
    },
  };
});

describe('useDeliveryAddressStore & resolveActiveDeliveryAddress (Single Source of Truth)', () => {
  const mockAddresses: Address[] = [
    {
      id: 'addr-1',
      userId: 'user-1',
      label: 'Nhà',
      addressLine: '123 Lê Lợi, Phường Bến Nghé, TP. Hồ Chí Minh',
      latitude: 10.7765,
      longitude: 106.7005,
      isDefault: true,
      isManual: false,
      needsConfirmation: false,
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'addr-2',
      userId: 'user-1',
      label: 'Công ty',
      addressLine: '456 Nguyễn Huệ, Phường Bến Nghé, TP. Hồ Chí Minh',
      latitude: 10.7745,
      longitude: 106.7035,
      isDefault: false,
      isManual: false,
      needsConfirmation: false,
      createdAt: '2026-10-02T00:00:00Z',
    },
    {
      id: 'addr-3',
      userId: 'user-1',
      label: 'Nhà bạn',
      addressLine: '789 Phan Xích Long, Phường Cầu Kiệu, TP. Hồ Chí Minh',
      latitude: 10.7985,
      longitude: 106.6875,
      isDefault: false,
      isManual: true,
      needsConfirmation: false,
      createdAt: '2026-10-03T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    await useDeliveryAddressStore.getState().resetSelection();
  });

  test('Tình huống 1: Sửa địa chỉ đang chọn thì tiêu đề trang chủ đổi ngay theo dữ liệu mới nhất', () => {
    // Ban đầu người dùng chọn địa chỉ addr-1
    const selectedId = 'addr-1';

    const initialResolution = resolveActiveDeliveryAddress(mockAddresses, selectedId);
    expect(initialResolution.source).toBe('selected');
    expect(initialResolution.displayText).toBe('123 Lê Lợi, Phường Bến Nghé, TP. Hồ Chí Minh');
    expect(initialResolution.coordinates).toEqual({ latitude: 10.7765, longitude: 106.7005 });

    // Địa chỉ addr-1 được sửa thành địa chỉ mới
    const updatedAddresses = mockAddresses.map((addr) =>
      addr.id === 'addr-1'
        ? {
            ...addr,
            addressLine: '123/45 Lê Lợi (Mới Sửa), Phường Bến Nghé, TP. Hồ Chí Minh',
            latitude: 10.7771,
            longitude: 106.7012,
          }
        : addr,
    );

    // Khi danh sách addresses được invalidate & query lại từ server,
    // tiêu đề phân giải từ selectedId tự động lấy nội dung mới nhất, không bị dính bản sao cũ!
    const updatedResolution = resolveActiveDeliveryAddress(updatedAddresses, selectedId);
    expect(updatedResolution.source).toBe('selected');
    expect(updatedResolution.displayText).toBe(
      '123/45 Lê Lợi (Mới Sửa), Phường Bến Nghé, TP. Hồ Chí Minh',
    );
    expect(updatedResolution.coordinates).toEqual({ latitude: 10.7771, longitude: 106.7012 });
  });

  test('Tình huống 2: Chọn địa chỉ khác thì yêu cầu danh sách quán dùng toạ độ mới', () => {
    // Người dùng chọn địa chỉ addr-2 (Công ty)
    const resAddr2 = resolveActiveDeliveryAddress(mockAddresses, 'addr-2');
    expect(resAddr2.displayText).toBe('456 Nguyễn Huệ, Phường Bến Nghé, TP. Hồ Chí Minh');
    expect(resAddr2.roundedCoords).toEqual({
      latitude: roundCoordinate(10.7745),
      longitude: roundCoordinate(106.7035),
    });

    // Chuyển sang chọn địa chỉ addr-3 (Phan Xích Long)
    const resAddr3 = resolveActiveDeliveryAddress(mockAddresses, 'addr-3');
    expect(resAddr3.displayText).toBe('789 Phan Xích Long, Phường Cầu Kiệu, TP. Hồ Chí Minh');
    expect(resAddr3.roundedCoords).toEqual({
      latitude: roundCoordinate(10.7985),
      longitude: roundCoordinate(106.6875),
    });

    // Toạ độ query quán của 2 địa chỉ phải khác nhau hoàn toàn
    expect(resAddr2.roundedCoords.latitude).not.toEqual(resAddr3.roundedCoords.latitude);
    expect(resAddr2.roundedCoords.longitude).not.toEqual(resAddr3.roundedCoords.longitude);
  });

  test('Tình huống 3: Xoá địa chỉ đang chọn thì tự động chuyển sang địa chỉ mặc định, không còn hiện địa chỉ đã xoá', () => {
    const selectedId = 'addr-3'; // Đang chọn addr-3

    // Danh sách sau khi xoá addr-3
    const remainingAddresses = mockAddresses.filter((a) => a.id !== 'addr-3');

    // Phân giải lại với selectedId = 'addr-3' nhưng địa chỉ đó không còn trong DB
    const resAfterDelete = resolveActiveDeliveryAddress(remainingAddresses, selectedId);

    // Phải tự động rơi về địa chỉ mặc định (addr-1) thay vì giữ text rác của addr-3
    expect(resAfterDelete.source).toBe('default');
    expect(resAfterDelete.address?.id).toBe('addr-1');
    expect(resAfterDelete.displayText).toBe('123 Lê Lợi, Phường Bến Nghé, TP. Hồ Chí Minh');
    expect(resAfterDelete.displayText).not.toContain('Phan Xích Long');
  });

  test('Tình huống 4: Quy tắc fallback hiển thị đầy đủ (Chưa chọn -> Mặc định -> Vị trí GPS -> Fallback rỗng)', () => {
    // 1. Không có selectedId, có default
    const resDefault = resolveActiveDeliveryAddress(mockAddresses, null);
    expect(resDefault.source).toBe('default');
    expect(resDefault.displayText).toBe('123 Lê Lợi, Phường Bến Nghé, TP. Hồ Chí Minh');

    // 2. Không có địa chỉ nào trong DB, nhưng có GPS
    const gpsCoords = { latitude: 10.8231, longitude: 106.6297 };
    const resGps = resolveActiveDeliveryAddress([], null, gpsCoords, 'Đường Quang Trung, Gò Vấp');
    expect(resGps.source).toBe('gps');
    expect(resGps.displayText).toBe('Đường Quang Trung, Gò Vấp');
    expect(resGps.coordinates).toEqual(gpsCoords);

    // 3. Không có địa chỉ trong DB, không có GPS
    const resNone = resolveActiveDeliveryAddress([], null, undefined, undefined);
    expect(resNone.source).toBe('none');
    expect(resNone.displayText).toBe('Chọn địa chỉ giao hàng');
  });
});
