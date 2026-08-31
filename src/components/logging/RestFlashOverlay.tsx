import { CameraView } from 'expo-camera';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

interface RestFlashOverlayProps {
  flashing: boolean;
  cameraReady: boolean;
  torchOn: boolean;
}

// FR-4.3: rendered as a sibling of the session screen's ScrollView, not
// nested inside it, so the full-screen flash isn't clipped or dragged along
// by scrolling.
export function RestFlashOverlay({ flashing, cameraReady, torchOn }: RestFlashOverlayProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flashing ? <View style={[StyleSheet.absoluteFill, styles.flash]} /> : null}
      {cameraReady ? <CameraView style={styles.hiddenCamera} enableTorch={torchOn} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flash: {
    backgroundColor: theme.color.accentPrimary,
  },
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
