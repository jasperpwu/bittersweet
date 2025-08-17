# bittersweet App - Design Document & User Flow

## Overview
bittersweet is a React Native mobile application that provides a smarter, more human way to manage screen time, build focus habits, and track meaningful use of time — solo or with a squad. The app combines mindful productivity with positive reinforcement through a seed-based reward system.

## Design System Analysis

### Typography System (From Figma Variables)
- **Font Family**: Poppins (Regular, Medium, Semibold - weights 400, 500, 600)
- **Hierarchy**:
  - **Main 24px Semibold**: 24px/100%/Semibold (600) - Main page titles
  - **Main 20px Semibold**: 20px/100%/Semibold (600) - Section headers
  - **Main 18px Semibold**: 18px/100%/Semibold (600) - Card titles
  - **Subtitle 16px Semibold**: 16px/100%/Semibold (600) - Component headers
  - **Subtitle 14px Semibold**: 14px/100%/Semibold (600) - List items
  - **Subtitle 14px Medium**: 14px/100%/Medium (500) - Secondary headers
  - **Body 14px Regular**: 14px/100%/Regular (400) - Primary body text
  - **Body 12px Regular**: 12px/100%/Regular (400) - Secondary body text
  - **Paragraph 14px Regular**: 14px/24px/Regular (400) - Long form content
  - **Placeholder 12px Italic**: 12px/100%/Italic (400) - Form placeholders
  - **Tiny 10px Regular**: 10px/100%/Regular (400) - Captions and labels

### Color System (From Figma Variables)

#### General Colors
- **Primary Color**: #6592E9 - Main brand color for primary actions
- **Link Color**: #438EEC - Interactive elements and links
- **Main Disabled**: #6592E9 - Disabled state (same as primary but with opacity)
- **White**: #FFFFFF - Text on dark backgrounds
- **Text Grey**: #CACACA - Secondary text on dark backgrounds

#### Status Colors
- **Red**: #EF786C - Error states, focus sessions, warnings
- **Green**: #51BC6F - Success states, completed tasks, progress

#### Theme-Specific Colors

**White Mode (Light Theme)**:
- **Text Primary**: #4C4C4C - Primary text color
- **Text Grey**: #8A8A8A - Secondary text color
- **Border**: #E1E1E1 - Borders and dividers

**Dark Mode**:
- **Background**: #1B1C30 - Primary background color
- **Border**: #575757 - Borders and dividers

#### Gradients
- **Green Gradient**: Available but definition not specified in variables

### Visual Theme
- **UI Style**: Rounded corners, card-based layouts, subtle shadows
- **Design Language**: Modern, clean with strong typography hierarchy
- **Interaction**: Smooth animations with gradient accents

### Component Patterns
- Bottom tab navigation with 4-5 main sections
- Card-based content organization
- Circular progress indicators for timers
- Modal overlays for detailed interactions
- Consistent button styling with rounded corners

## Complete App Flow & Screen Analysis

### 1. Onboarding & Sign-up Process (4 screens)

#### Onboarding Screens
1. **Welcome Screen**: "Boost your productivity" 
   - Hero illustration with person at desk
   - Primary CTA button "Get Started"
   - Clean, motivational messaging

2. **Preference Selection**: "Choose your preferred method"
   - Multiple focus technique options (Pomodoro, Deep Work, etc.)
   - Icon-based selection interface
   - Customizable focus preferences

3. **Welcome Message**: Account setup introduction
   - Social login options (Apple, Google)
   - Email signup option
   - Terms and privacy links

4. **Account Creation**: "Create an account"
   - Email and password fields
   - Confirm password
   - Sign up button
   - "Already have account?" login link

### 2. Authentication & Recovery Flow (4 screens)

#### Password Recovery Process
1. **Forgot Password**: Email input screen
   - Email address field
   - "Send reset link" button
   - Back to login option

2. **Email Sent Confirmation**: 
   - Mail icon illustration
   - "Email has been sent" message
   - Resend option
   - Check spam folder reminder

3. **Verification Code**: 6-digit PIN entry
   - Number pad interface
   - Auto-focus input fields
   - Resend code option

4. **Create New Password**: Password reset
   - New password field
   - Confirm password field
   - Password strength indicator
   - Save button

### 3. Homepage & Task Management (3 screens)

#### Main Dashboard & Task Creation
1. **Homepage**: Main dashboard
   - Active session indicator
   - Quick start options
   - Recent activity summary
   - Navigation tabs at bottom

2. **Create New Task**: Task setup interface
   - Color-coded category selection (6 colors)
   - Task name input
   - Duration estimation
   - Priority settings

3. **Calendar View**: Date and time scheduling
   - Monthly calendar grid
   - Date selection
   - Time slot booking
   - Event indicators

### 4. Timer & Focus Sessions (4 screens)

#### Core Timer Functionality
1. **Active Timer**: Focus session in progress (9:58)
   - Large circular progress indicator
   - Red/orange gradient theme
   - Current task display
   - Pause/stop controls at bottom
   - Session type indicator

2. **Paused Timer**: Session paused (2:16)
   - Blue/green color scheme
   - Pause state clearly indicated
   - Resume and stop options
   - Time remaining display

3. **Session Complete**: Congratulations screen
   - Celebration illustration (person with arms raised)
   - "Congratulations" message
   - Session summary stats
   - Continue/new session options

4. **Statistics Overview**: Performance analytics
   - Line chart showing progress trends
   - Weekly/monthly view toggles
   - Performance metrics
   - Goal tracking

### 5. Schedule, Tasks & Session Management (4 screens)

#### Task Organization & Planning
1. **Task Categories**: Color-coded organization
   - 6 different category colors
   - Category icons and labels
   - Usage statistics per category
   - Add new category option

2. **Task List**: Daily task overview
   - "No task for today" empty state
   - Motivational illustration
   - Add task quick action
   - Task completion tracking

3. **Statistics Dashboard**: Detailed analytics
   - Multiple chart types (line, bar, pie)
   - Time distribution analysis
   - Productivity trends
   - Goal progress tracking

4. **Session History**: Historical data
   - List of completed sessions
   - Time tracking per session
   - Category breakdown
   - Performance insights

### 6. Settings & Profile Management (3 screens)

#### App Configuration
1. **Main Settings**: User profile and preferences
   - Profile picture and name
   - Account settings
   - App preferences
   - Notification settings

2. **Profile Settings**: Account management
   - Personal information
   - Password change
   - Privacy settings
   - Data management

3. **Reminder Settings**: Notification preferences
   - Push notification toggles
   - Reminder scheduling
   - Sound preferences
   - Do not disturb settings

## Feature Mapping to Figma Screens

### 🧠 Focus Session Tab
**Mapped Screens**: Timer screens (9:58 active, 2:16 paused, completion)
- **Implementation**: 
  - Circular progress timer with dynamic colors
  - Session state management (active/paused/complete)
  - Bottom controls for play/pause/stop
  - Tag selection integration
  - Manual logging capability

### ⏳ Reward System & App Blocking
**Mapped Screens**: Task categories, statistics dashboard
- **Implementation**:
  - Seed counter integration in timer screens
  - Category-based reward calculation
  - Progress tracking for unlock credits
  - Motivational quotes overlay (not directly shown but implied)

### 📊 Time Journal Tab
**Mapped Screens**: Calendar integration, statistics dashboard, task history
- **Implementation**:
  - Calendar view for daily/weekly tracking
  - Chart-based analytics
  - Time distribution visualization
  - Historical data presentation

### 📈 Insights Dashboard
**Mapped Screens**: Statistics overview, performance charts
- **Implementation**:
  - Weekly/monthly progress tracking
  - Trend analysis with line charts
  - Performance metrics display
  - AI-powered insights integration

### 👥 Social Features (Squads)
**Note**: Not explicitly shown in current Figma screens
- **Planned Implementation**:
  - Additional tab for social features
  - Friend/squad management
  - Challenge tracking
  - Progress sharing capabilities

## Technical Implementation Notes

### Navigation Structure (Based on Figma Screens)
```
TabNavigator (Bottom - 5 tabs visible in designs)
├── Home (Dashboard & Quick Actions)
├── Timer (Focus Sessions & Active Timer)
├── Tasks (Categories & Task Management)
├── Analytics (Statistics & Insights)
└── Settings (Profile & Preferences)

Modal Overlays:
├── Task Creation Modal
├── Calendar Selection Modal
├── Session Complete Modal
└── Category Selection Modal
```

### Bottom Tab Navigation Details
- **5 tab structure** visible in all main screens
- **Consistent positioning** across all flows
- **Icon-based navigation** with labels
- **Active state indicators** for current tab
- **Dark theme optimized** tab bar styling

### Key Components to Develop

#### Timer Components
- `CircularTimer`: Animated progress ring with time display
- `TimerControls`: Play/pause/stop button group
- `SessionStatus`: Current session information display

#### Analytics Components
- `ProgressChart`: Line/bar charts for time tracking
- `CategoryBreakdown`: Pie chart for time distribution
- `StatCard`: Individual metric display cards

#### Task Management
- `TaskCard`: Individual task display with time tracking
- `CategorySelector`: Color-coded category picker
- `CalendarView`: Monthly/weekly calendar integration

#### UI Components
- `CustomButton`: Consistent button styling across app
- `ModalOverlay`: Reusable modal container
- `ProgressIndicator`: Various progress display formats

## User Experience Flow

### Primary User Journey (Based on Screen Flow)
1. **Onboarding** → Welcome → Preferences → Account Creation
2. **Authentication** → Login/Signup → Email Verification → Password Setup
3. **Dashboard** → Homepage overview → Quick actions
4. **Task Setup** → Create task → Select category → Set duration
5. **Focus Session** → Start timer → Track progress → Session completion
6. **Analytics** → Review statistics → Track trends → Goal monitoring
7. **Settings** → Profile management → Preferences → Notifications

### Secondary Flows
- **Password Recovery** → Forgot password → Email verification → Reset
- **Calendar Integration** → Date selection → Time scheduling
- **Task Management** → Category organization → Task history
- **Session Management** → Pause/resume → Session history
- **Profile Customization** → Settings → Preferences → Account management

### Key User Interactions
- **Timer Controls**: Start, pause, resume, stop sessions
- **Task Creation**: Category selection, duration setting, naming
- **Calendar Navigation**: Date selection, scheduling, event viewing
- **Analytics Review**: Chart interaction, time period selection
- **Settings Management**: Profile updates, notification preferences

## Design System Implementation

### Colors (Exact Figma Variables)
```typescript
export const colors = {
  // General Colors
  primary: '#6592E9',
  linkColor: '#438EEC',
  mainDisabled: '#6592E9', // Use with opacity for disabled states
  white: '#FFFFFF',
  textGrey: '#CACACA',
  
  // Status Colors
  red: '#EF786C',
  green: '#51BC6F',
  
  // Theme-specific
  light: {
    background: '#FFFFFF',
    textPrimary: '#4C4C4C',
    textGrey: '#8A8A8A',
    border: '#E1E1E1'
  },
  
  dark: {
    background: '#1B1C30',
    textPrimary: '#FFFFFF',
    textGrey: '#CACACA',
    border: '#575757'
  }
}
```

### Typography System (Exact Figma Variables)
```typescript
export const typography = {
  // Headlines
  main24Semibold: {
    fontSize: 24,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    lineHeight: '100%'
  },
  main20Semibold: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    lineHeight: '100%'
  },
  main18Semibold: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    lineHeight: '100%'
  },
  subtitle16Semibold: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    lineHeight: '100%'
  },
  subtitle14Semibold: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    lineHeight: '100%'
  },
  subtitle14Medium: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
    lineHeight: '100%'
  },
  
  // Body Text
  body14Regular: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    lineHeight: '100%'
  },
  paragraph14Regular: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    lineHeight: 24
  },
  body12Regular: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    lineHeight: '100%'
  },
  placeholder12Italic: {
    fontSize: 12,
    fontFamily: 'Poppins-Italic',
    fontWeight: '400',
    lineHeight: '100%'
  },
  tiny10Regular: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    lineHeight: '100%'
  }
}
```

### Spacing System
- **Base unit**: 4px
- **Common spacing**: 8px, 12px, 16px, 20px, 24px, 32px

### Component Styling Guidelines

#### Buttons
- Use `primary` color (#6B8AFF) for main actions
- Apply gradient backgrounds for special states
- Typography: `headline4` or `headline5` for button text
- Border radius: 8px-12px for rounded corners

#### Cards
- Background: Theme-appropriate background colors
- Border: Use `border` colors from theme
- Typography: `headline3` for titles, `body1` for content
- Padding: 16px-20px internal spacing

#### Text Hierarchy
- Page titles: `headline1` (24px Bold)
- Section headers: `headline2` (20px Semibold)  
- Card titles: `headline3` (18px Semibold)
- Body content: `body1` (14px Regular)
- Secondary info: `body2` (12px Regular)
- Captions: `tiny` (10px Regular)