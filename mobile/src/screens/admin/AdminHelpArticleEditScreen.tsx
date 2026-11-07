import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeywordInput } from '../../components/modules/admin/ContentKit';
import { ArticleBody } from '../../components/modules/help/ArticleBody';
import { MetricChip, NoticeCard, SectionCard, SegmentedTabs } from '../../components/modules/partner/PartnerKit';
import {
  Button,
  ConfirmDialog,
  Divider,
  FilterChip,
  Icon,
  IconButton,
  Input,
  LoadingSpinner,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import {
  useAdminDeleteArticle,
  useAdminHelpArticles,
  useAdminHelpCategories,
  useAdminSaveArticle,
} from '../../services/useHelp';
import { palette } from '../../theme';
import { HelpArticle, HelpAudience } from '../../types/api';
import { articleQuality, keywordsFromQuestion, percent } from '../../utils/helpQuality';

export interface AdminHelpArticleEditParams {
  articleId?: string;
  audience?: HelpAudience;
  categoryId?: string;
  /** Câu khách hỏi mà Trợ lý tự động chưa trả lời được: dùng làm tiêu đề gợi ý. */
  draftQuestion?: string;
}

const AUDIENCE_LABEL: Record<HelpAudience, string> = { CUSTOMER: 'Khách hàng', DRIVER: 'Tài xế', OWNER: 'Chủ quán' };

/** Mẫu chèn nhanh cho người không quen cú pháp. */
const SNIPPETS: { label: string; icon: React.ComponentProps<typeof Icon>['name']; text: string }[] = [
  { label: 'Tiêu đề', icon: 'text', text: '## ' },
  { label: 'Gạch đầu dòng', icon: 'list', text: '- ' },
  { label: 'Bước 1, 2, 3', icon: 'list-circle', text: '1. ' },
];

/** "cho tôi món bún" -> "Cho tôi món bún?" */
const questionTitle = (q: string) => {
  const t = q.trim().replace(/[?.!\s]*$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1) + '?';
};

const TEMPLATE = '## Cách làm\n1. \n2. \n3. \n\n## Lưu ý\n- ';

interface Draft {
  audience: HelpAudience;
  categoryId: string | null;
  title: string;
  body: string;
  keywords: string[];
  isActive: boolean;
}

/** Admin soạn / sửa một bài Trợ giúp, có tab xem trước giống hệt màn khách đọc. */
export const AdminHelpArticleEditScreen: React.FC<{ navigation: any; route: { params?: AdminHelpArticleEditParams } }> = ({
  navigation,
  route,
}) => {
  const params = route.params ?? {};
  const toast = useToast();
  const categoriesQuery = useAdminHelpCategories();
  const articlesQuery = useAdminHelpArticles();
  const article = params.articleId ? articlesQuery.data?.find((a) => a.id === params.articleId) : undefined;

  if (categoriesQuery.isLoading || (params.articleId && articlesQuery.isLoading)) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
        <View className="bg-canvas">
          <TopBar title="Bài viết" onLeadingPress={() => navigation.goBack()} />
        </View>
        <LoadingSpinner message="Đang tải bài viết..." />
      </SafeAreaView>
    );
  }
  if (params.articleId && !article) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
        <View className="bg-canvas">
          <TopBar title="Bài viết" onLeadingPress={() => navigation.goBack()} />
        </View>
        <NoticeCard tone="danger" icon="alert-circle" title="Không tìm thấy bài viết" message="Bài có thể đã bị xoá." className="m-4" />
      </SafeAreaView>
    );
  }

  const categoryAudience = (id?: string) => categoriesQuery.data?.find((c) => c.id === id)?.audience;
  const initial: Draft = article
    ? {
        audience: categoryAudience(article.categoryId) ?? 'CUSTOMER',
        categoryId: article.categoryId,
        title: article.title,
        body: article.body,
        keywords: article.keywords ?? [],
        isActive: article.isActive,
      }
    : {
        audience: params.audience ?? categoryAudience(params.categoryId) ?? 'CUSTOMER',
        categoryId: params.categoryId ?? null,
        title: params.draftQuestion ? questionTitle(params.draftQuestion) : '',
        body: params.draftQuestion ? TEMPLATE : '',
        keywords: params.draftQuestion ? keywordsFromQuestion(params.draftQuestion) : [],
        isActive: true,
      };

  return <Editor navigation={navigation} article={article} initial={initial} draftQuestion={params.draftQuestion} toast={toast} />;
};

const Editor: React.FC<{
  navigation: any;
  article?: HelpArticle;
  initial: Draft;
  draftQuestion?: string;
  toast: ReturnType<typeof useToast>;
}> = ({ navigation, article, initial, draftQuestion, toast }) => {
  const [draft, setDraft] = useState<Draft>(initial);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selection, setSelection] = useState({ start: initial.body.length, end: initial.body.length });

  const categoriesQuery = useAdminHelpCategories();
  const save = useAdminSaveArticle();
  const remove = useAdminDeleteArticle();

  const categories = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => c.audience === draft.audience),
    [categoriesQuery.data, draft.audience],
  );
  const category = categories.find((c) => c.id === draft.categoryId);
  const quality = article ? articleQuality(article) : null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  // Sửa gì cũng ẩn dòng báo lỗi cũ
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  // Chèn mẫu tại vị trí con trỏ; nếu con trỏ đang giữa dòng thì xuống dòng trước
  const insert = (text: string) => {
    const { start, end } = selection;
    const before = draft.body.slice(0, start);
    const prefix = before.length && !before.endsWith('\n') ? '\n' : '';
    const body = before + prefix + text + draft.body.slice(end);
    const cursor = start + prefix.length + text.length;
    set('body', body);
    setSelection({ start: cursor, end: cursor });
    // Không điều khiển selection của ô nhập (trên iOS dễ làm nhảy con trỏ khi gõ nhanh); chỉ ghi nhớ vị trí
  };

  const submit = () => {
    if (!draft.categoryId) return setError('Chọn mục cho bài viết');
    if (draft.title.trim().length < 5) return setError('Tiêu đề tối thiểu 5 ký tự');
    if (draft.body.trim().length < 20) return setError('Nội dung quá ngắn (tối thiểu 20 ký tự)');
    setError(null);
    save.mutate(
      {
        id: article?.id,
        data: {
          categoryId: draft.categoryId,
          title: draft.title.trim(),
          body: draft.body.trim(),
          keywords: draft.keywords,
          isActive: draft.isActive,
        },
      },
      {
        onSuccess: () => {
          toast(article ? 'Đã lưu bài viết.' : draft.isActive ? 'Đã đăng bài viết.' : 'Đã lưu bài (đang ẩn).', 'success');
          navigation.goBack();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message;
          setError((Array.isArray(msg) ? msg.join('\n') : msg) || 'Không lưu được bài viết');
        },
      },
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas-subtle">
      <View className="bg-canvas">
        <TopBar
          title={article ? 'Sửa bài viết' : 'Viết bài mới'}
          onLeadingPress={() => navigation.goBack()}
          trailing={
            article ? (
              <IconButton icon="trash-outline" accessibilityLabel="Xoá bài viết" onPress={() => setConfirmDelete(true)} />
            ) : undefined
          }
        />
        <View className="px-4 pb-3">
          <SegmentedTabs
            items={[
              { key: 'edit', label: 'Soạn bài', icon: 'create-outline' },
              { key: 'preview', label: 'Xem trước', icon: 'eye-outline' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        {tab === 'edit' ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 p-4 pb-8">
            {!!draftQuestion && (
              <NoticeCard
                tone="brand"
                icon="chatbubble-ellipses"
                title="Khách đã hỏi Trợ lý tự động"
                message={`“${draftQuestion}” – bot chưa trả lời được. Viết bài để lần sau bot và khách tìm thấy.`}
              />
            )}

            {article && quality && (
              <SectionCard title="Hiệu quả bài viết" icon="analytics" iconTone="info" iconBox="bg-info-soft">
                <View className="flex-row flex-wrap gap-1.5">
                  <MetricChip icon="eye-outline" label={`${article.viewCount.toLocaleString('vi-VN')} lượt xem`} />
                  <MetricChip icon="thumbs-up-outline" label={`${article.helpfulCount} hữu ích`} tone="success" />
                  <MetricChip
                    icon="thumbs-down-outline"
                    label={`${article.notHelpfulCount} chưa hữu ích`}
                    tone={article.notHelpfulCount ? 'danger' : 'neutral'}
                  />
                  {quality.votes > 0 && (
                    <MetricChip icon="pie-chart-outline" label={`${percent(quality.helpfulRate)} hữu ích`} tone="brand" />
                  )}
                </View>
                {quality.needsRewrite ? (
                  <NoticeCard
                    tone="danger"
                    icon="create"
                    title="Nên viết lại bài này"
                    message="Nhiều khách thấy chưa hữu ích. Gợi ý: trả lời thẳng ở câu đầu, chia thành các bước ngắn."
                  />
                ) : quality.level === 'unknown' ? (
                  <Text variant="micro" weight="regular" tone="muted">
                    Cần ít nhất 3 lượt đánh giá để kết luận bài có hữu ích không.
                  </Text>
                ) : null}
              </SectionCard>
            )}

            <SectionCard title="Hiển thị cho" icon="people" iconTone="violet" iconBox="bg-violet-soft">
              <SegmentedTabs
                items={(Object.keys(AUDIENCE_LABEL) as HelpAudience[]).map((k) => ({ key: k, label: AUDIENCE_LABEL[k] }))}
                value={draft.audience}
                onChange={(a) => {
                  setError(null);
                  setDraft((d) => ({ ...d, audience: a, categoryId: a === d.audience ? d.categoryId : null }));
                }}
              />
              <Text variant="caption" weight="medium" tone="secondary">
                Mục
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {categories.map((c) => (
                  <FilterChip key={c.id} label={c.name} selected={draft.categoryId === c.id} onPress={() => set('categoryId', c.id)} />
                ))}
                {!categories.length && (
                  <Text variant="caption" weight="regular" tone="muted">
                    Nhóm này chưa có mục nào.
                  </Text>
                )}
              </View>
            </SectionCard>

            <SectionCard title="Nội dung" icon="document-text" iconTone="brand">
              <Input
                label="Tiêu đề (câu hỏi của khách) *"
                placeholder="VD: Làm sao đổi số điện thoại?"
                value={draft.title}
                onChangeText={(t) => set('title', t)}
                maxLength={200}
              />
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text variant="caption" weight="medium" tone="secondary">
                    Câu trả lời *
                  </Text>
                  {!draft.body && (
                    <Pressable accessibilityRole="button" onPress={() => set('body', TEMPLATE)} hitSlop={8}>
                      <Text variant="caption" weight="bold" tone="brand">
                        Dùng mẫu
                      </Text>
                    </Pressable>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerClassName="gap-2">
                  {SNIPPETS.map((s) => (
                    <Pressable
                      key={s.label}
                      accessibilityRole="button"
                      accessibilityLabel={`Chèn ${s.label}`}
                      onPress={() => insert(s.text)}
                      className="h-8 flex-row items-center gap-1.5 rounded-full bg-brand-50 px-3 active:opacity-70"
                    >
                      <Icon name={s.icon} size="xs" tone="brand" />
                      <Text variant="caption" weight="semibold" tone="brand">
                        {s.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Input
                  multiline
                  placeholder={'Trả lời ngắn gọn ở câu đầu, sau đó là các bước.\nVD:\n1. Vào Tài khoản\n2. Chọn Sửa hồ sơ'}
                  value={draft.body}
                  onChangeText={(t) => set('body', t)}
                  onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                  scrollEnabled={false}
                />
                <Text variant="micro" weight="regular" tone="muted">
                  “## ” tiêu đề · “- ” gạch đầu dòng · “1. ” các bước · “**chữ**” in đậm · dòng trống để tách đoạn. {draft.body.trim().length} ký tự
                </Text>
              </View>
            </SectionCard>

            <SectionCard title="Tìm kiếm" icon="search" iconTone="accent" iconBox="bg-accent-50">
              <Text variant="micro" weight="regular" tone="muted">
                Từ khách hay gõ (kể cả không dấu, viết tắt). Trợ lý tự động cũng dùng từ khoá để tìm bài.
              </Text>
              <KeywordInput value={draft.keywords} onChange={(k) => set('keywords', k)} />
              <Divider />
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text variant="body" weight="semibold">
                    Hiện cho khách
                  </Text>
                  <Text variant="micro" weight="regular" tone="muted">
                    Tắt để lưu nháp hoặc ẩn tạm bài
                  </Text>
                </View>
                <Switch
                  value={draft.isActive}
                  onValueChange={(v) => set('isActive', v)}
                  trackColor={{ false: palette.line.DEFAULT, true: palette.success.DEFAULT }}
                  thumbColor={palette.surface}
                />
              </View>
            </SectionCard>
          </ScrollView>
        ) : (
          <Preview draft={draft} categoryName={category?.name} />
        )}

        <View className="gap-2 border-t border-line-subtle bg-surface px-4 pb-2 pt-3">
          {!!error && (
            <Text variant="caption" tone="danger" className="text-center">
              {error}
            </Text>
          )}
          <Button
            label={article ? 'Lưu thay đổi' : draft.isActive ? 'Đăng bài' : 'Lưu nháp (ẩn)'}
            leftIcon={article ? 'checkmark' : 'paper-plane'}
            size="lg"
            loading={save.isPending}
            disabled={!!article && !dirty}
            onPress={submit}
          />
        </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmDelete}
        title="Xoá bài viết?"
        message="Bài và số liệu 👍👎 sẽ bị xoá vĩnh viễn. Nếu chỉ muốn ẩn, hãy tắt “Hiện cho khách”."
        confirmLabel="Xoá"
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          article &&
          remove.mutate(article.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              toast('Đã xoá bài viết.', 'success');
              navigation.goBack();
            },
            onError: (err: any) => {
              setConfirmDelete(false);
              toast(err?.response?.data?.message || 'Không xoá được bài viết', 'error');
            },
          })
        }
      />
    </SafeAreaView>
  );
};

/** Xem trước giống màn khách đọc bài. */
const Preview: React.FC<{ draft: Draft; categoryName?: string }> = ({ draft, categoryName }) => (
  <ScrollView contentContainerClassName="gap-3 p-4 pb-8">
    {!draft.isActive && (
      <NoticeCard tone="warning" icon="eye-off" title="Bài đang ẩn" message="Khách sẽ chưa thấy bài này cho tới khi bật hiển thị." />
    )}
    <View className="gap-3 rounded-2xl bg-surface p-5 shadow-card">
      <View className="flex-row items-center gap-1.5 self-start rounded-full bg-brand-50 px-2.5 py-1">
        <Icon name="folder-open" size={12} tone="brand" />
        <Text variant="micro" weight="semibold" tone="brand">
          {categoryName ?? 'Chưa chọn mục'} · {AUDIENCE_LABEL[draft.audience]}
        </Text>
      </View>
      <Text variant="title" weight="bold">
        {draft.title.trim() || 'Tiêu đề bài viết'}
      </Text>
      <Divider />
      {draft.body.trim() ? (
        <ArticleBody body={draft.body} />
      ) : (
        <Text variant="body" tone="muted">
          Nội dung sẽ hiện ở đây.
        </Text>
      )}
    </View>
    <View className="items-center gap-2 rounded-2xl bg-surface p-4 shadow-card">
      <Text variant="body" weight="semibold">
        Bài viết có hữu ích với bạn không?
      </Text>
      <View className="flex-row gap-2 opacity-60">
        <MetricChip icon="thumbs-up-outline" label="Có" tone="success" />
        <MetricChip icon="thumbs-down-outline" label="Không" tone="danger" />
      </View>
    </View>
    {!!draft.keywords.length && (
      <Text variant="micro" weight="regular" tone="muted" className="text-center">
        Từ khoá: {draft.keywords.join(', ')}
      </Text>
    )}
  </ScrollView>
);
