import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export function useLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refreshLocation = useCallback(async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCoords(null);
        setErrorMsg('Quyền truy cập vị trí bị từ chối');
        setIsLoading(false);
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const nextCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCoords(nextCoords);
      setErrorMsg(null);
      setIsLoading(false);
      return nextCoords;
    } catch {
      setCoords(null);
      setErrorMsg('Không thể lấy vị trí hiện tại');
      setIsLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setCoords(null);
            setErrorMsg('Quyền truy cập vị trí bị từ chối');
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
          setErrorMsg(null);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setCoords(null);
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

  return { coords, isLoading, errorMsg, refreshLocation };
}

