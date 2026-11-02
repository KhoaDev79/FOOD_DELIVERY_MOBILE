export function formatVND(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    return '0 ₫';
  }
  const numeric = Number(amount);
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${numeric.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${hours}:${minutes} - ${day}/${month}`;
  } catch {
    return dateString;
  }
}


/** Khoảng cách kiểu Việt Nam: "850 m", "1,7 km". */
export function formatDistance(km?: number | null): string | null {
  if (km === undefined || km === null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
}

/** Ngày đầy đủ dd/mm/yyyy (VD: ngày đăng ký tài khoản). */
export function formatDate(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
