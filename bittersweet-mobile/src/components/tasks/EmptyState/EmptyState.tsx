import React, { FC } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Typography } from '../../ui/Typography/Typography';

interface EmptyStateProps {
  onAddTask?: () => void;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
    paddingVertical: 48,
  },
  illustration: {
    width: 300,
    height: 220,
    marginBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  backgroundCircle: {
    width: 207,
    height: 299,
    backgroundColor: '#2C2F48',
    borderRadius: 150,
    position: 'absolute',
    transform: [{ rotate: '270deg' }],
  },
  taskCard: {
    position: 'absolute',
    width: 153.913,
    height: 38.478,
    backgroundColor: '#FFFFFF',
    borderRadius: 7.696,
    shadowColor: 'rgba(101,88,114,0.1)',
    shadowOffset: { width: 0, height: 1.924 },
    shadowOpacity: 1,
    shadowRadius: 7.696,
    elevation: 3,
  },
  taskCard1: {
    left: 22.59,
    top: 25,
  },
  taskCard2: {
    left: 22.59,
    top: 71.17,
  },
  taskCard3: {
    left: 22.59,
    top: 117.35,
  },
  taskCard4: {
    left: 22.59,
    top: 163.52,
  },
  cardIcon: {
    position: 'absolute',
    left: 11.54,
    top: 9.62,
    width: 19.239,
    height: 19.239,
    backgroundColor: '#E1E1E1',
    borderRadius: 7.696,
  },
  cardTitle: {
    position: 'absolute',
    left: 36.55,
    top: 12.51,
    width: 38.478,
    height: 4.81,
    backgroundColor: '#E1E1E1',
    borderRadius: 7.696,
  },
  cardTime: {
    position: 'absolute',
    left: 130.83,
    top: 12.51,
    width: 11.543,
    height: 4.81,
    backgroundColor: '#E1E1E1',
    borderRadius: 7.696,
  },
  cardSubtitle: {
    position: 'absolute',
    left: 36.55,
    top: 21.16,
    width: 61.565,
    height: 4.81,
    backgroundColor: '#E1E1E1',
    borderRadius: 7.696,
    opacity: 0.5,
  },
  cardSubtitle2: {
    position: 'absolute',
    left: 123.13,
    top: 21.16,
    width: 19.239,
    height: 4.81,
    backgroundColor: '#E1E1E1',
    borderRadius: 7.696,
    opacity: 0.5,
  },
  characterOverlay: {
    position: 'absolute',
    left: 1,
    top: 7,
    width: 299,
    height: 207,
    backgroundColor: 'rgba(43, 47, 72, 0.8)',
    borderRadius: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterCircle: {
    width: 80,
    height: 80,
    backgroundColor: '#6592E9',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterInner: {
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  textContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  titleText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 24,
    textAlign: 'center',
  },
  descriptionText: {
    color: '#CACACA',
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
    width: 305,
  },
});

export const EmptyState: FC<EmptyStateProps> = ({ onAddTask }) => {
  return (
    <View style={styles.container}>
      {/* Illustration */}
      <View style={styles.illustration}>
        {/* Background circle */}
        <View style={styles.backgroundCircle} />
        
        {/* Task cards mockup */}
        <View style={[styles.taskCard, styles.taskCard1]}>
          <View style={styles.cardIcon} />
          <View style={styles.cardTitle} />
          <View style={styles.cardTime} />
          <View style={styles.cardSubtitle} />
          <View style={styles.cardSubtitle2} />
        </View>

        {/* Additional task cards */}
        <View style={[styles.taskCard, styles.taskCard2]}>
          <View style={styles.cardIcon} />
          <View style={styles.cardTitle} />
          <View style={styles.cardTime} />
          <View style={styles.cardSubtitle} />
          <View style={styles.cardSubtitle2} />
        </View>

        <View style={[styles.taskCard, styles.taskCard3]}>
          <View style={styles.cardIcon} />
          <View style={styles.cardTitle} />
          <View style={styles.cardTime} />
          <View style={styles.cardSubtitle} />
          <View style={styles.cardSubtitle2} />
        </View>

        <View style={[styles.taskCard, styles.taskCard4]}>
          <View style={styles.cardIcon} />
          <View style={styles.cardTitle} />
          <View style={styles.cardTime} />
          <View style={styles.cardSubtitle} />
          <View style={styles.cardSubtitle2} />
        </View>

        {/* Character illustration overlay */}
        <View style={styles.characterOverlay}>
          {/* Simplified character representation */}
          <View style={styles.characterCircle}>
            <View style={styles.characterInner} />
          </View>
        </View>
      </View>

      {/* Text content */}
      <View style={styles.textContent}>
        <Typography
          variant="headline-24"
          style={styles.titleText}
        >
          No task for today
        </Typography>
        <Typography
          variant="paragraph-14"
          style={styles.descriptionText}
        >
          You don't have any schedule for today.{'\n'}Tap the plus button to create a new task
        </Typography>
      </View>
    </View>
  );
};