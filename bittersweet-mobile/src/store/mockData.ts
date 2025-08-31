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
      { id: 'tag-1', name: 'Work', icon: '💼', userId: 'demo-user-123', usageCount: 5 },
      { id: 'tag-2', name: 'Study', icon: '📚', userId: 'demo-user-123', usageCount: 3 },
      { id: 'tag-3', name: 'Personal', icon: '🏠', userId: 'demo-user-123', usageCount: 2 },
      { id: 'tag-4', name: 'Exercise', icon: '💪', userId: 'demo-user-123', usageCount: 4 },
      { id: 'tag-5', name: 'Creative', icon: '🎨', userId: 'demo-user-123', usageCount: 1 },
    ],
    
    focusSessions: [
      {
        id: 'session-1',
        userId: 'demo-user-123',
        startTime: daysAgo(1),
        endTime: daysAgo(1),
        duration: 25,
        targetDuration: 25,
        tagIds: ['tag-1'],
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
        tagIds: ['tag-2'],
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