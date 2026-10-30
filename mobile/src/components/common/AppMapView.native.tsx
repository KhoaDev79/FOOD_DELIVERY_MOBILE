import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';

export interface MapMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  pinColor?: string;
  type?: 'restaurant' | 'delivery' | 'driver';
}

interface AppMapViewProps {
  initialRegion: Region;
  markers?: MapMarkerItem[];
  style?: ViewStyle;
}

export const AppMapView: React.FC<AppMapViewProps> = ({ initialRegion, markers = [], style }) => {
  const mapRef = useRef<MapView>(null);

  const region = useMemo(() => {
    if (markers.length >= 2) {
      let minLat = markers[0].latitude;
      let maxLat = markers[0].latitude;
      let minLng = markers[0].longitude;
      let maxLng = markers[0].longitude;

      for (const m of markers) {
        minLat = Math.min(minLat, m.latitude);
        maxLat = Math.max(maxLat, m.latitude);
        minLng = Math.min(minLng, m.longitude);
        maxLng = Math.max(maxLng, m.longitude);
      }

      const midLat = (minLat + maxLat) / 2;
      const midLng = (minLng + maxLng) / 2;
      const latDelta = Math.max((maxLat - minLat) * 1.8, 0.015);
      const lngDelta = Math.max((maxLng - minLng) * 1.8, 0.015);

      return {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      };
    }
    return initialRegion;
  }, [markers, initialRegion]);

  useEffect(() => {
    if (markers.length >= 2 && mapRef.current) {
      mapRef.current.fitToCoordinates(
        markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
        {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        },
      );
    }
  }, [markers]);

  return (
    <MapView ref={mapRef} style={[styles.map, style]} initialRegion={region}>
      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.latitude, longitude: m.longitude }}
          title={m.title}
          description={m.description}
        >
          {m.type === 'restaurant' ? (
            <View style={styles.customPin}>
              <View style={[styles.pinCircle, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="storefront" size={16} color="#FFFFFF" />
              </View>
              <View style={[styles.pinArrow, { borderTopColor: '#EF4444' }]} />
            </View>
          ) : m.type === 'delivery' ? (
            <View style={styles.customPin}>
              <View style={[styles.pinCircle, { backgroundColor: '#1EB9CE' }]}>
                <Ionicons name="home" size={16} color="#FFFFFF" />
              </View>
              <View style={[styles.pinArrow, { borderTopColor: '#1EB9CE' }]} />
            </View>
          ) : m.type === 'driver' ? (
            <View style={styles.customPin}>
              <View style={[styles.pinCircle, { backgroundColor: '#10B981' }]}>
                <Ionicons name="bicycle" size={16} color="#FFFFFF" />
              </View>
              <View style={[styles.pinArrow, { borderTopColor: '#10B981' }]} />
            </View>
          ) : (
            <View style={styles.customPin}>
              <View style={[styles.pinCircle, { backgroundColor: m.pinColor || '#1EB9CE' }]}>
                <Ionicons name="location" size={16} color="#FFFFFF" />
              </View>
              <View style={[styles.pinArrow, { borderTopColor: m.pinColor || '#1EB9CE' }]} />
            </View>
          )}
        </Marker>
      ))}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: { width: '100%', height: '100%' },
  customPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});
