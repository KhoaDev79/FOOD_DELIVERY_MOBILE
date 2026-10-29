import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';

export interface MapMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  pinColor?: string;
}

interface AppMapViewProps {
  initialRegion: Region;
  markers?: MapMarkerItem[];
  style?: ViewStyle;
}

export const AppMapView: React.FC<AppMapViewProps> = ({ initialRegion, markers = [], style }) => {
  return (
    <MapView style={[styles.map, style]} initialRegion={initialRegion}>
      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.latitude, longitude: m.longitude }}
          title={m.title}
          description={m.description}
          pinColor={m.pinColor}
        />
      ))}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: { width: '100%', height: '100%' },
});

