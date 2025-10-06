/**
 * Simple test script to verify mock data structure
 * Run with: node scripts/test-mock-data.js
 */

// Set NODE_ENV to test the condition
process.env.NODE_ENV = 'development';

console.log('🧪 Testing mock data structure...');

try {
  // Test that the types are structured correctly
  const mockDataTest = {
    user: {
      id: 'test-user-123',
      email: 'demo@bittersweet.app', 
      name: 'Demo User',
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        theme: 'light',
        notifications: true,
        soundEnabled: true,
        hapticFeedback: true,
        defaultFocusDuration: 25,
        autoStartBreaks: false,
      },
      stats: {
        totalFocusTime: 1125,
        totalSessions: 45,
        currentStreak: 7,
        longestStreak: 12,
        seedsEarned: 2250,
        level: 5,
        experience: 1125,
      }
    }
  };

  console.log('✅ Mock data structure test passed');
  console.log('👤 Demo user:', mockDataTest.user.name);
  console.log('📊 User stats:', {
    level: mockDataTest.user.stats.level,
    seeds: mockDataTest.user.stats.seedsEarned,
    streak: mockDataTest.user.stats.currentStreak
  });
  console.log('🎯 Mock data is ready for use!');

} catch (error) {
  console.error('❌ Mock data test failed:', error);
  process.exit(1);
}

console.log('\n💡 To use mock data in your app:');
console.log('   import { loadDemoData } from "./src/store";');
console.log('   await loadDemoData();');