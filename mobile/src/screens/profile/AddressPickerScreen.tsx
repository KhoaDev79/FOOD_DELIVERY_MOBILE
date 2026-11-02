import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AutocompleteItem, mapsApi } from '../../api/maps';
import { Button, Icon, Text, useToast } from '../../components/ui';
import { DEFAULT_COORDS } from '../../constants/config';
import { isCoordinateAddressString, useAddressDraftStore } from '../../store/useAddressDraftStore';
import { RootStackParamList } from '../../types/navigation';
import { palette } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddressPicker'>;

let NativeMapView: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  NativeMapView = require('react-native-maps').default;
}

export const AddressPickerScreen: React.FC<Props> = ({ navigation, route }) => {
  const mapRef = useRef<any>(null);
  const debounceTimerRef = useRef<any>(null);
  // Bỏ qua một lần tra ngược địa chỉ khi bản đồ tự di chuyển tới kết quả vừa chọn (giữ tên địa điểm đã chọn)
  const skipReverseRef = useRef(false);
  // Toast thay cho Alert.alert: Alert không hiện gì trên web.
  const toast = useToast();
  const initialCoords = route.params?.initialCoords || DEFAULT_COORDS;

  const [currentRegion, setCurrentRegion] = useState({
    latitude: initialCoords.latitude,
    longitude: initialCoords.longitude,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });

  const [selectedAddress, setSelectedAddress] = useState<string>('Đang định vị địa chỉ...');
  const [addressDetails, setAddressDetails] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AutocompleteItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);

  // Reverse Geocoding qua Backend Maps Adapter (Goong / Nominatim / Fallback)
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    // Nếu người dùng đang tự gõ tay, không tự ý ghi đè địa chỉ người dùng đã nhập
    if (isManualMode) return;

    try {
      setIsGeocoding(true);
      setGeocodingError(null);

      // Gọi proxy Backend trước (đã có rate limiter, cache và error message tiếng Việt)
      const data = await mapsApi.reverseGeocode(lat, lng);
      if (data && data.addressLine && !isCoordinateAddressString(data.addressLine)) {
        const parts = data.addressLine.split(',').map((p) => p.trim());
        const shortTitle = parts[0] || 'Vị trí đã ghim';
        setSelectedAddress(shortTitle);
        setAddressDetails(data.addressLine);
        return;
      }

      // Dự phòng cục bộ qua Expo Location nếu thiết bị có sẵn GPS native
      if (Platform.OS !== 'web') {
        const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (results && results.length > 0) {
          const item = results[0];
          const parts: string[] = [];
          if (item.streetNumber || item.name) parts.push(item.streetNumber || item.name || '');
          if (item.street) parts.push(item.street);
          if (item.subregion || item.district) parts.push(item.subregion || item.district || '');
          if (item.city || item.region) parts.push(item.city || item.region || '');

          const fullText = parts.filter(Boolean).join(', ');
          const shortTitle = item.street ? `${item.name ? item.name + ' ' : ''}${item.street}` : fullText;

          if (fullText && !isCoordinateAddressString(fullText)) {
            setSelectedAddress(shortTitle || 'Vị trí đã chọn');
            setAddressDetails(fullText);
            return;
          }
        }
      }

      setSelectedAddress('Vị trí đã ghim');
      setAddressDetails('Chưa xác định được tên đường tại toạ độ này. Bạn có thể tự gõ tên đường bên dưới.');
    } catch (err: any) {
      setSelectedAddress('Vị trí đã chọn');
      setAddressDetails('Không thể lấy tên đường tự động. Bạn hãy bấm "Tự gõ tên đường" bên dưới.');
      setGeocodingError(err.response?.data?.message || err.message || 'Dịch vụ bản đồ hiện không phản hồi.');
    } finally {
      setIsGeocoding(false);
    }
  }, [isManualMode]);

  // Khởi tạo lấy tên địa chỉ khi vừa mở màn hình
  useEffect(() => {
    let isMounted = true;
    const fetchInitial = async () => {
      if (isMounted) {
        await reverseGeocode(initialCoords.latitude, initialCoords.longitude);
      }
    };
    fetchInitial();
    return () => {
      isMounted = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [initialCoords.latitude, initialCoords.longitude, reverseGeocode]);

  // Khi kéo bản đồ dừng lại -> Áp dụng Debounce 400ms
  const handleRegionChangeComplete = (region: any) => {
    setCurrentRegion(region);
    if (skipReverseRef.current) {
      skipReverseRef.current = false;
      return;
    }
    if (isManualMode) return; // Nếu đang gõ tay, không gọi reverse geocode đè

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      reverseGeocode(region.latitude, region.longitude);
    }, 400);
  };

  // Bấm nút GPS định vị
  const handleGetCurrentLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast('Vui lòng cấp quyền vị trí để tự động định vị.', 'error');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };

      setCurrentRegion(newCoords);
      if (mapRef.current && mapRef.current.animateToRegion) {
        mapRef.current.animateToRegion(newCoords, 800);
      }
      setIsManualMode(false);
      reverseGeocode(newCoords.latitude, newCoords.longitude);
    } catch {
      toast('Không thể lấy được vị trí GPS hiện tại.', 'error');
    } finally {
      setIsLocating(false);
    }
  };

  // Tìm kiếm địa điểm: Chỉ thực hiện khi người dùng bấm nút Tìm (tuân thủ policy Nominatim)
  const handleSearchAddress = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearching(true);
      const list = await mapsApi.searchPlaces(
        searchQuery.trim(),
        currentRegion.latitude,
        currentRegion.longitude,
      );
      setSearchResults(list || []);
      if (!list || list.length === 0) {
        toast('Không tìm thấy địa điểm phù hợp. Bạn có thể chuyển sang tự gõ địa chỉ bên dưới.', 'error');
      }
    } catch (err: any) {
      toast(err.response?.data?.message || 'Không thể kết nối dịch vụ tìm kiếm địa chỉ. Bạn có thể tự gõ tên đường.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Chọn một kết quả từ danh sách tìm kiếm: lấy toạ độ thật của địa điểm rồi đưa bản đồ tới đó
  // (trước đây giữ toạ độ cũ của bản đồ nên địa chỉ và vị trí ghim không khớp nhau).
  const handleSelectSearchResult = async (item: AutocompleteItem) => {
    setSearchResults([]);
    setSearchQuery('');
    setSelectedAddress(item.mainText);
    setAddressDetails(item.description);
    setIsManualMode(false);

    let coords = { latitude: currentRegion.latitude, longitude: currentRegion.longitude };
    try {
      const place = await mapsApi.getPlaceDetail(item.placeId);
      if (place) coords = { latitude: place.latitude, longitude: place.longitude };
    } catch {
      toast('Không lấy được vị trí chính xác của địa điểm. Hãy kéo bản đồ để ghim lại.', 'error');
    }

    const region = { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 };
    skipReverseRef.current = Platform.OS !== 'web' && Boolean(mapRef.current?.animateToRegion);
    setCurrentRegion(region);
    mapRef.current?.animateToRegion?.(region, 800);

    useAddressDraftStore.getState().setSelectedAddress(item.description, coords, false);
  };

  // Xác nhận vị trí: Lưu vào Zustand store và quay lại màn hình trước
  const handleConfirm = () => {
    const finalAddress = addressDetails || selectedAddress;

    if (!finalAddress || isCoordinateAddressString(finalAddress)) {
      toast('Vui lòng nhập hoặc chọn vị trí có số nhà / tên đường cụ thể trước khi lưu.', 'error');
      return;
    }

    // Cập nhật Zustand Draft Store (Lưu cờ isManual nếu khách tự gõ tay)
    useAddressDraftStore.getState().setSelectedAddress(
      finalAddress,
      {
        latitude: currentRegion.latitude,
        longitude: currentRegion.longitude,
      },
      isManualMode,
    );

    // Màn gọi đọc kết quả từ useAddressDraftStore (không truyền hàm qua tham số điều hướng)
    navigation.goBack();
  };

  const isAddressValid = Boolean(
    addressDetails && !isCoordinateAddressString(addressDetails) && !isGeocoding,
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-surface">
      {/* Top Header & Search Bar */}
      <View className="z-10 flex-row items-center border-b border-line bg-surface px-3 py-2.5 gap-2">
        <Pressable onPress={() => navigation.goBack()} className="p-2 active:opacity-70">
          <Icon name="arrow-back" size={24} tone="default" />
        </Pressable>

        <View className="h-10 flex-1 flex-row items-center gap-2 rounded-lg bg-canvas-subtle px-3">
          <Icon name="search" size={18} tone="muted" />
          <TextInput
            placeholder="Tìm tên đường, địa điểm..."
            placeholderTextColor={palette.ink.muted}
            value={searchQuery}
            onChangeText={(txt) => {
              setSearchQuery(txt);
              if (!txt.trim()) setSearchResults([]);
            }}
            onSubmitEditing={handleSearchAddress}
            returnKeyType="search"
            className="h-full flex-1 font-body text-body text-ink"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="p-1 active:opacity-70"
            >
              <Icon name="close-circle" size={16} tone="muted" />
            </Pressable>
          )}
        </View>

        <Pressable
          className="rounded-lg bg-brand-500 px-3.5 py-2 active:opacity-80"
          onPress={handleSearchAddress}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color={palette.surface} />
          ) : (
            <Text variant="caption" weight="bold" tone="inverse">
              Tìm
            </Text>
          )}
        </Pressable>
      </View>

      {/* Thông báo lỗi khi dịch vụ bản đồ lỗi hoặc chưa có key */}
      {geocodingError && (
        <View className="z-10 flex-row items-center gap-2 bg-danger-soft px-3.5 py-2">
          <Icon name="alert-circle-outline" size={18} tone="danger" />
          <Text variant="caption" tone="danger" numberOfLines={2} className="flex-1">
            {geocodingError}
          </Text>
          <Pressable
            onPress={() => setIsManualMode(true)}
            className="rounded bg-surface px-2.5 py-1 shadow-card active:opacity-75"
          >
            <Text variant="micro" weight="bold" tone="brand">
              Gõ tay
            </Text>
          </Pressable>
        </View>
      )}

      {/* Dropdown danh sách gợi ý tìm kiếm */}
      {searchResults.length > 0 && (
        <View className="absolute left-3 right-3 top-16 z-20 max-h-72 rounded-xl border border-line bg-surface shadow-raised">
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                className="flex-row items-start border-b border-line p-3 active:bg-canvas-subtle"
                onPress={() => handleSelectSearchResult(item)}
              >
                <Icon name="location-outline" size={20} tone="brand" style={{ marginTop: 2 }} />
                <View className="ml-2.5 flex-1">
                  <Text variant="body" weight="semibold" numberOfLines={1}>
                    {item.mainText}
                  </Text>
                  <Text variant="caption" tone="secondary" numberOfLines={2} className="mt-0.5">
                    {item.secondaryText || item.description}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* Map View */}
      <View style={{ flex: 1 }} className="relative flex-1">
        {Platform.OS !== 'web' && NativeMapView ? (
          <NativeMapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={currentRegion}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-canvas-subtle p-6">
            <Icon name="map-outline" size={48} tone="brand" />
            <Text variant="headline" weight="bold" className="mt-3 text-center">
              Chế độ xem bản đồ trên Web
            </Text>
            <Text variant="body" tone="secondary" className="mt-2 text-center">
              Bản đồ kéo ghim tương tác tối ưu trên điện thoại di động (Expo Go trên iPhone / Android). Trên trình duyệt web, bạn có thể tìm kiếm địa điểm ở ô trên hoặc tự gõ địa chỉ bên dưới.
            </Text>
          </View>
        )}

        {/* Ghim trung tâm (chỉ trên thiết bị di động) */}
        {Platform.OS !== 'web' && (
          <View className="pointer-events-none absolute inset-0 items-center justify-center" pointerEvents="none">
            <View className="mb-1 rounded-full border border-line bg-surface px-3 py-1 shadow-card">
              <Text variant="micro" weight="bold" tone="brand" numberOfLines={1}>
                {isGeocoding ? 'Đang định vị...' : 'Giao đến đây'}
              </Text>
            </View>
            <Icon name="location" size={44} tone="brand" />
            <View className="h-1.5 w-3.5 rounded-full bg-black/20" />
          </View>
        )}

        {/* Nút GPS định vị tôi */}
        <Pressable
          className="absolute bottom-5 right-4 h-12 w-12 items-center justify-center rounded-full border border-line bg-surface shadow-raised active:opacity-80"
          onPress={handleGetCurrentLocation}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={palette.brand['500']} />
          ) : (
            <Icon name="locate" size={24} tone="brand" />
          )}
        </Pressable>
      </View>

      {/* Bottom Sheet hiển thị địa chỉ chi tiết & Tự gõ tay */}
      <View className="border-t border-line bg-surface p-4 shadow-raised gap-3.5">
        <View className="flex-row items-start gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
            <Icon name="location-sharp" size={20} tone="brand" />
          </View>

          {isManualMode ? (
            <View className="flex-1 gap-1.5">
              <Text variant="caption" weight="bold" tone="secondary">
                Tự gõ địa chỉ chữ:
              </Text>
              <TextInput
                className="min-h-[70px] rounded-lg border border-line bg-canvas-subtle p-2.5 font-body text-body text-ink"
                value={addressDetails}
                onChangeText={(txt) => {
                  setAddressDetails(txt);
                  setSelectedAddress(txt.split(',')[0] || 'Địa chỉ tự gõ');
                }}
                placeholder="Số nhà, tên đường, phường, quận..."
                placeholderTextColor={palette.ink.muted}
                multiline
                textAlignVertical="top"
              />
              <Pressable onPress={() => setIsManualMode(false)} className="mt-1 self-start">
                <Text variant="caption" weight="semibold" tone="brand">
                  ↩ Quay lại tự động định vị
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="flex-1">
              <Text variant="body" weight="bold" numberOfLines={1}>
                {selectedAddress}
              </Text>
              <Text
                variant="caption"
                tone={isCoordinateAddressString(addressDetails) ? 'danger' : 'secondary'}
                numberOfLines={2}
                className="mt-0.5"
              >
                {addressDetails || 'Đang xác định tên đường...'}
              </Text>
              <Pressable onPress={() => setIsManualMode(true)} className="mt-1.5 self-start">
                <Text variant="caption" weight="semibold" tone="brand">
                  ✏️ Tự gõ tên đường nếu chưa đúng
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <Button
          label={isAddressValid ? 'Xác nhận vị trí này' : 'Nhập hoặc chọn vị trí có tên đường'}
          onPress={handleConfirm}
          loading={isGeocoding}
          disabled={!isAddressValid}
          variant="primary"
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
};
