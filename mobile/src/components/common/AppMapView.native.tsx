import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import MapView, { EdgePadding, Marker, Polyline, Region } from 'react-native-maps';
import { Icon } from '../ui/Icon';

/** Một đường vẽ trên bản đồ (vd: quán → khách). */
export interface MapRoute {
  id: string;
  coordinates: { latitude: number; longitude: number }[];
  color: string;
  /** Màu viền ngoài, giúp đường nổi trên nền bản đồ (kiểu Google Maps). */
  outlineColor?: string;
  width?: number;
  /** Nét đứt: dùng cho đường ước tính (đoạn thẳng), không phải đường phố thật. */
  dashed?: boolean;
}

export interface AppMapViewHandle {
  /** Canh lại khung nhìn cho vừa mọi điểm và đường. */
  fitAll: () => void;
}

export interface MapMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  pinColor?: string;
  type?: 'restaurant' | 'delivery' | 'driver';
}

export interface AppMapViewProps {
  initialRegion: Region;
  markers?: MapMarkerItem[];
  routes?: MapRoute[];
  /**
   * always (mặc định): canh lại khung mỗi khi điểm thay đổi.
   * once: chỉ canh khi mở và khi đường đi vừa tải xong, để người dùng tự zoom/kéo mà không bị nhảy lại.
   */
  autoFit?: 'always' | 'once';
  edgePadding?: EdgePadding;
  style?: ViewStyle;
}

const DEFAULT_PADDING: EdgePadding = { top: 60, right: 60, bottom: 60, left: 60 };

export const AppMapView = forwardRef<AppMapViewHandle, AppMapViewProps>(function AppMapView(
  { initialRegion, markers = [], routes = [], autoFit = 'always', edgePadding = DEFAULT_PADDING, style },
  ref,
) {
  const mapRef = useRef<MapView>(null);
  const fittedMarkers = useRef(false);
  const fittedRoutes = useRef(false);

  const fitAll = useCallback(() => {
    const coords = [
      ...markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
      ...routes.flatMap((r) => r.coordinates),
    ];
    if (coords.length >= 2) {
      mapRef.current?.fitToCoordinates(coords, { edgePadding, animated: true });
    }
  }, [markers, routes, edgePadding]);

  useImperativeHandle(ref, () => ({ fitAll }), [fitAll]);

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
    if (markers.length < 2 || !mapRef.current) return;
    if (autoFit === 'always') {
      fitAll();
      return;
    }
    // once: canh khi có đủ điểm lần đầu, và một lần nữa khi đường đi vừa tải về
    const hasRoutes = routes.some((r) => r.coordinates.length >= 2);
    if (!fittedMarkers.current || (hasRoutes && !fittedRoutes.current)) {
      fittedMarkers.current = true;
      if (hasRoutes) fittedRoutes.current = true;
      fitAll();
    }
  }, [markers, routes, autoFit, fitAll]);

  return (
    <MapView ref={mapRef} style={[styles.map, style]} initialRegion={region}>
      {/* Đường đi vẽ dưới các ghim: viền đậm bên dưới, màu chính bên trên */}
      {routes.map((r) =>
        r.coordinates.length >= 2 ? (
          <React.Fragment key={r.id}>
            {!!r.outlineColor && !r.dashed && (
              <Polyline
                coordinates={r.coordinates}
                strokeColor={r.outlineColor}
                strokeWidth={(r.width ?? 5) + 3}
                lineCap="round"
                lineJoin="round"
                zIndex={1}
              />
            )}
            <Polyline
              coordinates={r.coordinates}
              strokeColor={r.color}
              strokeWidth={r.width ?? 5}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={r.dashed ? [12, 10] : undefined}
              zIndex={2}
            />
          </React.Fragment>
        ) : null,
      )}
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
                <Icon name="storefront" size={16} tone="inverse" />
              </View>
              <View style={[styles.pinArrow, { borderTopColor: '#EF4444' }]} />
            </View>
          ) : m.type === 'delivery' ? (
            <View style={styles.customPin}>
              <View style={[styles.pinCircle, { backgroundColor: '#1EB9CE' }]}>
                <Icon name="home" size={16} tone="inverse" />
              </View>
              <View style={[styles.pinArrow, { borderTopColor: '#1EB9CE' }]} />
            </View>
          ) : m.type === 'driver' ? (
            <View style={styles.customPin}>
              <View style={[styles.pinCircle, { backgroundColor: '#10B981' }]}>
                <Icon name="bicycle" size={16} tone="inverse" />
              </View>
              <View style={[styles.pinArrow, { borderTopColor: '#10B981' }]} />
            </View>
          ) : (
            <View style={styles.customPin}>
              <View style={[styles.pinCircle, { backgroundColor: m.pinColor || '#1EB9CE' }]}>
                <Icon name="location" size={16} tone="inverse" />
              </View>
              <View style={[styles.pinArrow, { borderTopColor: m.pinColor || '#1EB9CE' }]} />
            </View>
          )}
        </Marker>
      ))}
    </MapView>
  );
});

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
