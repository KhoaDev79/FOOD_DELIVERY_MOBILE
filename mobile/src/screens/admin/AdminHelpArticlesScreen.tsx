import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListSkeleton } from '../../components/modules/admin/AdminKit';
import { MetricChip, NoticeCard, SegmentedTabs } from '../../components/modules/partner/PartnerKit';
import { Button, cn, EmptyState, FilterChip, Icon, SearchBar, Text, TopBar } from '../../components/ui';
import { useAdminHelpArticles, useAdminHelpCategories } from '../../services/useHelp';
import { palette } from '../../theme';
import { HelpArticle, HelpAudience } from '../../types/api';
import { articleQuality, percent } from '../../utils/helpQuality';

const AUDIENCES: { key: HelpAudience; label: string }[] = [
  { key: 'CUSTOMER', label: 'Khách hàng' },
  { key: 'DRIVER', label: 'Tài xế' },
  { key: 'OWNER', label: 'Chủ quán' },
];

type StatusFilter = 'all' | 'rewrite' | 'hidden';

/** Màu thanh tỉ lệ 👍 theo mức chất lượng (luôn đủ 4 lớp, không bật/tắt lớp đặc biệt). */
const BAR_COLOR = { good: 'bg-success', ok: 'bg-warning', bad: 'bg-danger', unknown: 'bg-line' } as const;

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

/** Admin: danh sách bài Trợ giúp (FAQ) kèm lượt xem, 👍 👎 để biết bài nào cần viết lại. */
export const AdminHelpArticlesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [audience, setAudience] = useState<HelpAudience>('CUSTOMER');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [q, setQ] = useState('');

  const categoriesQuery = useAdminHelpCategories();
  const articlesQuery = useAdminHelpArticles();

  const categories = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => c.audience === audience),
    [categoriesQuery.data, audience],
  );
  // Bài của nhóm người dùng đang chọn
  const scoped = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    return (articlesQuery.data ?? []).filter((a) => ids.has(a.categoryId));
  }, [articlesQuery.data, categories]);

  const summary = useMemo(() => {
    let views = 0;
    let up = 0;
    let down = 0;
    let rewrite = 0;
    let hidden = 0;
    for (const a of scoped) {
      views += a.viewCount;
      up += a.helpfulCount;
      down += a.notHelpfulCount;
      if (articleQuality(a).needsRewrite) rewrite += 1;
      if (!a.isActive) hidden += 1;
    }
    return { views, rate: up + down > 0 ? up / (up + down) : null, rewrite, hidden };
  }, [scoped]);

  const list = useMemo(() => {
    const needle = fold(q.trim());
    return scoped
      .filter((a) => !categoryId || a.categoryId === categoryId)
      .filter((a) => (status === 'rewrite' ? articleQuality(a).needsRewrite : status === 'hidden' ? !a.isActive : true))
      .filter((a) => !needle || fold(`${a.title} ${a.keywords.join(' ')}`).includes(needle))
      .sort((a, b) => {
        // Bài cần viết lại lên đầu, rồi bài được xem nhiều
        const ra = articleQuality(a).needsRewrite ? 1 : 0;
        const rb = articleQuality(b).needsRewrite ? 1 : 0;
        return rb - ra || b.viewCount - a.viewCount;
      });
  }, [scoped, categoryId, status, q]);

  const loading = categoriesQuery.isLoading || articlesQuery.isLoading;
  const openEditor = (article?: HelpArticle) =>
    navigation.navigate('AdminHelpArticleEdit', article ? { articleId: article.id } : { audience, categoryId: categoryId ?? undefined });

  const header = (
    <View className="gap-3 pb-1">
      <SegmentedTabs
        items={AUDIENCES}
        value={audience}
        onChange={(a) => {
          setAudience(a);
          setCategoryId(null);
        }}
        trackClassName="bg-line"
      />

      {/* Tổng quan chất lượng */}
      <View className="flex-row gap-2.5">
        <SummaryTile icon="eye" tone="info" box="bg-info-soft" label="Lượt xem" value={summary.views.toLocaleString('vi-VN')} />
        <SummaryTile icon="thumbs-up" tone="success" box="bg-success-soft" label="Hữu ích" value={percent(summary.rate)} />
        <SummaryTile
          icon="create"
          tone="danger"
          box="bg-danger-soft"
          label="Cần viết lại"
          value={String(summary.rewrite)}
          onPress={() => setStatus(status === 'rewrite' ? 'all' : 'rewrite')}
        />
      </View>

      {summary.rewrite > 0 && status !== 'rewrite' && (
        <NoticeCard
          tone="warning"
          icon="bulb"
          title={`${summary.rewrite} bài bị đánh giá chưa hữu ích`}
          message="Dưới 60% khách bấm 👍 (từ 3 lượt đánh giá). Viết lại ngắn gọn, có các bước rõ ràng."
          actionLabel="Xem"
          onPress={() => setStatus('rewrite')}
        />
      )}

      <SearchBar value={q} onChangeText={setQ} onClear={() => setQ('')} placeholder="Tìm theo tiêu đề, từ khoá" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        <FilterChip label="Tất cả mục" selected={!categoryId} onPress={() => setCategoryId(null)} />
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            label={`${c.name} · ${scoped.filter((a) => a.categoryId === c.id).length}`}
            selected={categoryId === c.id}
            onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
          />
        ))}
      </ScrollView>

      <View className="flex-row gap-2">
        {(
          [
            { key: 'all', label: `Tất cả · ${scoped.length}` },
            { key: 'rewrite', label: `Cần viết lại · ${summary.rewrite}` },
            { key: 'hidden', label: `Đang ẩn · ${summary.hidden}` },
          ] as { key: StatusFilter; label: string }[]
        ).map((s) => (
          <FilterChip key={s.key} label={s.label} selected={status === s.key} onPress={() => setStatus(s.key)} />
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <View className="bg-canvas">
        <TopBar
          title="Bài viết trợ giúp"
          onLeadingPress={() => navigation.goBack()}
          trailing={<Button label="Viết bài" leftIcon="add" size="sm" onPress={() => openEditor()} />}
        />
      </View>

      {loading ? (
        <View className="p-4">
          <ListSkeleton rows={6} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(a) => a.id}
          contentContainerClassName="gap-2.5 p-4 pb-12"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={articlesQuery.isRefetching}
              onRefresh={() => {
                void articlesQuery.refetch();
                void categoriesQuery.refetch();
              }}
              colors={[palette.brand['500']]}
              tintColor={palette.brand['500']}
            />
          }
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title={scoped.length ? 'Không có bài phù hợp' : 'Chưa có bài viết'}
              description={scoped.length ? 'Thử đổi bộ lọc hoặc từ khoá.' : 'Viết bài đầu tiên để khách tự tìm câu trả lời.'}
              actionLabel={scoped.length ? undefined : 'Viết bài'}
              onAction={scoped.length ? undefined : () => openEditor()}
            />
          }
          renderItem={({ item }) => <ArticleRow article={item} onPress={() => openEditor(item)} />}
        />
      )}
    </SafeAreaView>
  );
};

const SummaryTile: React.FC<{
  icon: React.ComponentProps<typeof Icon>['name'];
  tone: 'info' | 'success' | 'danger';
  box: string;
  label: string;
  value: string;
  onPress?: () => void;
}> = ({ icon, tone, box, label, value, onPress }) => (
  <Pressable
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${label}: ${value}`}
    disabled={!onPress}
    onPress={onPress}
    className="flex-1 gap-1.5 rounded-2xl bg-surface p-3 shadow-card active:opacity-90"
  >
    <View className={cn('h-8 w-8 items-center justify-center rounded-full', box)}>
      <Icon name={icon} size="sm" tone={tone} />
    </View>
    <Text variant="title" weight="bold" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
      {value}
    </Text>
    <Text variant="micro" weight="medium" tone="muted" numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

const ArticleRow: React.FC<{ article: HelpArticle; onPress: () => void }> = ({ article: a, onPress }) => {
  const quality = articleQuality(a);
  const pct = quality.helpfulRate === null ? 0 : Math.round(quality.helpfulRate * 100);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sửa bài ${a.title}`}
      onPress={onPress}
      className="gap-2.5 rounded-2xl bg-surface p-4 shadow-card active:opacity-95"
    >
      <View className="flex-row items-start gap-3">
        <View
          className={cn(
            'h-10 w-10 items-center justify-center rounded-xl',
            quality.needsRewrite ? 'bg-danger-soft' : a.isActive ? 'bg-brand-50' : 'bg-canvas-subtle',
          )}
        >
          <Icon
            name={quality.needsRewrite ? 'alert-circle' : 'document-text'}
            size="md"
            tone={quality.needsRewrite ? 'danger' : a.isActive ? 'brand' : 'muted'}
          />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight="bold" numberOfLines={2} tone={a.isActive ? 'default' : 'muted'}>
            {a.title}
          </Text>
          <Text variant="micro" weight="regular" tone="muted" numberOfLines={1}>
            {a.category?.name ?? 'Chưa có mục'} · sửa {new Date(a.updatedAt).toLocaleDateString('vi-VN')}
          </Text>
        </View>
        <Icon name="chevron-forward" size="sm" tone="muted" />
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        <MetricChip icon="eye-outline" label={`${a.viewCount.toLocaleString('vi-VN')} lượt xem`} />
        <MetricChip icon="thumbs-up-outline" label={String(a.helpfulCount)} tone="success" />
        <MetricChip icon="thumbs-down-outline" label={String(a.notHelpfulCount)} tone={a.notHelpfulCount ? 'danger' : 'neutral'} />
        {quality.needsRewrite && <MetricChip icon="create-outline" label="Cần viết lại" tone="danger" />}
        {!a.isActive && <MetricChip icon="eye-off-outline" label="Đang ẩn" tone="warning" />}
      </View>

      {/* Thanh tỉ lệ hữu ích */}
      <View className="flex-row items-center gap-2.5">
        <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas-subtle">
          <View className={cn('h-full rounded-full', BAR_COLOR[quality.level])} style={{ width: `${pct}%` }} />
        </View>
        <Text variant="micro" weight="semibold" tone="secondary" className="min-w-[96px] text-right">
          {quality.votes === 0
            ? 'Chưa có đánh giá'
            : quality.level === 'unknown'
              ? `${pct}% · ${quality.votes} lượt`
              : `${pct}% hữu ích`}
        </Text>
      </View>
    </Pressable>
  );
};
