import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Rating'>;

const FEEDBACK_TAGS = [
  'Giao nhanh như chớp',
  'Tài xế thân thiện',
  'Món ăn còn nóng hổi',
  'Đóng gói cẩn thận',
  'Giao không tiếp xúc',
  'Nhiệt tình, chu đáo',
];

export const RatingScreen: React.FC<Props> = ({ navigation, route }) => {
  const driverName = route.params?.driverName || 'Nguyễn Văn Tài (Tài xế)';
  const [stars, setStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Giao nhanh như chớp', 'Tài xế thân thiện']);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      setSelectedTags((prev) => [...prev, tag]);
    }
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert('Cảm ơn bạn!', 'Đánh giá của bạn đã được gửi thành công.', [
        {
          text: 'Về trang chủ',
          onPress: () => navigation.navigate('MainTabs', { screen: 'HomeTab' }),
        },
      ]);
    }, 600);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đánh giá dịch vụ</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Avatar & Title */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={50} color={colors.white} />
            </View>
            <Text style={styles.ratingTargetName}>Đánh giá cho {driverName}</Text>
            <Text style={styles.ratingSubtitle}>Trải nghiệm giao hàng của bạn thế nào?</Text>
          </View>

          {/* 5 Stars Rating Bar */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((index) => {
              const isFilled = index <= stars;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => setStars(index)}
                  activeOpacity={0.7}
                  style={styles.starBtn}
                >
                  <Ionicons
                    name={isFilled ? 'star' : 'star-outline'}
                    size={38}
                    color={isFilled ? '#F59E0B' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick Feedback Tags */}
          <Text style={styles.sectionTitle}>Chọn điểm bạn hài lòng:</Text>
          <View style={styles.tagsContainer}>
            {FEEDBACK_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                  onPress={() => toggleTag(tag)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                    size={16}
                    color={isSelected ? '#EE4D2D' : colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.tagChipText, isSelected && styles.tagChipTextSelected]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Comment Area */}
          <Text style={styles.sectionTitle}>Để lại lời nhắn (không bắt buộc):</Text>
          <TextInput
            placeholder="Chia sẻ thêm về tài xế hoặc góp ý dịch vụ..."
            placeholderTextColor={colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            style={styles.commentInput}
          />
        </ScrollView>

        {/* Nút gửi đánh giá */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Text style={styles.submitBtnText}>
              {isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scrollContent: { padding: 20, alignItems: 'center' },
  avatarSection: { alignItems: 'center', marginVertical: 16 },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EE4D2D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#EE4D2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  ratingTargetName: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  ratingSubtitle: { fontSize: 13, color: colors.textSecondary },
  starsRow: { flexDirection: 'row', gap: 10, marginVertical: 16 },
  starBtn: { padding: 4 },
  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 14,
    marginBottom: 10,
  },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: colors.white,
  },
  tagChipSelected: {
    borderColor: '#EE4D2D',
    backgroundColor: '#FFF0ED',
  },
  tagChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  tagChipTextSelected: { color: '#EE4D2D', fontWeight: '700' },
  commentInput: {
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  submitBtn: {
    backgroundColor: '#EE4D2D',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});

