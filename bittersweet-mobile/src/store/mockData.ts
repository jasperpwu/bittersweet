/**
 * Mock data for development and testing
 */

// Helper functions to generate dates
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

export function getMockData() {
  return {
    user: {
      id: 'demo-user-123',
      name: 'Demo User',
      email: 'demo@bittersweet.app',
      stats: {
        seedsEarned: 250,
        totalSessions: 15,
        focusTime: 1200, // minutes
      },
    },
    
    focusTags: [
      { id: 'work', name: 'Work', icon: '💼', isDefault: true, usageCount: 0 },
      { id: 'study', name: 'Study', icon: '📚', isDefault: true, usageCount: 0 },
      { id: 'personal', name: 'Personal', icon: '🏠', isDefault: true, usageCount: 0 },
      { id: 'exercise', name: 'Exercise', icon: '💪', isDefault: true, usageCount: 0 },
      { id: 'creative', name: 'Creative', icon: '🎨', isDefault: true, usageCount: 0 },
    ],
    
    focusSessions: [
      {
        id: 'session-1',
        userId: 'demo-user-123',
        startTime: daysAgo(1),
        endTime: daysAgo(1),
        duration: 25,
        targetDuration: 25,
        tagId: 'work',
        notes: 'Morning focus session',
        status: 'completed',
        seedsEarned: 25,
        pauseHistory: [],
      },
      {
        id: 'session-2',
        userId: 'demo-user-123',
        startTime: daysAgo(0),
        endTime: daysAgo(0),
        duration: 50,
        targetDuration: 50,
        tagId: 'study',
        notes: 'Study session',
        status: 'completed',
        seedsEarned: 50,
        pauseHistory: [],
      },
    ],
    
    tasks: [],
    
    rewardTransactions: [
      {
        id: 'reward-1',
        userId: 'demo-user-123',
        amount: 25,
        type: 'earn',
        description: 'Completed focus session',
        createdAt: daysAgo(1),
      },
      {
        id: 'reward-2',
        userId: 'demo-user-123',
        amount: 50,
        type: 'earn',
        description: 'Completed study session',
        createdAt: daysAgo(0),
      },
    ],
  };
}