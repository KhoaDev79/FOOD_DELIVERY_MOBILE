/**
 * Giờ Việt Nam (UTC+7). Mọi khung giờ bán của món đều hiểu theo giờ địa phương.
 */
const VN_OFFSET_MINUTES = 7 * 60;

const toMinutes = (hhmm: string): number => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

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

export interface DishAvailabilityStatus {
  isAvailableNow: boolean;
  isTimedDish: boolean;
  tag: string | null;
  servingTimeLabel: string | null;
}

export function getDishAvailabilityStatus(
  dish: {
    isAvailable?: boolean;
    soldOutUntil?: string | null;
    availableFrom?: string | null;
    availableTo?: string | null;
  },
  now: Date = new Date(),
): DishAvailabilityStatus {
  const isAvailable = dish.isAvailable !== false;
  const isTimedDish = Boolean(dish.availableFrom && dish.availableTo);
  const servingTimeLabel = isTimedDish ? `${dish.availableFrom} – ${dish.availableTo}` : null;

  if (!isAvailable) {
    return {
      isAvailableNow: false,
      isTimedDish,
      // "Hết hôm nay" cho khách biết ngày mai có lại, thay vì "Tạm hết" chung chung
      tag: dish.soldOutUntil && new Date(dish.soldOutUntil).getTime() > now.getTime() ? 'Hết hôm nay' : 'Tạm hết',
      servingTimeLabel,
    };
  }

  if (!isTimedDish) {
    return {
      isAvailableNow: true,
      isTimedDish: false,
      tag: null,
      servingTimeLabel: null,
    };
  }

  const within = isDishWithinServingHours(dish.availableFrom, dish.availableTo, now);
  if (within) {
    return {
      isAvailableNow: true,
      isTimedDish: true,
      tag: `Bán ${dish.availableFrom}–${dish.availableTo}`,
      servingTimeLabel,
    };
  }

  return {
    isAvailableNow: false,
    isTimedDish: true,
    tag: `Bán từ ${dish.availableFrom}`,
    servingTimeLabel,
  };
}

