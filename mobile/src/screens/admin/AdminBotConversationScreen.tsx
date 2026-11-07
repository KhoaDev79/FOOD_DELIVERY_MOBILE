import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListSkeleton } from '../../components/modules/admin/AdminKit';
import { clockTime, dayLabel, MetricChip, NoticeCard } from '../../components/modules/partner/PartnerKit';
import { cn, Icon, Text, TopBar } from '../../components/ui';
import { useAdminBotConversation } from '../../services/useHelp';
import { BotConversationDetail } from '../../types/api';
import { formatLatency } from '../../utils/helpQuality';

type Message = BotConversationDetail['messages'][number];

const SOURCE_LABEL: Record<string, string> = { GEMINI: 'AI', SCRIPT: 'Kịch bản', CACHE: 'Đã lưu' };

/** Admin xem lại một hội thoại với Trợ lý tự động (chỉ đọc, thông tin cá nhân đã được che). */
export const AdminBotConversationScreen: React.FC<{ navigation: any; route: { params: { conversationId: string } } }> = ({
  navigation,
  route,
}) => {
  const { data, isLoading, isError } = useAdminBotConversation(route.params.conversationId);
  const messages = data?.messages ?? [];
  const unhelpful = messages.filter((m) => m.feedback === 'UNHELPFUL').length;
  const unresolved = messages.filter((m) => m.unresolved).length;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <View className="bg-canvas">
        <TopBar title={data?.customerName ?? 'Hội thoại'} onLeadingPress={() => navigation.goBack()} />
      </View>

      {isLoading ? (
        <View className="p-4">
          <ListSkeleton rows={5} />
        </View>
      ) : isError || !data ? (
        <NoticeCard tone="danger" icon="alert-circle" title="Không tải được hội thoại" className="m-4" />
      ) : (
        <ScrollView contentContainerClassName="gap-3 p-4 pb-12">
          <View className="gap-2 rounded-2xl bg-surface p-4 shadow-card">
            <Text variant="caption" tone="secondary">
              Bắt đầu {dayLabel(data.createdAt).toLowerCase()} lúc {clockTime(data.createdAt)}
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              <MetricChip icon="chatbubble-outline" label={`${messages.length} tin nhắn`} />
              {unresolved > 0 && <MetricChip icon="help-circle-outline" label={`${unresolved} chưa giải quyết`} tone="danger" />}
              {unhelpful > 0 && <MetricChip icon="thumbs-down-outline" label={`${unhelpful} 👎`} tone="warning" />}
              <MetricChip icon="shield-checkmark-outline" label="Đã che SĐT, email" tone="success" />
            </View>
          </View>

          {messages.map((m, i) => {
            const newDay = i === 0 || dayLabel(m.createdAt) !== dayLabel(messages[i - 1].createdAt);
            return (
              <React.Fragment key={m.id}>
                {newDay && (
                  <Text variant="micro" weight="semibold" tone="muted" className="text-center">
                    {dayLabel(m.createdAt)}
                  </Text>
                )}
                <Bubble message={m} />
              </React.Fragment>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const Bubble: React.FC<{ message: Message }> = ({ message: m }) => {
  const mine = m.role === 'user';
  const flagged = m.unresolved || m.feedback === 'UNHELPFUL';
  return (
    <View className={cn('max-w-[85%] gap-1', mine ? 'self-end items-end' : 'self-start items-start')}>
      {!mine && (
        <View className="flex-row items-center gap-1">
          <Icon name="sparkles" size={12} tone="violet" />
          <Text variant="micro" weight="semibold" tone="secondary">
            Trợ lý · {SOURCE_LABEL[m.source ?? ''] ?? m.source ?? 'Bot'}
            {m.latencyMs ? ` · ${formatLatency(m.latencyMs)}` : ''}
          </Text>
        </View>
      )}
      <View
        className={cn(
          'rounded-2xl px-3.5 py-2.5',
          mine ? 'rounded-br-md bg-brand-500' : flagged ? 'rounded-bl-md border border-danger bg-danger-soft' : 'rounded-bl-md bg-surface',
        )}
      >
        <Text variant="body" weight="regular" tone={mine ? 'inverse' : 'default'}>
          {m.content}
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center gap-1.5">
        <Text variant="micro" weight="regular" tone="muted">
          {clockTime(m.createdAt)}
        </Text>
        {m.unresolved && <MetricChip icon="help-circle-outline" label="Bot không hiểu" tone="danger" />}
        {m.feedback === 'UNHELPFUL' && <MetricChip icon="thumbs-down" label="Khách: chưa hữu ích" tone="warning" />}
        {m.feedback === 'HELPFUL' && <MetricChip icon="thumbs-up" label="Khách: hữu ích" tone="success" />}
      </View>
    </View>
  );
};
