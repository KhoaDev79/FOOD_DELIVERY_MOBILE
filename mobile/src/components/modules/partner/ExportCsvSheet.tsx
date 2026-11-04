import React, { useState } from 'react';
import { View } from 'react-native';
import { dmy, EXPORT_PRESETS, exportFileName, ExportPreset, presetRange } from '../../../utils/exportRange';
import { saveCsv } from '../../../utils/saveCsv';
import { BottomSheet, Button, FilterChip, Icon, Text, useToast } from '../../ui';

/**
 * Bảng xuất CSV dùng chung (admin: đơn hàng, chủ quán: doanh thu): chọn nhanh kỳ, tải file,
 * mở bảng chia sẻ để lưu vào Files/Drive hoặc mở bằng Excel.
 */
export const ExportCsvSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Mô tả nội dung file (các cột chính). */
  description: string;
  /** Tiền tố tên file, vd "zomzom-don-hang". */
  filePrefix: string;
  /** Gọi API, trả nội dung CSV. */
  fetchCsv: (from: string, to: string) => Promise<string>;
}> = ({ visible, onClose, title, description, filePrefix, fetchCsv }) => {
  const toast = useToast();
  const [preset, setPreset] = useState<ExportPreset>('30d');
  const [loading, setLoading] = useState(false);
  const range = presetRange(preset);

  const run = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const csv = await fetchCsv(range.from, range.to);
      const how = await saveCsv(exportFileName(filePrefix, range.from, range.to), csv);
      toast(how === 'downloaded' ? 'Đã tải file CSV' : 'File CSV đã sẵn sàng', 'success');
      onClose();
    } catch (err: any) {
      // Gọi với responseType 'text' nên lỗi JSON của backend đến dưới dạng chuỗi
      let body = err?.response?.data;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = null;
        }
      }
      const msg = body?.message;
      toast((typeof msg === 'string' && msg) || err?.message || 'Không xuất được file', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => !loading && onClose()}
      title={title}
      footer={
        <View className="pb-2">
          <Button label="Tải file CSV" leftIcon="download-outline" size="lg" loading={loading} onPress={run} />
        </View>
      }
    >
      <View className="gap-4 pb-4">
        <Text variant="body" weight="regular" tone="secondary">
          {description}
        </Text>
        <View className="gap-2">
          <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
            Khoảng thời gian
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {EXPORT_PRESETS.map((p) => (
              <FilterChip key={p.key} label={p.label} selected={preset === p.key} onPress={() => setPreset(p.key)} />
            ))}
          </View>
          <View className="flex-row items-center gap-2 rounded-xl bg-canvas-subtle px-3 py-2.5">
            <Icon name="calendar-outline" size="sm" tone="brand" />
            <Text variant="body" weight="semibold">
              {dmy(range.from)} – {dmy(range.to)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5">
          <Icon name="information-circle-outline" size="sm" tone="brand" />
          <Text variant="caption" weight="regular" tone="secondary" className="flex-1">
            File mở được bằng Excel, Google Sheets. Số tiền để dạng số (không dấu chấm) để cộng/lọc được ngay.
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
};
