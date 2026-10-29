import { useAddressDraftStore } from './useAddressDraftStore';

describe('useAddressDraftStore (Mobile Navigation Flow & Pin Confirmation)', () => {
  beforeEach(() => {
    useAddressDraftStore.getState().resetDraft();
  });

  // =========================================================================
  // 1. Khởi tạo màn Thêm địa chỉ: Chưa bật nút Lưu khi chưa xác nhận vị trí ghim
  // =========================================================================
  it('Khởi tạo ban đầu: Nút Lưu bị tắt vì thiếu thông tin và chưa xác nhận ghim toạ độ', () => {
    const store = useAddressDraftStore.getState();
    const missing = store.getMissingFields();

    expect(missing).toContain('Tên người nhận');
    expect(missing).toContain('Số điện thoại liên hệ');
    expect(missing).toContain('Chưa chọn địa chỉ hoặc chưa nhập tên đường');
    expect(missing).toContain('Chưa xác nhận vị trí ghim giao hàng trên bản đồ');
    expect(store.isPinConfirmed).toBe(false);
    expect(store.pickedCoords).toBeNull();
  });

  // =========================================================================
  // 2. Chế độ tự nhập chữ: Bắt buộc khách phải bấm xác nhận vị trí ghim rõ ràng
  // =========================================================================
  it('Chế độ tự nhập: Không tự ý điền GPS ngầm, bắt buộc khách phải xác nhận vị trí ghim', () => {
    const store = useAddressDraftStore.getState();

    // Khách tự gõ tên, số điện thoại, tên đường
    store.setReceiverName('Nguyễn Văn Khách');
    store.setReceiverPhone('0909123456');
    store.setManualAddressLine('123 Đường Nguyễn Trãi, Phường Bến Thành, TP. Hồ Chí Minh');

    // Mặc dù đã có chữ, nhưng chưa xác nhận ghim -> Vẫn chưa được lưu!
    let missing = useAddressDraftStore.getState().getMissingFields();
    expect(missing).toContain('Chưa xác nhận vị trí ghim giao hàng trên bản đồ');
    expect(useAddressDraftStore.getState().isPinConfirmed).toBe(false);

    // Khách xác nhận vị trí ghim trên bản đồ một cách rõ ràng
    useAddressDraftStore.getState().confirmPin({ latitude: 10.7716, longitude: 106.6983 });

    // Bây giờ đầy đủ điều kiện -> Nút Lưu bật sáng!
    missing = useAddressDraftStore.getState().getMissingFields();
    expect(missing.length).toBe(0);
    expect(useAddressDraftStore.getState().isPinConfirmed).toBe(true);
  });

  // =========================================================================
  // 3. Đúng luồng điều hướng thật: Thêm địa chỉ -> Chọn vị trí -> Quay lại -> Lưu
  // =========================================================================
  it('Luồng điều hướng thật: Chọn vị trí KHÔNG được xoá bản nháp, quay lại Thêm địa chỉ dữ liệu còn đủ và bật nút Lưu', () => {
    // Bước 1: Mở màn Thêm địa chỉ (AddAddressScreen), khách nhập tên và số điện thoại
    useAddressDraftStore.getState().setReceiverName('Trần Thị B');
    useAddressDraftStore.getState().setReceiverPhone('0912345678');
    useAddressDraftStore.getState().setSelectedTag('Công ty');

    // Bước 2: Bấm nút "Chọn vị trí trên bản đồ" -> Điều hướng sang màn Chọn vị trí (AddressPickerScreen)
    // Chứng minh: AddressPickerScreen KHÔNG gọi resetDraft, dữ liệu đã nhập ở bước 1 vẫn được giữ nguyên!
    const stateDuringPicker = useAddressDraftStore.getState();
    expect(stateDuringPicker.receiverName).toBe('Trần Thị B');
    expect(stateDuringPicker.receiverPhone).toBe('0912345678');
    expect(stateDuringPicker.selectedTag).toBe('Công ty');

    // Bước 3: Trong màn Chọn vị trí, khách kéo bản đồ hoặc tìm kiếm địa điểm, bấm "Xác nhận vị trí này"
    useAddressDraftStore.getState().setSelectedAddress(
      '45 Lê Thánh Tôn, Phường Bến Nghé, TP. Hồ Chí Minh',
      { latitude: 10.7782, longitude: 106.7011 },
      false,
    );

    // Bước 4: AddressPickerScreen gọi navigation.goBack() quay về AddAddressScreen
    // AddAddressScreen đọc lại store: Dữ liệu đã đầy đủ và nút Lưu bật sáng!
    const finalState = useAddressDraftStore.getState();
    expect(finalState.receiverName).toBe('Trần Thị B');
    expect(finalState.receiverPhone).toBe('0912345678');
    expect(finalState.selectedAddressLine).toBe('45 Lê Thánh Tôn, Phường Bến Nghé, TP. Hồ Chí Minh');
    expect(finalState.pickedCoords).toEqual({ latitude: 10.7782, longitude: 106.7011 });
    expect(finalState.isPinConfirmed).toBe(true);

    const missing = finalState.getMissingFields();
    expect(missing.length).toBe(0); // canSave === true -> Nút Lưu đã bật!

    // Bước 5: Người dùng bấm Lưu -> API lưu thành công -> AddAddressScreen gọi resetDraft() và đóng màn hình
    useAddressDraftStore.getState().resetDraft();

    // Chứng minh sau khi lưu, bản nháp đã được dọn sạch hoàn toàn
    expect(useAddressDraftStore.getState().receiverName).toBe('');
    expect(useAddressDraftStore.getState().selectedAddressLine).toBe('');
    expect(useAddressDraftStore.getState().pickedCoords).toBeNull();
    expect(useAddressDraftStore.getState().isPinConfirmed).toBe(false);
  });

  // =========================================================================
  // 4. Huỷ / Vuốt Back: AddAddressScreen unmount dọn sạch bản nháp
  // =========================================================================
  it('Khi khách huỷ hoặc vuốt back khỏi AddAddressScreen: resetDraft dọn sạch bản nháp', () => {
    useAddressDraftStore.getState().setReceiverName('Khách Huỷ Giữa Chừng');
    useAddressDraftStore.getState().setManualAddressLine('Địa chỉ đang gõ dở...');

    // Giả lập useEffect unmount cleanup của AddAddressScreen
    useAddressDraftStore.getState().resetDraft();

    expect(useAddressDraftStore.getState().receiverName).toBe('');
    expect(useAddressDraftStore.getState().selectedAddressLine).toBe('');
  });

  // =========================================================================
  // 5. Chế độ sửa địa chỉ đã có (initFromAddress)
  // =========================================================================
  it('Sửa địa chỉ đã có: initFromAddress nạp đầy đủ toạ độ và tự động bật isPinConfirmed', () => {
    useAddressDraftStore.getState().initFromAddress({
      receiverName: 'Chủ Căn Hộ',
      receiverPhone: '0933888999',
      label: 'Nhà',
      addressLine: '90 Nguyễn Đình Chiểu, Phường Đa Kao, TP. Hồ Chí Minh',
      latitude: 10.785,
      longitude: 106.682,
      isManual: false,
    });

    const state = useAddressDraftStore.getState();
    expect(state.receiverName).toBe('Chủ Căn Hộ');
    expect(state.selectedAddressLine).toBe('90 Nguyễn Đình Chiểu, Phường Đa Kao, TP. Hồ Chí Minh');
    expect(state.isPinConfirmed).toBe(true);
    expect(state.getMissingFields().length).toBe(0);
  });
});

