import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, HBarChart, KpiCard, KpiSkeleton, ListSkeleton } from '../../components/modules/admin/AdminKit';
import { MetricChip, NoticeCard, SectionCard, SegmentedTabs, timeAgo } from '../../components/modules/partner/PartnerKit';
import { Button, cn, Icon, Text, TopBar } from '../../components/ui';
import { useAdminBotConversations, useAdminBotStats } from '../../services/useHelp';
import { palette } from '../../theme';
import { BotConversationSummary, BotUnansweredQuestion } from '../../types/api';
import { formatLatency, percent } from '../../utils/helpQuality';

type Range = '7' | '30' | '90';

const SOURCE_META: Record<string, { label: string; bar: string }> = {
  GEMINI: { label: 'AI trả lời', bar: 'bg-violet-strong' },
  SCRIPT: { label: 'Kịch bản sẵn', bar: 'bg-brand-400' },
  CACHE: { label: 'Câu trả lời đã lưu', bar: 'bg-info' },
};

/** Admin: chất lượng Trợ lý tự động (chatbot) – khách có được giúp không, câu nào cần viết thêm FAQ. */
export const AdminBotInsightsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [range, setRange] = useState<Range>('30');
  const [onlyProblems, setOnlyProblems] = useState(true);
  const stats = useAdminBotStats(Number(range));
  const convs = useAdminBotConversations(onlyProblems);
  const s = stats.data;

  const handoverByDay = useMemo(() => new Map((s?.daily ?? []).map((d) => [d.date, d.handovers])), [s?.daily]);
  const chartData = useMemo(
    () =>
      (s?.daily ?? []).map((d, i, arr) => ({
        key: d.date,
        label: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`,
        value: d.conversations,
        highlight: i === arr.length - 1,
      })),
    [s?.daily],
  );
  const conversations = convs.data?.pages.flatMap((p) => p.items) ?? [];
  const totalConvs = convs.data?.pages[0]?.total ?? 0;

  const writeFaq = (q: BotUnansweredQuestion) => navigation.navigate('AdminHelpArticleEdit', { draftQuestion: q.question });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <View className="bg-canvas">
        <TopBar title="Trợ lý tự động" onLeadingPress={() => navigation.goBack()} />
      </View>

      <ScrollView
        contentContainerClassName="gap-3 p-4 pb-12"
        refreshControl={
          <RefreshControl
            refreshing={stats.isRefetching}
            onRefresh={() => {
              void stats.refetch();
              void convs.refetch();
            }}
            colors={[palette.brand['500']]}
            tintColor={palette.brand['500']}
          />
        }
      >
        <SegmentedTabs
          items={[
            { key: '7', label: '7 ngày' },
            { key: '30', label: '30 ngày' },
            { key: '90', label: '90 ngày' },
          ]}
          value={range}
          onChange={setRange}
          trackClassName="bg-line"
        />

        {/* Chỉ số chính */}
        <View className="flex-row flex-wrap gap-2.5">
          {!s ? (
            Array.from({ length: 4 }, (_, i) => <KpiSkeleton key={i} />)
          ) : (
            <>
              <KpiCard
                label="Hội thoại"
                value={s.conversations.toLocaleString('vi-VN')}
                icon="chatbubbles"
                iconTone="brand"
                caption={`${s.userMessages} câu hỏi của khách`}
              />
              <KpiCard
                label="Hữu ích"
                value={percent(s.helpfulRate)}
                icon="thumbs-up"
                iconTone="success"
                iconBox="bg-success-soft"
                caption={`${s.helpful} 👍 · ${s.unhelpful} 👎`}
              />
              <KpiCard
                label="Gặp nhân viên"
                value={percent(s.handoverRate)}
                icon="people"
                iconTone="warning"
                iconBox="bg-warning-soft"
                caption={`${s.handovers} phiếu hỗ trợ`}
                onPress={() => navigation.navigate('AdminSupportTickets')}
              />
              <KpiCard
                label="Chưa giải quyết"
                value={percent(s.unresolvedRate)}
                icon="help-circle"
                iconTone="danger"
                iconBox="bg-danger-soft"
                caption={`${s.unresolvedReplies}/${s.botReplies} câu trả lời`}
              />
            </>
          )}
        </View>

        {s && (
          <View className="flex-row items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-card">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-info-soft">
              <Icon name="flash" size="sm" tone="info" />
            </View>
            <View className="flex-1">
              <Text variant="caption" tone="secondary">
                Thời gian trả lời trung bình
              </Text>
              <Text variant="body" weight="bold">
                {formatLatency(s.avgLatencyMs)}
              </Text>
            </View>
            <MetricChip
              icon={s.avgLatencyMs !== null && s.avgLatencyMs > 5000 ? 'warning-outline' : 'checkmark-circle-outline'}
              label={s.avgLatencyMs === null ? 'Chưa có dữ liệu' : s.avgLatencyMs > 5000 ? 'Hơi chậm' : 'Tốt'}
              tone={s.avgLatencyMs !== null && s.avgLatencyMs > 5000 ? 'warning' : 'success'}
            />
          </View>
        )}

        <SectionCard title="Hội thoại theo ngày" icon="bar-chart" iconTone="info" iconBox="bg-info-soft">
          {!s ? (
            <ListSkeleton rows={2} />
          ) : (
            <BarChart
              data={chartData}
              height={130}
              emptyText="Chưa có hội thoại nào trong khoảng này"
              hint={Number(range) > 31 ? 'Biểu đồ hiển thị 31 ngày gần nhất' : undefined}
              formatValue={(v, d) => `${d.label}: ${v} hội thoại · ${handoverByDay.get(d.key) ?? 0} chuyển nhân viên`}
            />
          )}
        </SectionCard>

        <SectionCard title="Bot trả lời bằng" icon="git-branch" iconTone="violet" iconBox="bg-violet-soft">
          <HBarChart
            emptyText="Chưa có câu trả lời nào"
            items={(s?.bySource ?? [])
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((x) => ({
                key: x.source,
                label: SOURCE_META[x.source]?.label ?? x.source,
                value: x.count,
                valueLabel: `${x.count} · ${percent(s && s.botReplies ? x.count / s.botReplies : null)}`,
                barClassName: SOURCE_META[x.source]?.bar,
              }))}
          />
        </SectionCard>

        {/* Gợi ý viết FAQ */}
        <SectionCard
          title="Câu hỏi bot chưa trả lời được"
          icon="bulb"
          iconTone="warning"
          iconBox="bg-warning-soft"
          right={s && s.unanswered.length > 0 ? <MetricChip label={String(s.unanswered.length)} tone="warning" /> : undefined}
        >
          {!s ? (
            <ListSkeleton rows={3} />
          ) : s.unanswered.length === 0 ? (
            <View className="flex-row items-center gap-2 rounded-xl bg-success-soft p-3">
              <Icon name="checkmark-circle" size="md" tone="success" />
              <Text variant="caption" weight="medium" tone="success" className="flex-1">
                Tuyệt! Không có câu hỏi nào bị bỏ ngỏ trong khoảng này.
              </Text>
            </View>
          ) : (
            <>
              <Text variant="micro" weight="regular" tone="muted">
                Câu khách hỏi ngay trước câu trả lời bị 👎 hoặc bot không hiểu. Viết bài FAQ cho các câu này để bot trả lời tốt hơn.
              </Text>
              {s.unanswered.map((q, i) => (
                <UnansweredRow key={`${q.question}-${i}`} item={q} onWrite={() => writeFaq(q)} />
              ))}
            </>
          )}
        </SectionCard>

        {/* Xem lại hội thoại */}
        <SectionCard title="Xem lại hội thoại" icon="chatbubble-ellipses" iconTone="brand">
          <NoticeCard
            tone="brand"
            icon="shield-checkmark"
            title="Đã che thông tin cá nhân"
            message="Số điện thoại và email của khách được ẩn trước khi lưu. Chỉ admin xem được."
          />
          <View className="flex-row items-center gap-3">
            <Text variant="body" weight="semibold" className="flex-1">
              Chỉ hội thoại có vấn đề
            </Text>
            <Switch
              value={onlyProblems}
              onValueChange={setOnlyProblems}
              trackColor={{ false: palette.line.DEFAULT, true: palette.brand['500'] }}
              thumbColor={palette.surface}
            />
          </View>
          {convs.isLoading ? (
            <ListSkeleton rows={3} />
          ) : conversations.length === 0 ? (
            <Text variant="caption" weight="regular" tone="muted" className="py-2 text-center">
              {onlyProblems ? 'Không có hội thoại nào bị 👎 hoặc chưa giải quyết.' : 'Chưa có hội thoại nào.'}
            </Text>
          ) : (
            <View className="gap-2">
              {conversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  item={c}
                  onPress={() => navigation.navigate('AdminBotConversation', { conversationId: c.id })}
                />
              ))}
              {convs.hasNextPage && (
                <Button
                  label={`Xem thêm (${totalConvs - conversations.length})`}
                  variant="secondary"
                  size="sm"
                  loading={convs.isFetchingNextPage}
                  onPress={() => {
                    void convs.fetchNextPage();
                  }}
                />
              )}
            </View>
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const UnansweredRow: React.FC<{ item: BotUnansweredQuestion; onWrite: () => void }> = ({ item, onWrite }) => (
  <View className="gap-2 rounded-xl border border-line-subtle p-3">
    <View className="flex-row items-start gap-2.5">
      <View className="h-7 min-w-[28px] items-center justify-center rounded-full bg-warning-soft px-1.5">
        <Text variant="micro" weight="bold" tone="warning">
          {item.count}×
        </Text>
      </View>
      <Text variant="body" weight="semibold" className="flex-1" numberOfLines={3}>
        “{item.question}”
      </Text>
    </View>
    <View className="flex-row flex-wrap items-center gap-1.5">
      {item.reasons.includes('UNRESOLVED') && <MetricChip icon="help-circle-outline" label="Bot không hiểu" tone="danger" />}
      {item.reasons.includes('UNHELPFUL') && <MetricChip icon="thumbs-down-outline" label="Khách bấm 👎" tone="warning" />}
      <Text variant="micro" weight="regular" tone="muted" className="flex-1">
        {timeAgo(item.lastAskedAt)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Viết bài FAQ cho câu hỏi ${item.question}`}
        onPress={onWrite}
        className="h-8 flex-row items-center gap-1 rounded-full bg-brand-500 px-3 active:opacity-80"
      >
        <Icon name="create-outline" size="xs" tone="inverse" />
        <Text variant="caption" weight="bold" tone="inverse">
          Viết FAQ
        </Text>
      </Pressable>
    </View>
  </View>
);

const ConversationRow: React.FC<{ item: BotConversationSummary; onPress: () => void }> = ({ item, onPress }) => {
  const problem = item.unresolved || item.unhelpfulCount > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem hội thoại của ${item.customerName}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-line-subtle p-3 active:bg-canvas-subtle"
    >
      <View className={cn('h-10 w-10 items-center justify-center rounded-full', problem ? 'bg-danger-soft' : 'bg-brand-50')}>
        <Icon name={problem ? 'alert' : 'chatbubbles'} size="sm" tone={problem ? 'danger' : 'brand'} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text variant="body" weight="semibold" numberOfLines={1} className="flex-1">
            {item.customerName}
          </Text>
          <Text variant="micro" weight="regular" tone="muted">
            {timeAgo(item.lastMessageAt)}
          </Text>
        </View>
        <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
          {item.firstQuestion || '(Chưa hỏi gì)'}
        </Text>
        <View className="mt-1 flex-row flex-wrap gap-1.5">
          <MetricChip icon="chatbubble-outline" label={`${item.messageCount} tin`} />
          {item.unresolved && <MetricChip label="Chưa giải quyết" tone="danger" />}
          {item.unhelpfulCount > 0 && <MetricChip icon="thumbs-down-outline" label={String(item.unhelpfulCount)} tone="warning" />}
          {item.helpfulCount > 0 && <MetricChip icon="thumbs-up-outline" label={String(item.helpfulCount)} tone="success" />}
        </View>
      </View>
      <Icon name="chevron-forward" size="sm" tone="muted" />
    </Pressable>
  );
};
