import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmptyState } from '../../components/common/EmptyState';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { RestaurantCard } from '../../components/modules/RestaurantCard';
import { colors } from '../../constants/colors';
import { useDebounce } from '../../hooks/useDebounce';
import { useLocation } from '../../hooks/useLocation';
import { useNearbyRestaurants } from '../../services/useRestaurants';
import { useFilterStore } from '../../store/useFilterStore';
import { RootStackParamList } from '../../types/navigation';

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { coords } = useLocation();

  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const openOnly = useFilterStore((s) => s.openOnly);
  const setOpenOnly = useFilterStore((s) => s.setOpenOnly);

  const debouncedQuery = useDebounce(searchQuery, 400);

  const { data, isLoading } = useNearbyRestaurants({
    lat: coords.latitude,
    lng: coords.longitude,
    q: debouncedQuery.trim() || undefined,
    openOnly,
    radiusKm: 20,
  });

  const restaurants = data?.items || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Input
          placeholder="Tìm quán ăn, món ăn (phở, bún, trà sữa...)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchBar}
          leftIcon={<Ionicons name="search" size={20} color={colors.textMuted} />}
          rightIcon={
            searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : undefined
          }
        />

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, openOnly && styles.filterChipActive]}
            onPress={() => setOpenOnly(!openOnly)}
          >
            <Ionicons
              name={openOnly ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={openOnly ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.filterChipText, openOnly && styles.filterChipTextActive]}>
              Đang mở cửa
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <LoadingSpinner message="Đang tìm kiếm..." />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RestaurantCard
              restaurant={item}
              onPress={() =>
                navigation.navigate('RestaurantDetail', { restaurantId: item.id })
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="search-outline" size={48} color={colors.textMuted} />}
              title="Không tìm thấy kết quả"
              description="Thử tìm kiếm với từ khóa khác hoặc tắt bộ lọc 'Đang mở cửa'."
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchBar: { marginBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: colors.white },
  list: { padding: 16 },
});

