# Requirements Document

## Introduction

This specification addresses the critical alignment between the current bittersweet mobile app implementation and the comprehensive Figma design system. The current app has a basic focus timer implementation, but it lacks the sophisticated UI/UX patterns, navigation structure, and feature completeness shown in the Figma designs. This project will transform the app to match the exact visual design, interaction patterns, and user flow defined in the Figma specifications.

## Requirements

### Requirement 1: Homepage Design Alignment

**User Story:** As a user, I want the homepage to match the Figma design exactly, so that I have a cohesive and polished experience with proper visual hierarchy and functionality.

#### Acceptance Criteria

1. WHEN I open the app THEN I SHALL see a dark mode interface with the exact color scheme (#1B1C30 background, #FFFFFF text, #6592E9 primary color)
2. WHEN I view the homepage THEN I SHALL see a user profile section with avatar, "Hello, [Name]!" greeting, and "Be productive today!" subtitle
3. WHEN I view the homepage THEN I SHALL see a notification icon in the top right corner
4. WHEN I view the homepage THEN I SHALL see a "Current task" section showing the active focus session with play/pause controls
5. WHEN I view the homepage THEN I SHALL see a "Daily goals" progress card with circular progress indicator showing completion percentage
6. WHEN I view the homepage THEN I SHALL see a "Today's tasks" section with a list of scheduled tasks, each showing category icon, title, duration, and play button
7. WHEN I view the homepage THEN I SHALL see the bottom tab navigation with proper icons and active state indicators

### Requirement 2: Task Creation Flow Implementation

**User Story:** As a user, I want to create new tasks through a comprehensive form interface, so that I can schedule and configure my focus sessions with all necessary parameters.

#### Acceptance Criteria

1. WHEN I tap the "+" button in the tab bar THEN I SHALL navigate to the "Create new task" screen
2. WHEN I'm on the task creation screen THEN I SHALL see a header with back arrow, "Create new task" title, and settings icon
3. WHEN I create a task THEN I SHALL be able to enter a task name in a text input field
4. WHEN I create a task THEN I SHALL be able to select a date using a calendar picker
5. WHEN I create a task THEN I SHALL be able to select a start time using a time picker
6. WHEN I create a task THEN I SHALL be able to choose from 6 category icons (Reading, Sport, Music, Meditation, Code, IT) with proper colors
7. WHEN I create a task THEN I SHALL be able to configure working sessions count using a slider (1-8 sessions)
8. WHEN I create a task THEN I SHALL be able to configure long break duration using a slider (10-30 minutes)
9. WHEN I create a task THEN I SHALL be able to configure short break duration using a slider (1-10 minutes)
10. WHEN I complete the form THEN I SHALL be able to tap "Create new project" button to save the task

### Requirement 3: Tasks Timeline View Implementation

**User Story:** As a user, I want to view my scheduled tasks in a timeline format, so that I can see my daily schedule and manage my time effectively.

#### Acceptance Criteria

1. WHEN I tap the tasks tab THEN I SHALL see a horizontal scrollable date picker showing the current week
2. WHEN I view the tasks screen THEN I SHALL see the selected date highlighted with the primary color (#6592E9)
3. WHEN I view the tasks screen THEN I SHALL see a timeline view with hourly time slots from 8:00 AM to 3:00 PM
4. WHEN I view the tasks screen THEN I SHALL see scheduled tasks displayed as colored blocks on the timeline
5. WHEN I view a task block THEN I SHALL see the task title, time range, and a circular status indicator
6. WHEN I view task blocks THEN I SHALL see different colors for different categories (orange for sport, blue for work, red for code, green for reading)
7. WHEN I view the current time THEN I SHALL see a blue timeline indicator showing the current moment

### Requirement 4: Settings Screen Implementation

**User Story:** As a user, I want to access comprehensive settings to customize my app experience, so that I can personalize the app according to my preferences.

#### Acceptance Criteria

1. WHEN I tap the settings tab THEN I SHALL see a settings screen with my profile information at the top
2. WHEN I view my profile THEN I SHALL see my avatar with a camera icon for photo changes, name, and email address
3. WHEN I view settings THEN I SHALL see a "General settings" section with toggle switches for Notifications, Night mode, Do not disturb, and Reminder
4. WHEN I view settings THEN I SHALL see menu items with right arrows for Reminder ringtone, Profile, Secure account, and Help center
5. WHEN I view the settings header THEN I SHALL see a "Log out" button in red color (#EF786C)
6. WHEN I toggle any setting THEN I SHALL see the toggle switch animate to the new state

### Requirement 5: Navigation and Tab Bar Implementation

**User Story:** As a user, I want consistent navigation throughout the app, so that I can easily move between different sections and understand my current location.

#### Acceptance Criteria

1. WHEN I use the app THEN I SHALL see a bottom tab bar with 5 tabs: Time (homepage), Tasks, Add new task (+), Statistics, and Settings
2. WHEN I'm on any tab THEN I SHALL see the active tab highlighted with the primary color and an indicator dot
3. WHEN I tap any tab THEN I SHALL navigate to the corresponding screen with smooth transitions
4. WHEN I'm on secondary screens THEN I SHALL see appropriate headers with back buttons and screen titles
5. WHEN I navigate THEN I SHALL maintain the dark theme consistency across all screens

### Requirement 6: Typography and Design System Implementation

**User Story:** As a user, I want the app to use consistent typography and visual elements, so that I have a professional and cohesive experience.

#### Acceptance Criteria

1. WHEN I view any text THEN I SHALL see Poppins font family used throughout the app
2. WHEN I view headings THEN I SHALL see proper font weights (SemiBold for titles, Medium for subtitles, Regular for body text)
3. WHEN I view text THEN I SHALL see proper font sizes (24px for main headlines, 18px for screen titles, 16px for subtitles, 14px for body text, 12px for small text, 10px for tiny text)
4. WHEN I view any UI element THEN I SHALL see consistent spacing using the 4px grid system
5. WHEN I view interactive elements THEN I SHALL see proper border radius (12px for buttons, 8px for cards, 16px for large cards)
6. WHEN I view colors THEN I SHALL see the exact color palette from Figma (#6592E9 primary, #1B1C30 dark background, #FFFFFF white, #CACACA text grey, #EF786C error/red)

### Requirement 7: Interactive Elements and Animations

**User Story:** As a user, I want smooth and responsive interactions, so that the app feels polished and engaging to use.

#### Acceptance Criteria

1. WHEN I tap any button THEN I SHALL see a subtle press animation (scale down to 95%)
2. WHEN I toggle switches THEN I SHALL see smooth sliding animations
3. WHEN I navigate between screens THEN I SHALL see appropriate transition animations
4. WHEN I interact with sliders THEN I SHALL see real-time value updates and smooth thumb movement
5. WHEN I select categories THEN I SHALL see immediate visual feedback with color changes
6. WHEN I scroll through lists THEN I SHALL see smooth scrolling with proper momentum

### Requirement 8: Status Bar and System Integration

**User Story:** As a user, I want the app to integrate properly with my device's system UI, so that it feels like a native application.

#### Acceptance Criteria

1. WHEN I use the app THEN I SHALL see a white status bar with proper battery, wifi, and cellular indicators
2. WHEN I'm on any screen THEN I SHALL see the status bar content properly positioned and styled
3. WHEN I reach the bottom of screens THEN I SHALL see the home indicator properly styled for the dark theme
4. WHEN I use the app THEN I SHALL see proper safe area handling for different device sizes

### Requirement 9: Data Structure and State Management

**User Story:** As a user, I want my tasks and settings to be properly managed and persisted, so that my data is reliable and consistent.

#### Acceptance Criteria

1. WHEN I create a task THEN I SHALL have it stored with all properties (name, date, time, category, session config)
2. WHEN I view my tasks THEN I SHALL see them properly organized by date and time
3. WHEN I change settings THEN I SHALL have them persisted across app sessions
4. WHEN I interact with tasks THEN I SHALL see real-time updates in the UI
5. WHEN I complete tasks THEN I SHALL see progress reflected in the daily goals section

### Requirement 10: Responsive Design and Accessibility

**User Story:** As a user with accessibility needs, I want the app to be usable and accessible, so that I can effectively use all features regardless of my abilities.

#### Acceptance Criteria

1. WHEN I use screen readers THEN I SHALL have proper accessibility labels for all interactive elements
2. WHEN I use the app THEN I SHALL see sufficient color contrast ratios for all text
3. WHEN I tap elements THEN I SHALL have adequate touch target sizes (minimum 44px)
4. WHEN I navigate with assistive technology THEN I SHALL have logical focus order and navigation
5. WHEN I use the app on different screen sizes THEN I SHALL see properly scaled and positioned elements