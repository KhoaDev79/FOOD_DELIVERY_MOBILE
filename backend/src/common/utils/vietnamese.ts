/**
 * Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu ("pho" khớp "Phở").
 * Dùng cùng một bảng ký tự cho JS và cho hàm translate() của PostgreSQL (không cần extension unaccent).
 */
export const VI_ACCENTED = 'àáạảãâầấậẩẫăằắặẳẵÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴèéẹẻẽêềếệểễÈÉẸẺẼÊỀẾỆỂỄìíịỉĩÌÍỊỈĨòóọỏõôồốộổỗơờớợởỡÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠùúụủũưừứựửữÙÚỤỦŨƯỪỨỰỬỮỳýỵỷỹỲÝỴỶỸđĐ';
export const VI_PLAIN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeeeeeiiiiiiiiiioooooooooooooooooooooooooooooooooouuuuuuuuuuuuuuuuuuuuuuyyyyyyyyyydd';

const MAP = new Map([...VI_ACCENTED].map((ch, i) => [ch, VI_PLAIN[i]]));

/** "Phở Bò" -> "pho bo" */
export const foldVietnamese = (s: string) => [...s].map((ch) => MAP.get(ch) ?? ch).join('').toLowerCase();
