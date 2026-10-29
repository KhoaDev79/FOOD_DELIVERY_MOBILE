import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverCall'>;

export const DriverCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const driverName = route.params?.driverName || 'Tài xế giao hàng';
  const driverPhone = route.params?.driverPhone || '0908 123 456';

  const [callSeconds, setCallSeconds] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Bộ đếm thời gian cuộc gọi chạy liên tục
  useEffect(() => {
    const timer = setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleEndCall = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Thông tin đầu trang */}
      <View style={styles.topInfo}>
        <Text style={styles.callerTitle}>{driverName}</Text>
        <Text style={styles.phoneSub}>{driverPhone}</Text>
        <Text style={styles.timerText}>{formatTimer(callSeconds)}</Text>
      </View>

      {/* Avatar tròn lớn ở giữa */}
      <View style={styles.centerSection}>
        <View style={styles.avatarRingOuter}>
          <View style={styles.avatarRingInner}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={80} color={colors.white} />
            </View>
          </View>
        </View>
      </View>

      {/* Cụm điều khiển phía dưới */}
      <View style={styles.bottomSection}>
        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={[styles.toolBtn, isSpeakerOn && styles.toolBtnActive]}
            onPress={() => setIsSpeakerOn(!isSpeakerOn)}
          >
            <Ionicons
              name={isSpeakerOn ? 'volume-high' : 'volume-medium-outline'}
              size={28}
              color={isSpeakerOn ? '#EE4D2D' : colors.text}
            />
            <Text style={[styles.toolLabel, isSpeakerOn && styles.toolLabelActive]}>Loa ngoài</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, isMuted && styles.toolBtnActive]}
            onPress={() => setIsMuted(!isMuted)}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic-outline'}
              size={28}
              color={isMuted ? '#EE4D2D' : colors.text}
            />
            <Text style={[styles.toolLabel, isMuted && styles.toolLabelActive]}>Tắt tiếng</Text>
          </TouchableOpacity>
        </View>

        {/* Nút cúp máy màu đỏ lớn */}
        <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall} activeOpacity={0.8}>
          <Ionicons name="call" size={34} color={colors.white} style={styles.hangupIcon} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  topInfo: {
    alignItems: 'center',
    marginTop: 20,
  },
  callerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  phoneSub: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EE4D2D',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingOuter: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingInner: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FFE2DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#EE4D2D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EE4D2D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomSection: {
    alignItems: 'center',
    gap: 36,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  toolBtnActive: {
    backgroundColor: '#FFF0ED',
    borderColor: '#EE4D2D',
  },
  toolLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  toolLabelActive: {
    color: '#EE4D2D',
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  hangupIcon: {
    transform: [{ rotate: '135deg' }],
  },
});

