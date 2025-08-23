# Requirements Document

## Introduction

This specification addresses the enhancement of the insights tab in the bittersweet mobile app to match the exact Figma design specifications. The current insights tab has basic analytics components but lacks the sophisticated data visualization, session history management, and user interface patterns shown in the Figma designs. This project will transform the insights tab to provide users with comprehensive focus session analytics, detailed session history, and intuitive data management capabilities that align perfectly with the design system.

## Requirements

### Requirement 1: Statistics Screen Implementation

**User Story:** As a user, I want to view comprehensive focus session statistics with visual charts and data insights, so that I can understand my productivity patterns and track my progress over time.

#### Acceptance Criteria

1. WHEN I navigate to the insights tab THEN I SHALL see a "Statistics" screen as the default view with dark mode styling (#1B1C30 background)
2. WHEN I view the statistics screen THEN I SHALL see a header with back arrow, "Statistics" title, and settings icon
3. WHEN I view the statistics screen THEN I SHALL see a "Focus sessions" chart section with a time period selector showing "This week"
4. WHEN I view the focus sessions chart THEN I SHALL see a line/area chart displaying daily focus time data with proper gradients and styling
5. WHEN I view the chart THEN I SHALL see horizontal grid lines for reference and day labels (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
6. WHEN I view the statistics screen THEN I SHALL see a "Today, 22 Nov" section with a "View all" link
7. WHEN I view today's sessions THEN I SHALL see a list of completed focus sessions with category icons, titles, durations, and time ranges
8. WHEN I view session items THEN I SHALL see proper category colors (green for education, blue for music, purple for work)
9. WHEN I tap "View all" THEN I SHALL navigate to the detailed history view

### Requirement 2: Session History List Implementation

**User Story:** As a user, I want to view a detailed chronological history of all my focus sessions, so that I can review my past activities and track my consistency over time.

#### Acceptance Criteria

1. WHEN I access the history view THEN I SHALL see a "History" screen with proper dark mode styling
2. WHEN I view the history screen THEN I SHALL see sessions grouped by date with section headers ("Today, 22 Nov", "Yesterday, 21 Nov")
3. WHEN I view session items THEN I SHALL see category icon with proper background color, session title, category name, duration, and time range
4. WHEN I view session items THEN I SHALL see consistent typography (Poppins SemiBold 16px for titles, Poppins Regular 14px for categories and times)
5. WHEN I view session items THEN I SHALL see proper spacing and border styling matching the design system
6. WHEN I view different session categories THEN I SHALL see appropriate icons and colors (education/green, music/blue, work/purple, meditation/yellow, code/red)

### Requirement 3: Swipe-to-Delete Functionality

**User Story:** As a user, I want to delete focus sessions from my history by swiping, so that I can manage my session data and remove incorrect or unwanted entries.

#### Acceptance Criteria

1. WHEN I swipe left on a session item THEN I SHALL see a red delete button appear on the right side
2. WHEN I see the delete button THEN I SHALL see a trash icon with proper styling and red background (#EF786C with 20% opacity)
3. WHEN I tap the delete button THEN I SHALL remove the session from the list with a smooth animation
4. WHEN I swipe right or tap elsewhere THEN I SHALL hide the delete button and return the item to normal state
5. WHEN I delete a session THEN I SHALL see the list update immediately without requiring a refresh

### Requirement 4: Data Visualization Chart Component

**User Story:** As a user, I want to see my focus session data presented in an intuitive chart format, so that I can quickly understand my productivity trends and patterns.

#### Acceptance Criteria

1. WHEN I view the focus sessions chart THEN I SHALL see a properly styled area chart with blue gradient fill (#6592E9)
2. WHEN I view the chart THEN I SHALL see horizontal grid lines with 50% opacity (#575757) for reference
3. WHEN I view the chart THEN I SHALL see smooth curves connecting data points representing daily focus time
4. WHEN I view the chart THEN I SHALL see day labels below the chart (Mon through Sun) with proper typography
5. WHEN I view the chart THEN I SHALL see a time period selector dropdown showing "This week" with proper border styling
6. WHEN I tap the time period selector THEN I SHALL be able to change between different time periods (daily, weekly, monthly)

### Requirement 5: Session Item Component Enhancement

**User Story:** As a user, I want session items to display comprehensive information in a visually appealing format, so that I can quickly identify and understand each focus session.

#### Acceptance Criteria

1. WHEN I view a session item THEN I SHALL see a rounded rectangle container with dark border (#575757)
2. WHEN I view a session item THEN I SHALL see a category icon with rounded background in the appropriate color
3. WHEN I view a session item THEN I SHALL see the session title in white text (Poppins SemiBold 16px)
4. WHEN I view a session item THEN I SHALL see the category name in grey text (#CACACA, Poppins Regular 14px)
5. WHEN I view a session item THEN I SHALL see the duration prominently displayed on the right (white text, Poppins SemiBold 16px)
6. WHEN I view a session item THEN I SHALL see the time range below the duration (grey text, Poppins Regular 14px)
7. WHEN I view session items THEN I SHALL see consistent 16px padding and proper spacing between elements

### Requirement 6: Navigation and Tab Integration

**User Story:** As a user, I want seamless navigation between statistics and history views, so that I can easily access different aspects of my focus session data.

#### Acceptance Criteria

1. WHEN I'm on the insights tab THEN I SHALL see the statistics view as the default screen
2. WHEN I tap "View all" on the statistics screen THEN I SHALL navigate to the history view with a smooth transition
3. WHEN I'm on the history view THEN I SHALL see a back arrow that returns me to the statistics view
4. WHEN I navigate between views THEN I SHALL maintain the dark theme and proper header styling
5. WHEN I'm on either view THEN I SHALL see the insights tab remain active in the bottom navigation

### Requirement 7: Data Management and State

**User Story:** As a user, I want my focus session data to be properly managed and persisted, so that my statistics and history remain accurate and up-to-date.

#### Acceptance Criteria

1. WHEN I view statistics THEN I SHALL see real-time data reflecting my actual focus sessions
2. WHEN I complete a focus session THEN I SHALL see it appear in both statistics and history views
3. WHEN I delete a session THEN I SHALL see the statistics update to reflect the change
4. WHEN I change time periods THEN I SHALL see the chart data update accordingly
5. WHEN I close and reopen the app THEN I SHALL see my session data persisted correctly

### Requirement 8: Performance and User Experience

**User Story:** As a user, I want the insights tab to be responsive and performant, so that I can quickly access my data without delays or lag.

#### Acceptance Criteria

1. WHEN I navigate to the insights tab THEN I SHALL see the content load within 500ms
2. WHEN I scroll through the history list THEN I SHALL see smooth scrolling performance
3. WHEN I interact with chart elements THEN I SHALL see immediate visual feedback
4. WHEN I swipe to delete THEN I SHALL see smooth animations without stuttering
5. WHEN I switch between time periods THEN I SHALL see chart updates with smooth transitions

### Requirement 9: Accessibility and Responsive Design

**User Story:** As a user with accessibility needs, I want the insights tab to be fully accessible and work properly on different screen sizes, so that I can use all features regardless of my abilities or device.

#### Acceptance Criteria

1. WHEN I use screen readers THEN I SHALL have proper accessibility labels for all interactive elements
2. WHEN I use the app THEN I SHALL see sufficient color contrast ratios for all text and UI elements
3. WHEN I tap elements THEN I SHALL have adequate touch target sizes (minimum 44px)
4. WHEN I use assistive technology THEN I SHALL have logical focus order and navigation
5. WHEN I use the app on different screen sizes THEN I SHALL see properly scaled and positioned elements

### Requirement 10: Error Handling and Edge Cases

**User Story:** As a user, I want the insights tab to handle edge cases gracefully, so that I have a reliable experience even when data is missing or errors occur.

#### Acceptance Criteria

1. WHEN I have no focus sessions THEN I SHALL see appropriate empty state messages
2. WHEN data fails to load THEN I SHALL see user-friendly error messages with retry options
3. WHEN I have only one session THEN I SHALL see the chart display appropriately
4. WHEN I delete the last session in a day THEN I SHALL see the date section removed properly
5. WHEN network connectivity is poor THEN I SHALL see loading states and graceful degradation