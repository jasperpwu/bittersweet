/**
 * Generate an array of dates for the current week
 */
export const generateWeekDates = (): Date[] => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const startOfWeek = new Date(today);
  
  // Adjust to start from Monday (1) instead of Sunday (0)
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  startOfWeek.setDate(today.getDate() - daysFromMonday);
  
  const weekDates: Date[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    weekDates.push(date);
  }
  
  return weekDates;
};

/**
 * Generate extended week dates (14 days) for better scrolling experience
 */
export const generateExtendedWeekDates = (startDate: Date = new Date()): Date[] => {
  const dates = [];
  const start = new Date(startDate);
  
  // Start from 3 days ago to show more context
  start.setDate(start.getDate() - 3);
  
  // Generate 14 days (2 weeks) for better scrolling
  for (let i = 0; i < 14; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  
  return dates;
};

/**
 * Generate an array of dates for a specific week starting from the given date
 */
export const generateWeekDatesFromStart = (weekStart: Date): Date[] => {
  // Validate input
  if (!weekStart || !(weekStart instanceof Date) || isNaN(weekStart.getTime())) {
    console.warn('Invalid weekStart provided to generateWeekDatesFromStart:', weekStart);
    // Fallback to current week
    const today = new Date();
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    const fallbackStart = new Date(today);
    fallbackStart.setDate(today.getDate() - daysFromMonday);
    fallbackStart.setHours(0, 0, 0, 0);
    weekStart = fallbackStart;
  }
  
  const weekDates: Date[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    weekDates.push(date);
  }
  
  return weekDates;
};

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.toDateString() === date2.toDateString();
};

/**
 * Check if a date is today
 */
export const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date());
};

/**
 * Format date for display
 */
export const formatDate = (date: Date, format: 'short' | 'long' = 'short'): string => {
  if (format === 'long') {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * Get the start and end of a day
 */
export const getDayBounds = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};