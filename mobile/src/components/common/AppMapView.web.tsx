import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { Icon } from '../ui/Icon';

export interface MapMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  pinColor?: string;
  type?: 'restaurant' | 'delivery' | 'driver';
}

export interface MapRoute {
  id: string;
  coordinates: { latitude: number; longitude: number }[];
  color: string;
  outlineColor?: string;
  width?: number;
  dashed?: boolean;
}

export interface AppMapViewHandle {
  fitAll: () => void;
}

interface AppMapViewProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  markers?: MapMarkerItem[];
  /** Web chưa có bản đồ thật: các prop dưới đây được nhận cho khớp kiểu nhưng không dùng. */
  routes?: MapRoute[];
  autoFit?: 'always' | 'once';
  edgePadding?: { top: number; right: number; bottom: number; left: number };
  style?: ViewStyle;
}

export const AppMapView = forwardRef<AppMapViewHandle, AppMapViewProps>(function AppMapView(
  { markers = [], style },
  ref,
) {
  useImperativeHandle(ref, () => ({ fitAll: () => {} }), []);
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Icon name="map-outline" size={24} tone="brand" />
        <Text style={styles.title}>Bản đồ theo dõi (Giao diện Web)</Text>
      </View>
      <View style={styles.markersList}>
        {markers.map((m) => (
          <View key={m.id} style={styles.markerRow}>
            <View style={[styles.dot, { backgroundColor: m.pinColor || colors.primary }]} />
            <View style={styles.markerInfo}>
              <Text style={styles.markerTitle}>{m.title}</Text>
              <Text style={styles.markerCoords}>
                {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}
                {m.description ? ` • ${m.description}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 180,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  markersList: { gap: 8 },
  markerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  markerInfo: { flex: 1 },
  markerTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  markerCoords: { fontSize: 11, color: colors.textMuted },
});

