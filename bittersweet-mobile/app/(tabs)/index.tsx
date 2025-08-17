import { useState, useEffect } from 'react';
import { View, ScrollView, SafeAreaView } from 'react-native';
import { useFocusStore } from '../../src/store/slices/focusSlice';
import { CircularTimer } from '../../src/components/focus/CircularTimer';
import { TimerControls } from '../../src/components/focus/TimerControls';
import { SessionStatus } from '../../src/components/focus/SessionStatus';
import { TagSelector } from '../../src/components/focus/TagSelector';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';



export default function FocusScreen() {
  const {
    currentSession,
    isTimerRunning,
    remainingTime,
    defaultDuration,
    categories,
    tags,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    completeSession,
    updateRemainingTime,
  } = useFocusStore();

  const [selectedCategory, setSelectedCategory] = useState('Work');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTimerRunning && remainingTime > 0) {
      interval = setInterval(() => {
        updateRemainingTime(remainingTime - 1);
      }, 1000);
    } else if (remainingTime === 0 && currentSession) {
      // Session completed
      completeSession();
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTimerRunning, remainingTime, currentSession, updateRemainingTime, completeSession]);

  const handleStart = () => {
    startSession(defaultDuration, selectedCategory, selectedTags);
  };

  const handlePause = () => {
    pauseSession();
  };

  const handleResume = () => {
    resumeSession();
  };

  const handleStop = () => {
    stopSession();
  };

  const handleReset = () => {
    stopSession();
  };

  const handleTagSelect = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const tagData = tags.map(tag => ({
    id: tag,
    name: tag,
    color: '#6592E9',
  }));

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-dark-bg">
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-4 mb-6">
          <Typography variant="headline-24" color="primary" className="text-center">
            Focus Session
          </Typography>
          <Typography variant="body-14" color="secondary" className="text-center mt-2">
            Stay focused and earn seeds for your progress
          </Typography>
        </View>

        {/* Session Status */}
        {currentSession && (
          <SessionStatus
            currentSession={1}
            totalSessions={4}
            sessionType="focus"
            completedSessions={0}
          />
        )}

        {/* Timer */}
        <View className="items-center mb-8">
          <CircularTimer
            duration={currentSession?.targetDuration ? currentSession.targetDuration * 60 : defaultDuration * 60}
            remainingTime={remainingTime}
            size={250}
            strokeWidth={12}
            isRunning={isTimerRunning}
          />
        </View>

        {/* Category Selection */}
        {!currentSession && (
          <Card variant="default" padding="medium" className="mx-4 mb-4">
            <Typography variant="subtitle-16" color="primary" className="mb-3">
              Choose Category
            </Typography>
            <View className="flex-row flex-wrap">
              {categories.map((category) => (
                <View
                  key={category}
                  className={`
                    px-4 py-2 rounded-full mr-2 mb-2 border
                    ${selectedCategory === category 
                      ? 'bg-primary border-primary' 
                      : 'bg-transparent border-light-border dark:border-dark-border'
                    }
                  `}
                  onTouchEnd={() => setSelectedCategory(category)}
                >
                  <Typography 
                    variant="body-14" 
                    color={selectedCategory === category ? 'white' : 'primary'}
                  >
                    {category}
                  </Typography>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Tag Selection */}
        {!currentSession && (
          <View className="mb-6">
            <Typography variant="subtitle-16" color="primary" className="px-4 mb-3">
              Add Tags (Optional)
            </Typography>
            <TagSelector
              tags={tagData}
              selectedTags={selectedTags}
              onTagSelect={handleTagSelect}
              maxSelections={3}
            />
          </View>
        )}

        {/* Timer Controls */}
        <TimerControls
          isRunning={isTimerRunning}
          isPaused={currentSession?.isPaused || false}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onReset={handleReset}
        />

        {/* Session Info */}
        {currentSession && (
          <Card variant="default" padding="medium" className="mx-4 mt-6">
            <View className="items-center">
              <Typography variant="subtitle-14-semibold" color="primary" className="mb-2">
                Current Session
              </Typography>
              <Typography variant="body-12" color="secondary" className="mb-1">
                Category: {currentSession.category}
              </Typography>
              {currentSession.tags.length > 0 && (
                <Typography variant="body-12" color="secondary">
                  Tags: {currentSession.tags.join(', ')}
                </Typography>
              )}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}