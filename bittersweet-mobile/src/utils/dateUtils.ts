/**
 * Generate an array of dates for the current week (7 days starting from today)
 */
export const generateWeekDates = (startDate: Date = new Date()): Date[] => {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  
  // Start from today and generate next 7 days
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentDate);
    date.setDate(currentDate.getDate() + i);
    dates.push(date);
  }
  
  return dates;
};

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.toDateString() === date2.toDateString();
};

/**
 * Get the start of the day for a given date
 */
export const getStartOfDay = (date: Date): Date => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
};

/**
 * Get the end of the day for a given date
 */
export const getEndOfDay = (date: Date): Date => {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
};

/**
 * Format date for display
 */
export const formatDisplayDate = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  if (isSameDay(date, today)) {
    return 'Today';
  } else if (isSameDay(date, tomorrow)) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }
};