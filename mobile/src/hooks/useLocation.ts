import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { DEFAULT_COORDS } from '../constants/config';

export function useLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>(DEFAULT_COORDS);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setErrorMsg('Quyền truy cập vị trí bị từ chối, sử dụng vị trí mặc định');
            setIsLoading(false);
          }
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (isMounted) {
          setCoords({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg('Không thể lấy vị trí hiện tại');
          setIsLoading(false);
        }
      }
    }

    fetchLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  return { coords, isLoading, errorMsg };
}

