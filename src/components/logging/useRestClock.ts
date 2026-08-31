import { useAudioPlayer } from 'expo-audio';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';

import { countFlashCrossings, resolveTargetRestSeconds } from '@/domain/restClock';

const FLASH_DURATION_MS = 300;
const TICK_MS = 250;

const beepSource = require('../../../assets/sounds/rest-beep.wav');

export interface RestSettings {
  flashIntervalSeconds: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  cameraFlashEnabled: boolean;
}

// FR-4.1-4.3: drives the rest clock's tick loop and fires the flash / sound /
// vibration / camera-flash cues. Split from <RestClock> so the flash overlay
// and hidden camera can be rendered at the screen root instead of nested
// inside a ScrollView, where absolute positioning wouldn't cover the full
// screen reliably.
export function useRestClock(restStartedAt: number | null, targetRestSeconds: number | null, settings: RestSettings) {
  const [now, setNow] = useState(() => Date.now());
  const [flashing, setFlashing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const prevElapsedRef = useRef(0);
  const player = useAudioPlayer(beepSource);

  useEffect(() => {
    prevElapsedRef.current = 0;
  }, [restStartedAt]);

  useEffect(() => {
    if (restStartedAt == null) return;
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, [restStartedAt]);

  useEffect(() => {
    if (restStartedAt == null) return;
    const elapsedMs = now - restStartedAt;
    const crossings = countFlashCrossings(prevElapsedRef.current, elapsedMs, settings.flashIntervalSeconds * 1000);
    prevElapsedRef.current = elapsedMs;
    if (crossings <= 0) return;

    setFlashing(true);
    const flashTimeout = setTimeout(() => setFlashing(false), FLASH_DURATION_MS);

    if (settings.vibrationEnabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (settings.soundEnabled) {
      void player.seekTo(0).finally(() => player.play());
    }
    let torchTimeout: ReturnType<typeof setTimeout> | undefined;
    if (settings.cameraFlashEnabled && cameraPermission?.granted) {
      setTorchOn(true);
      torchTimeout = setTimeout(() => setTorchOn(false), FLASH_DURATION_MS);
    }

    return () => {
      clearTimeout(flashTimeout);
      if (torchTimeout) clearTimeout(torchTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, restStartedAt]);

  useEffect(() => {
    if (settings.cameraFlashEnabled && !cameraPermission?.granted) {
      void requestCameraPermission();
    }
  }, [settings.cameraFlashEnabled, cameraPermission?.granted, requestCameraPermission]);

  const elapsedMs = restStartedAt == null ? 0 : now - restStartedAt;
  const targetSeconds = resolveTargetRestSeconds(targetRestSeconds);

  return {
    elapsedMs,
    flashing,
    torchOn,
    cameraReady: settings.cameraFlashEnabled && !!cameraPermission?.granted,
    targetSeconds,
  };
}
