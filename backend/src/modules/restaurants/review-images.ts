/** Ảnh đánh giá hiển thị công khai: bỏ các ảnh đã bị chủ quán/admin ẩn. */
export function visibleImages(images: string[], hidden: string[]): string[] {
  if (!hidden.length) return images;
  const set = new Set(hidden);
  return images.filter((u) => !set.has(u));
}

/** Thêm/bỏ một ảnh khỏi danh sách ảnh bị ẩn (không trùng lặp). */
export function toggleHiddenImage(hidden: string[], imageUrl: string, hide: boolean): string[] {
  const set = new Set(hidden);
  if (hide) set.add(imageUrl);
  else set.delete(imageUrl);
  return [...set];
}
