// Ghép className, bỏ giá trị rỗng. Lưu ý: className truyền từ ngoài chỉ nên dùng cho
// bố cục (lề, độ rộng, flex); không ghi đè cùng thuộc tính với lớp mặc định của thành phần.
export const cn = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');
