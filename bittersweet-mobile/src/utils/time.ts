/**
 * Formats a duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @param format - Format type: 'short' (25m), 'long' (25 minutes), 'clock' (25:00)
 */
export const formatDuration = (
  seconds: number, 
  format: 'short' | 'long' | 'clock' = 'short'
): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  switch (format) {
    case 'short':
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    
    case 'long':
      if (hours > 0) {
        const hourText = hours === 1 ? 'hour' : 'hours';
        const minuteText = minutes === 1 ? 'minute' : 'minutes';
        return `${hours} ${hourText} ${minutes} ${minuteText}`;
      }
      const minuteText = minutes === 1 ? 'minute' : 'minutes';
      return `${minutes} ${minuteText}`;
    
    case 'clock':
      if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    default:
      return `${minutes}m`;
  }
};

/**
 * Formats minutes to a human-readable string
 */
export const formatMinutes = (minutes: number, format: 'short' | 'long' = 'short'): string => {
  return formatDuration(minutes * 60, format);
};

/**
 * Converts minutes to seconds
 */
export const minutesToSeconds = (minutes: number): number => {
  return minutes * 60;
};

/**
 * Converts seconds to minutes
 */
export const secondsToMinutes = (seconds: number): number => {
  return Math.floor(seconds / 60);
};

/**
 * Gets the current time in a readable format
 */
export const getCurrentTime = (format: '12h' | '24h' = '24h'): string => {
  const now = new Date();
  
  if (format === '12h') {
    return now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

/**
 * Formats a date to a readable string
 */
export const formatDate = (
  date: Date, 
  format: 'short' | 'long' | 'relative' = 'short'
): string => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  switch (format) {
    case 'short':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    
    case 'long':
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    
    case 'relative':
      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 7) return `${diffInDays} days ago`;
      if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    default:
      return date.toLocaleDateString();
  }
};

/**
 * Formats time remaining in a countdown format
 */
export const formatCountdown = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const timeUtils = {
  formatDuration,
  formatMinutes,
  minutesToSeconds,
  secondsToMinutes,
  getCurrentTime,
  formatDate,
  formatCountdown,
};