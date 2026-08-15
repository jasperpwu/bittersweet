import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const CONFETTI_COLORS = [
  '#6592E9', // primary blue
  '#51BC6F', // success green
  '#EF786C', // error/coral
  '#F5A623', // warm orange
  '#BD7FE8', // purple
  '#FFD700', // gold
];

const PARTICLE_COUNT = 40;

interface Particle {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  rotation: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  shape: 'square' | 'rect' | 'circle';
}

// Takes the live viewport rather than reading it once at module load — a stale
// width/height (iPadOS resizes an iPhone app's window) spawns the burst outside
// the visible area.
function generateParticles(screenWidth: number, screenHeight: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const startX = screenWidth * 0.3 + Math.random() * screenWidth * 0.4;
    const startY = -20;
    const endX = startX + (Math.random() - 0.5) * screenWidth * 0.8;
    const endY = screenHeight + 50;
    const shapes: ('square' | 'rect' | 'circle')[] = ['square', 'rect', 'circle'];

    particles.push({
      id: i,
      startX,
      startY,
      endX,
      endY,
      rotation: Math.random() * 720 - 360,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 6,
      delay: Math.random() * 600,
      duration: 2000 + Math.random() * 1500,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    });
  }
  return particles;
}

interface ConfettiPieceProps {
  particle: Particle;
}

function ConfettiPiece({ particle }: ConfettiPieceProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      particle.delay,
      withTiming(1, {
        duration: particle.duration,
        easing: Easing.out(Easing.quad),
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // Horizontal: sine wave for flutter effect
    const x = particle.startX + (particle.endX - particle.startX) * p + Math.sin(p * 6) * 20;
    // Vertical: accelerating fall (gravity-like)
    const y = particle.startY + (particle.endY - particle.startY) * p * p;
    const rotate = particle.rotation * p;
    const opacity = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rotate}deg` },
      ],
      opacity,
    };
  });

  const shapeStyle = useMemo(() => {
    switch (particle.shape) {
      case 'rect':
        return { width: particle.size * 0.6, height: particle.size * 1.4, borderRadius: 1 };
      case 'circle':
        return { width: particle.size, height: particle.size, borderRadius: particle.size / 2 };
      default:
        return { width: particle.size, height: particle.size, borderRadius: 2 };
    }
  }, [particle]);

  return (
    <Animated.View
      style={[
        styles.piece,
        { backgroundColor: particle.color },
        shapeStyle,
        animatedStyle,
      ]}
    />
  );
}

interface ConfettiOverlayProps {
  /** Called when the animation finishes (all particles have fallen) */
  onComplete?: () => void;
}

export function ConfettiOverlay({ onComplete }: ConfettiOverlayProps) {
  const { width, height } = useWindowDimensions();
  const particles = useMemo(() => generateParticles(width, height), [width, height]);

  useEffect(() => {
    // Longest possible animation: max delay (600) + max duration (3500) = 4100ms
    const timeout = setTimeout(() => {
      onComplete?.();
    }, 4200);
    return () => clearTimeout(timeout);
  }, [onComplete]);

  return (
    <Animated.View style={styles.container} pointerEvents="none">
      {particles.map((particle) => (
        <ConfettiPiece key={particle.id} particle={particle} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
  },
  piece: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
