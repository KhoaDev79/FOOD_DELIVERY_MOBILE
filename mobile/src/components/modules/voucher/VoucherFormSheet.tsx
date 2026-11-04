import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { BottomSheet, Button, cn, Input, Text, useToast } from '../../ui';
import { useSaveVoucher } from '../../../services/useVouchers';
import { palette } from '../../../theme';
import { VoucherAdmin, VoucherInput, VoucherType } from '../../../types/api';
import { formatVND } from '../../../utils/format';
import { voucherHeadline } from './VoucherTicket';

const TYPES: { value: VoucherType; label: string }[] = [
  { value: 'FIXED_AMOUNT', label: 'Giảm tiền' },
  { value: 'PERCENTAGE', label: 'Giảm %' },
  { value: 'FREE_SHIP', label: 'Freeship' },
];
const DURATIONS = [7, 14, 30, 60, 90];

const digits = (s: string) => Number(s.replace(/\D/g, '') || 0);
const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** Ô nhập số tiền / số lượng: chỉ nhận chữ số, hiển thị có dấu chấm ngăn cách. */
const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, suffix, hint, disabled }) => (
  <View className="flex-1">
    <Input
      label={label}
      value={value ? value.toLocaleString('vi-VN') : ''}
      onChangeText={(t) => onChange(digits(t))}
      keyboardType="number-pad"
      placeholder="0"
      hint={hint}
      editable={!disabled}
      className={disabled ? 'opacity-60' : undefined}
    />
    {!!suffix && (
      <Text variant="micro" weight="regular" tone="muted" className="-mt-1 px-1">
        Đơn vị: {suffix}
      </Text>
    )}
  </View>
);

/**
 * Tạo / sửa voucher. Admin: mã toàn sàn (sàn chịu). Chủ quán (restaurantId): mã của quán (quán chịu, trừ doanh thu).
 * Mã đã có người dùng thì khoá mức giảm và đơn tối thiểu (giống quy tắc ở backend).
 */
export const VoucherFormSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  restaurantId?: string;
  editing?: VoucherAdmin | null;
}> = ({ visible, onClose, restaurantId, editing }) => {
  const toast = useToast();
  const save = useSaveVoucher(restaurantId);
  const isEdit = Boolean(editing);
  const locked = Boolean(editing && editing.usedCount > 0);

  const [code, setCode] = useState(editing?.code ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [type, setType] = useState<VoucherType>(editing?.discountType ?? 'FIXED_AMOUNT');
  const [value, setValue] = useState(editing?.discountValue ?? 0);
  const [maxDiscount, setMaxDiscount] = useState(editing?.maxDiscountAmount ?? 0);
  const [minOrder, setMinOrder] = useState(editing?.minOrderAmount ?? 0);
  const [maxUsage, setMaxUsage] = useState(editing?.maxUsage ?? 100);
  const [perUser, setPerUser] = useState(editing?.perUserLimit ?? 1);
  const [onlyNew, setOnlyNew] = useState(editing?.onlyNewCustomer ?? false);
  // Khởi tạo lười: chỉ tính "30 ngày tới" một lần khi mở form
  const [endDate, setEndDate] = useState<Date>(() =>
    editing ? new Date(editing.endDate) : new Date(Date.now() + 30 * 86_400_000),
  );

  const autoTitle = voucherHeadline({ discountType: type, discountValue: value, maxDiscountAmount: maxDiscount || null });

  const validate = (): string | null => {
    if (!isEdit && !/^[A-Z0-9]{4,20}$/.test(code)) return 'Mã gồm 4–20 chữ cái in hoa hoặc số, không dấu';
    if (type === 'FIXED_AMOUNT' && value < 1000) return 'Số tiền giảm tối thiểu 1.000 ₫';
    if (type === 'PERCENTAGE' && (value < 1 || value > 100)) return 'Giảm theo % phải từ 1 đến 100';
    if (type === 'PERCENTAGE' && maxDiscount < 1000) return 'Mã giảm % cần mức giảm tối đa';
    if (maxUsage < 1) return 'Tổng lượt dùng tối thiểu 1';
    if (editing && maxUsage < editing.usedCount) return `Tổng lượt không nhỏ hơn số đã dùng (${editing.usedCount})`;
    if (perUser < 1) return 'Mỗi khách dùng tối thiểu 1 lượt';
    if (endDate.getTime() <= Date.now()) return 'Ngày hết hạn phải ở tương lai';
    return null;
  };

  const submit = async () => {
    const error = validate();
    if (error) {
      toast(error, 'error');
      return;
    }
    const base: Partial<VoucherInput> = {
      title: title.trim() || autoTitle,
      maxUsage,
      perUserLimit: perUser,
      endDate: endDate.toISOString(),
      onlyNewCustomer: onlyNew,
    };
    if (!locked) {
      base.discountValue = value;
      base.maxDiscountAmount = type === 'PERCENTAGE' ? maxDiscount : null;
      base.minOrderAmount = minOrder;
    }
    try {
      await save.mutateAsync(
        isEdit ? { id: editing!.id, data: base } : { data: { ...base, code, discountType: type } as VoucherInput },
      );
      toast(isEdit ? 'Đã cập nhật mã' : `Đã tạo mã ${code}`, 'success');
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast(Array.isArray(msg) ? msg[0] : msg || 'Không lưu được mã, vui lòng thử lại', 'error');
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isEdit ? `Sửa mã ${editing!.code}` : restaurantId ? 'Tạo mã giảm giá cho quán' : 'Tạo mã giảm giá toàn sàn'}
      footer={
        <View className="flex-row gap-3 pb-2">
          <Button label="Huỷ" variant="outline" size="md" className="flex-1" onPress={onClose} />
          <Button label={isEdit ? 'Lưu' : 'Tạo mã'} size="md" className="flex-1" loading={save.isPending} onPress={submit} />
        </View>
      }
    >
      <ScrollView className="max-h-[520px]" contentContainerClassName="gap-4 pb-4" keyboardShouldPersistTaps="handled">
        {restaurantId && !isEdit && (
          <View className="rounded-xl bg-warning-soft p-3">
            <Text variant="caption" weight="medium" tone="warning">
              Mã của quán do quán chịu chi phí: số tiền giảm được trừ vào doanh thu của quán.
            </Text>
          </View>
        )}
        {locked && (
          <View className="rounded-xl bg-info-soft p-3">
            <Text variant="caption" weight="medium">
              Mã đã có {editing!.usedCount} lượt dùng nên không đổi được mức giảm và đơn tối thiểu. Muốn đổi, hãy tạo mã mới.
            </Text>
          </View>
        )}

        <Input
          label="Mã (khách sẽ nhập)"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          placeholder="VD: GIAM20K"
          editable={!isEdit}
          leftIcon="pricetag-outline"
        />

        <View className="gap-2">
          <Text variant="caption" weight="semibold" tone="secondary">
            Loại ưu đãi
          </Text>
          <View className="flex-row gap-2">
            {TYPES.map((t) => {
              const active = type === t.value;
              return (
                <Pressable
                  key={t.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: isEdit }}
                  disabled={isEdit}
                  onPress={() => setType(t.value)}
                  className={cn(
                    'flex-1 items-center rounded-xl border py-2.5',
                    active ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                    isEdit && !active ? 'opacity-40' : '',
                  )}
                >
                  <Text variant="caption" weight="semibold" tone={active ? 'brand' : 'default'}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="flex-row gap-3">
          <NumberField
            label={type === 'PERCENTAGE' ? 'Phần trăm giảm' : type === 'FREE_SHIP' ? 'Giảm ship tối đa' : 'Số tiền giảm'}
            value={value}
            onChange={setValue}
            suffix={type === 'PERCENTAGE' ? '%' : '₫'}
            hint={type === 'FREE_SHIP' ? 'Để 0 = miễn toàn bộ phí ship' : undefined}
            disabled={locked}
          />
          {type === 'PERCENTAGE' && (
            <NumberField label="Giảm tối đa" value={maxDiscount} onChange={setMaxDiscount} suffix="₫" disabled={locked} />
          )}
        </View>

        <NumberField label="Đơn tối thiểu (tiền món)" value={minOrder} onChange={setMinOrder} suffix="₫" disabled={locked} />

        <View className="flex-row gap-3">
          <NumberField label="Tổng lượt dùng" value={maxUsage} onChange={setMaxUsage} />
          <NumberField label="Mỗi khách dùng" value={perUser} onChange={setPerUser} hint="lượt" />
        </View>

        <View className="gap-2">
          <Text variant="caption" weight="semibold" tone="secondary">
            Hết hạn: {fmtDate(endDate)}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                onPress={() => setEndDate(new Date(Date.now() + d * 86_400_000))}
                className="rounded-full border border-line bg-surface px-3 py-1.5 active:bg-brand-50"
              >
                <Text variant="caption" weight="medium">
                  {d} ngày
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-3 rounded-xl bg-canvas-subtle p-3">
          <View className="flex-1">
            <Text variant="body" weight="semibold">
              Chỉ dành cho khách mới
            </Text>
            <Text variant="caption" weight="regular" tone="secondary">
              Khách chưa có đơn giao thành công nào
            </Text>
          </View>
          <Switch
            value={onlyNew}
            onValueChange={setOnlyNew}
            trackColor={{ true: palette.brand['500'], false: palette.line.DEFAULT }}
            thumbColor="#fff"
          />
        </View>

        <Input
          label="Tên hiển thị cho khách"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          placeholder={autoTitle}
          hint="Để trống sẽ dùng mô tả tự động"
        />

        {value > 0 && (
          <Text variant="caption" weight="regular" tone="muted">
            Khách sẽ thấy: {title.trim() || autoTitle}
            {minOrder > 0 ? ` · đơn từ ${formatVND(minOrder)}` : ''}
          </Text>
        )}
      </ScrollView>
    </BottomSheet>
  );
};
