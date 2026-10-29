export function formatVND(amount: number): string {
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;
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

