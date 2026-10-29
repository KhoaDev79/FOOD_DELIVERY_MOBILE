import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AutocompleteItem, mapsApi } from '../../api/maps';
import { Button } from '../../components/common/Button';
import { colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../constants/config';
import { isCoordinateAddressString, useAddressDraftStore } from '../../store/useAddressDraftStore';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AddressPicker'>;

let NativeMapView: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  NativeMapView = require('react-native-maps').default;
}

export const AddressPickerScreen: React.FC<Props> = ({ navigation, route }) => {
  const mapRef = useRef<any>(null);
  const debounceTimerRef = useRef<any>(null);
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
  const reverseGeocode = async (lat: number, lng: number) => {
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
  };

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
  }, []);

  // Khi kéo bản đồ dừng lại -> Áp dụng Debounce 400ms
  const handleRegionChangeComplete = (region: any) => {
    setCurrentRegion(region);
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
        Alert.alert('Quyền vị trí', 'Vui lòng cấp quyền vị trí để tự động định vị.');
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
      Alert.alert('Lỗi định vị', 'Không thể lấy được vị trí GPS hiện tại.');
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
        Alert.alert(
          'Không tìm thấy',
          'Không tìm thấy địa điểm phù hợp. Bạn có thể chuyển sang tự gõ địa chỉ bên dưới.',
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Dịch vụ tìm kiếm',
        err.response?.data?.message || 'Không thể kết nối dịch vụ tìm kiếm địa chỉ. Bạn có thể tự gõ tên đường.',
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Chọn một kết quả từ danh sách tìm kiếm
  const handleSelectSearchResult = (item: AutocompleteItem) => {
    setSearchResults([]);
    setSearchQuery('');
    setSelectedAddress(item.mainText);
    setAddressDetails(item.description);
    setIsManualMode(false);

    useAddressDraftStore.getState().setSelectedAddress(
      item.description,
      {
        latitude: currentRegion.latitude,
        longitude: currentRegion.longitude,
      },
      false,
    );
  };

  // Xác nhận vị trí: Lưu vào Zustand store và quay lại màn hình trước
  const handleConfirm = () => {
    const finalAddress = addressDetails || selectedAddress;

    if (!finalAddress || isCoordinateAddressString(finalAddress)) {
      Alert.alert(
        'Địa chỉ chưa hợp lệ',
        'Vui lòng nhập hoặc chọn vị trí có số nhà / tên đường cụ thể trước khi lưu.',
      );
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

    // Hỗ trợ callback route params (nếu có để tương thích)
    if (route.params?.onSelectAddress) {
      try {
        route.params.onSelectAddress({
          addressLine: finalAddress,
          lat: currentRegion.latitude,
          lng: currentRegion.longitude,
        });
      } catch {
        // Safe ignore
      }
    }

    navigation.goBack();
  };

  const isAddressValid = Boolean(
    addressDetails && !isCoordinateAddressString(addressDetails) && !isGeocoding,
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header & Search Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Tìm tên đường, địa điểm..."
            value={searchQuery}
            onChangeText={(txt) => {
              setSearchQuery(txt);
              if (!txt.trim()) setSearchResults([]);
            }}
            onSubmitEditing={handleSearchAddress}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchActionBtn} onPress={handleSearchAddress}>
          {isSearching ? (
            <ActivityIndicator size="small" color="#EE4D2D" />
          ) : (
            <Text style={styles.searchActionText}>Tìm</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Thông báo lỗi khi dịch vụ bản đồ lỗi hoặc chưa có key */}
      {geocodingError && (
        <View style={styles.errorNoticeBar}>
          <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
          <Text style={styles.errorNoticeText} numberOfLines={2}>
            {geocodingError}
          </Text>
          <TouchableOpacity onPress={() => setIsManualMode(true)} style={styles.manualActionPill}>
            <Text style={styles.manualActionText}>Gõ tay</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dropdown danh sách gợi ý tìm kiếm */}
      {searchResults.length > 0 && (
        <View style={styles.searchResultsOverlay}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultItem}
                onPress={() => handleSelectSearchResult(item)}
              >
                <Ionicons name="location-outline" size={20} color="#EE4D2D" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.resultMainText} numberOfLines={1}>
                    {item.mainText}
                  </Text>
                  <Text style={styles.resultSubText} numberOfLines={2}>
                    {item.secondaryText || item.description}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Map View */}
      <View style={styles.mapContainer}>
        {Platform.OS !== 'web' && NativeMapView ? (
          <NativeMapView
            ref={mapRef}
            style={styles.fullMap}
            initialRegion={currentRegion}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton={false}
          />
        ) : (
          <View style={styles.webMapNoticeBox}>
            <Ionicons name="map-outline" size={44} color={colors.primary} />
            <Text style={styles.webMapNoticeTitle}>Chế độ xem bản đồ trên Web</Text>
            <Text style={styles.webMapNoticeSub}>
              Bản đồ kéo ghim tương tác tối ưu trên điện thoại di động (Expo Go trên iPhone / Android). Trên trình duyệt web, bạn có thể tìm kiếm địa điểm ở ô trên hoặc tự gõ địa chỉ bên dưới.
            </Text>
          </View>
        )}

        {/* Ghim trung tâm (chỉ trên thiết bị di động) */}
        {Platform.OS !== 'web' && (
          <View style={styles.centerMarkerWrapper} pointerEvents="none">
            <View style={styles.markerBubble}>
              <Text style={styles.markerBubbleText} numberOfLines={1}>
                {isGeocoding ? 'Đang định vị...' : 'Giao đến đây'}
              </Text>
            </View>
            <Ionicons name="location" size={44} color="#EE4D2D" style={styles.pinIcon} />
            <View style={styles.markerShadow} />
          </View>
        )}

        {/* Nút GPS định vị tôi */}
        <TouchableOpacity
          style={styles.gpsButton}
          onPress={handleGetCurrentLocation}
          activeOpacity={0.8}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color="#EE4D2D" />
          ) : (
            <Ionicons name="locate" size={24} color="#EE4D2D" />
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet hiển thị địa chỉ chi tiết & Tự gõ tay */}
      <View style={styles.bottomCard}>
        <View style={styles.addressInfoRow}>
          <View style={styles.pinCircle}>
            <Ionicons name="location-sharp" size={20} color="#EE4D2D" />
          </View>
          {isManualMode ? (
            <View style={styles.textContainer}>
              <Text style={styles.manualLabel}>Tự gõ địa chỉ chữ:</Text>
              <TextInput
                style={styles.manualInputBox}
                value={addressDetails}
                onChangeText={(txt) => {
                  setAddressDetails(txt);
                  setSelectedAddress(txt.split(',')[0] || 'Địa chỉ tự gõ');
                }}
                placeholder="Số nhà, tên đường, phường, quận..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <TouchableOpacity onPress={() => setIsManualMode(false)} style={{ marginTop: 4 }}>
                <Text style={styles.cancelManualText}>↩ Quay lại tự động định vị</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.textContainer}>
              <Text style={styles.addressTitle} numberOfLines={1}>
                {selectedAddress}
              </Text>
              <Text
                style={[
                  styles.addressSubtitle,
                  isCoordinateAddressString(addressDetails) && { color: '#DC2626' },
                ]}
                numberOfLines={2}
              >
                {addressDetails || 'Đang xác định tên đường...'}
              </Text>
              <TouchableOpacity onPress={() => setIsManualMode(true)} style={{ marginTop: 6 }}>
                <Text style={styles.manualLinkText}>✏️ Tự gõ tên đường nếu chưa đúng</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Button
          title={isAddressValid ? 'Xác nhận vị trí này' : 'Nhập hoặc chọn vị trí có tên đường'}
          onPress={handleConfirm}
          loading={isGeocoding}
          disabled={!isAddressValid}
          fullWidth
          style={[styles.confirmBtn, !isAddressValid && styles.confirmBtnDisabled]}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    zIndex: 10,
  },
  backBtn: {
    padding: 8,
    marginRight: 6,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  searchActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchActionText: {
    color: '#EE4D2D',
    fontWeight: '700',
    fontSize: 14,
  },
  errorNoticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    zIndex: 10,
  },
  errorNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
  },
  manualActionPill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  manualActionText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  searchResultsOverlay: {
    position: 'absolute',
    top: 60,
    left: 12,
    right: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
    maxHeight: 240,
    zIndex: 99,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchResultItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'flex-start',
  },
  resultMainText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  resultSubText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  fullMap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  webMapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centerMarkerWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -80,
    marginTop: -60,
    width: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerBubble: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: -4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  markerBubbleText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  pinIcon: {
    marginBottom: -10,
  },
  markerShadow: {
    width: 10,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 5,
    marginTop: 2,
  },
  gpsButton: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    backgroundColor: colors.white,
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  bottomCard: {
    backgroundColor: colors.white,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  addressInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF2EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  addressSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  manualLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EE4D2D',
    marginBottom: 4,
  },
  manualInputBox: {
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 8,
    minHeight: 48,
    backgroundColor: '#F8FAFC',
  },
  cancelManualText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  manualLinkText: {
    fontSize: 12,
    color: '#EE4D2D',
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#EE4D2D',
    borderRadius: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  webMapNoticeBox: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  webMapNoticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  webMapNoticeSub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 420,
  },
});
