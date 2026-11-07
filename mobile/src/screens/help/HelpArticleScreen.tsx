import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Divider,
  Icon,
  LoadingSpinner,
  Text,
  useToast,
} from '../../components/ui';
import { ArticleBody } from '../../components/modules/help/ArticleBody';
import { useHelpArticle, useSubmitArticleFeedback } from '../../services/useHelp';
import { useAuthStore } from '../../store/useAuthStore';
import { RootStackParamList } from '../../types/navigation';
import { formatDateTime } from '../../utils/format';

type HelpArticleRouteProp = RouteProp<RootStackParamList, 'HelpArticle'>;

export const HelpArticleScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<HelpArticleRouteProp>();
  const toast = useToast();

  const { articleId } = route.params;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: article, isLoading } = useHelpArticle(articleId);
  const feedbackMutation = useSubmitArticleFeedback();

  const [localFeedback, setLocalFeedback] = useState<boolean | null>(null);

  const currentFeedback = localFeedback !== null ? localFeedback : article?.userFeedback;

  const handleVote = (helpful: boolean) => {
    if (!isAuthenticated) {
      toast('Vui lòng đăng nhập để gửi phản hồi.');
      navigation.navigate('Login');
      return;
    }

    setLocalFeedback(helpful);
    feedbackMutation.mutate(
      { id: articleId, helpful },
      {
        onSuccess: (data) => {
          toast(data.message || 'Cảm ơn phản hồi của bạn!', 'success');
        },
        onError: () => {
          setLocalFeedback(null);
          toast('Không thể gửi phản hồi lúc này.', 'error');
        },
      },
    );
  };

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="dark" />

      {/* Header thanh lịch */}
      <View
        style={{ paddingTop: insets.top }}
        className="flex-row items-center justify-between border-b border-line bg-surface px-4 py-3 shadow-xs"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-canvas-subtle"
        >
          <Icon name="chevron-back" size="md" tone="default" />
        </Pressable>

        <Text variant="body" weight="semibold" numberOfLines={1} className="max-w-[70%]">
          {article?.category?.name || 'Trợ giúp'}
        </Text>

        <View className="w-10" />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner message="Đang tải bài viết..." />
        </View>
      ) : article ? (
        <ScrollView contentContainerClassName="p-4 pb-12 gap-5">
          {/* Tiêu đề & Danh mục */}
          <View className="gap-2">
            {article.category && (
              <View className="self-start rounded-full bg-brand-50 px-3 py-1">
                <Text variant="caption" weight="semibold" tone="brand">
                  {article.category.name}
                </Text>
              </View>
            )}

            <Text variant="headline" weight="bold" className="text-ink text-2xl">
              {article.title}
            </Text>

            <View className="flex-row items-center gap-3 mt-1">
              <Text variant="micro" tone="muted">
                Cập nhật: {formatDateTime(article.updatedAt)}
              </Text>
              <Text variant="micro" tone="muted">
                · {article.viewCount} lượt xem
              </Text>
            </View>
          </View>

          <Divider />

          {/* Nội dung bài viết */}
          <View className="rounded-2xl bg-surface border border-line p-4 shadow-card">
            <ArticleBody body={article.body} />
          </View>

          {/* Khu vực đánh giá độ hữu ích */}
          <View className="rounded-2xl bg-surface border border-line p-5 shadow-card items-center gap-3">
            <Text variant="body" weight="semibold" className="text-center">
              Bài viết này có giải đáp được thắc mắc của bạn không?
            </Text>

            <View className="flex-row items-center gap-4 mt-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hữu ích"
                onPress={() => handleVote(true)}
                className={`flex-row items-center gap-2 rounded-xl px-5 py-2.5 border active:opacity-80 ${
                  currentFeedback === true
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-line bg-canvas-subtle'
                }`}
              >
                <Icon
                  name={currentFeedback === true ? 'thumbs-up' : 'thumbs-up-outline'}
                  size="sm"
                  tone={currentFeedback === true ? 'brand' : 'default'}
                />
                <Text
                  variant="body"
                  weight={currentFeedback === true ? 'bold' : 'medium'}
                  tone={currentFeedback === true ? 'brand' : 'default'}
                >
                  Có hữu ích
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chưa hữu ích"
                onPress={() => handleVote(false)}
                className={`flex-row items-center gap-2 rounded-xl px-5 py-2.5 border active:opacity-80 ${
                  currentFeedback === false
                    ? 'border-danger bg-danger-soft'
                    : 'border-line bg-canvas-subtle'
                }`}
              >
                <Icon
                  name={currentFeedback === false ? 'thumbs-down' : 'thumbs-down-outline'}
                  size="sm"
                  tone={currentFeedback === false ? 'danger' : 'default'}
                />
                <Text
                  variant="body"
                  weight={currentFeedback === false ? 'bold' : 'medium'}
                  tone={currentFeedback === false ? 'danger' : 'default'}
                >
                  Chưa rõ
                </Text>
              </Pressable>
            </View>

            {/* Gợi ý hỗ trợ thêm nếu chưa rõ */}
            {currentFeedback === false && (
              <View className="mt-2 w-full rounded-xl bg-canvas-subtle p-3.5 border border-line gap-2.5 items-center">
                <Text variant="caption" tone="secondary" className="text-center">
                  Rất tiếc bài viết chưa giải quyết được vấn đề của bạn. Bạn có muốn trao đổi với trợ lý hoặc gửi phiếu hỗ trợ không?
                </Text>
                <View className="flex-row gap-2 w-full">
                  <Button
                    label="Chat với Trợ lý"
                    size="sm"
                    variant="outline"
                    leftIcon="sparkles"
                    className="flex-1"
                    onPress={() => navigation.navigate('SupportChat')}
                  />
                  <Button
                    label="Gửi yêu cầu hỗ trợ"
                    size="sm"
                    variant="primary"
                    leftIcon="mail-outline"
                    className="flex-1"
                    onPress={() => navigation.navigate('OrderIssue')}
                  />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center p-4">
          <Text variant="body" tone="muted">
            Không tìm thấy thông tin bài viết.
          </Text>
        </View>
      )}
    </View>
  );
};
