import { getFallbackInitial, resolveImageUrl } from './image';

// Giả lập cấu hình API Base URL để kiểm tra
jest.mock('../constants/config', () => ({
  API_BASE_URL: 'http://localhost:3000/api/v1',
}));

describe('resolveImageUrl & Image Fallback Logic (Item 2)', () => {
  test('Đường dẫn ảnh tương đối trong CSDL được tự động ghép với Base URL Backend', () => {
    const relativePath = '/public/images/food/pho.jpg';
    const resolved = resolveImageUrl(relativePath);

    // Chứng minh: /public/... được nối với origin http://localhost:3000
    expect(resolved).toBe('http://localhost:3000/public/images/food/pho.jpg');
  });

  test('Đường dẫn tương đối không có gạch chéo đầu vẫn được chuẩn hoá thành công', () => {
    const relativePath = 'public/images/food/comtam.jpg';
    const resolved = resolveImageUrl(relativePath);

    expect(resolved).toBe('http://localhost:3000/public/images/food/comtam.jpg');
  });

  test('URL tuyệt đối từ CDN bên ngoài (http / https) được giữ nguyên vẹn', () => {
    const externalUrl = 'https://images.unsplash.com/photo-1540420773420?w=600';
    expect(resolveImageUrl(externalUrl)).toBe(externalUrl);
  });

  test('Đầu vào null, undefined hoặc chuỗi rỗng trả về null để hiển thị ảnh dự phòng', () => {
    expect(resolveImageUrl(null)).toBeNull();
    expect(resolveImageUrl(undefined)).toBeNull();
    expect(resolveImageUrl('')).toBeNull();
    expect(resolveImageUrl('   ')).toBeNull();
  });

  test('Hàm getFallbackInitial trích xuất đúng ký tự đầu viết hoa làm ảnh dự phòng', () => {
    expect(getFallbackInitial('Phở Bò Đậm Vị')).toBe('P');
    expect(getFallbackInitial('cơm tấm sườn bì')).toBe('C');
    expect(getFallbackInitial('')).toBe('F');
  });
});

