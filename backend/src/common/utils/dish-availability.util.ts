/**
 * Giờ Việt Nam (UTC+7). Mọi khung giờ bán của món đều hiểu theo giờ địa phương.
 */
const VN_OFFSET_MINUTES = 7 * 60;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Kiểm tra món ăn có đang trong khung giờ mở bán hay không:
 * - Nếu không thiết lập (availableFrom hoặc availableTo là null/undefined) -> Bán suốt thời gian mở cửa của quán.
 * - Khung giờ trong ngày (from < to, vd 06:00 -> 10:30): from <= t && t < to.
 * - Khung giờ qua đêm (from > to, vd 18:00 -> 02:00): t >= from || t < to.
 * - from === to: Bán cả ngày.
 */
export function isDishWithinServingHours(
  availableFrom?: string | null,
  availableTo?: string | null,
  now: Date = new Date(),
  offsetMinutes = VN_OFFSET_MINUTES,
): boolean {
  if (!availableFrom || !availableTo) return true;

  const local = new Date(now.getTime() + offsetMinutes * 60_000);
  const t = local.getUTCHours() * 60 + local.getUTCMinutes();
  const from = toMinutes(availableFrom);
  const to = toMinutes(availableTo);

  if (from === to) return true;
  return from < to ? t >= from && t < to : t >= from || t < to;
}

export interface DishAvailabilityResult {
  isAvailableNow: boolean;
  notice: string | null;
  servingTimeLabel: string | null;
}

/**
 * Lấy nhãn thông tin giờ bán cho món ăn để hiển thị trên giao diện hoặc thông báo.
 */
export function getDishAvailability(
  item: {
    name?: string;
    isAvailable?: boolean;
    availableFrom?: string | null;
    availableTo?: string | null;
  },
  now: Date = new Date(),
): DishAvailabilityResult {
  const { isAvailable = true, availableFrom, availableTo } = item;

  if (!isAvailable) {
    return {
      isAvailableNow: false,
      notice: 'Tạm hết món',
      servingTimeLabel: null,
    };
  }

  if (!availableFrom || !availableTo) {
    return {
      isAvailableNow: true,
      notice: null,
      servingTimeLabel: null,
    };
  }

  const servingTimeLabel = `${availableFrom} – ${availableTo}`;
  const withinHours = isDishWithinServingHours(availableFrom, availableTo, now);

  if (withinHours) {
    return {
      isAvailableNow: true,
      notice: null,
      servingTimeLabel,
    };
  }

  return {
    isAvailableNow: false,
    notice: `Bán từ ${availableFrom}`,
    servingTimeLabel,
  };
}

