import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';

export interface MapMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  pinColor?: string;
}

interface AppMapViewProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  markers?: MapMarkerItem[];
  style?: ViewStyle;
}

export const AppMapView: React.FC<AppMapViewProps> = ({ markers = [], style }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Ionicons name="map-outline" size={24} color={colors.primary} />
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
};

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

