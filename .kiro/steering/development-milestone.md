---
inclusion: manual
---

# Development Milestones - bittersweet

## ✅ Milestone 1: Core Experience (Week 1)
**Status**: Foundation
**Priority**: High

### Features
- **User Authentication**
  - Apple OAuth integration
  - Google OAuth integration
  - JWT token management
  - User profile creation

- **Focus Sessions**
  - Timer-based focus sessions (Pomodoro, custom durations)
  - Essential app whitelist configuration
  - Basic app blocking functionality
  - End-of-session reflection: "What did you do?" with completion status

- **Manual Time Logging**
  - Add time entries with duration or time range
  - Task category selection
  - Optional task naming
  - Completion status marking

- **Time Journal Foundation**
  - Automatic logging of focus sessions
  - Manual entry storage
  - Basic timeline view

### Technical Requirements
- React Native app setup with navigation
- Go backend with PostgreSQL database
- Basic API endpoints for auth, focus sessions, journal entries
- iOS app blocking integration (Screen Time API research)

### Definition of Done
- Users can sign up/login with Apple or Google
- Users can start and complete focus sessions
- Users can manually log time spent on activities
- All activities are saved to a basic journal timeline

---

## 🚀 Milestone 2: Rule System & App Locking (Week 2)
**Status**: Planned
**Priority**: High

### Features
- **Point System**
  - Earn points for productive time (focus sessions, manual logs)
  - Point calculation based on duration and completion
  - Point balance tracking

- **App Rules Engine**
  - Create earning rules: "Study 30 min → Earn 30 points"
  - Create unlock rules: "Spend 10 points → Unlock TikTok for 10 min"
  - Rule management interface

- **iOS Screen Time Integration**
  - App blocking/unblocking via Screen Time API
  - Real-time app usage monitoring
  - Visual countdown for unlocked entertainment apps (Dynamic Island integration)

- **Enhanced Focus Sessions**
  - Custom app whitelists per session
  - Automatic point earning upon completion

### Technical Requirements
- iOS Screen Time API implementation
- Rule engine backend logic
- Point calculation and storage system
- Enhanced mobile UI for rule creation

### Definition of Done
- Users can create and manage earning/unlock rules
- Focus sessions and manual logs award points
- Users can spend points to unlock entertainment apps
- Screen Time API successfully blocks/unblocks apps
- Visual countdown shows remaining unlock time

---

## 📊 Milestone 3: Dashboard & Insights (Week 3)
**Status**: Planned
**Priority**: High

### Features
- **Goal Setting System**
  - Weekly/monthly/yearly time goals by category
  - Progress tracking and visualization
  - Goal achievement celebrations

- **Time Journal Enhanced**
  - Calendar view of all activities
  - Category-based filtering and sorting
  - Timeline view with daily/weekly/monthly perspectives
  - Export functionality for data portability

- **Statistics & Analytics**
  - Streak tracking (consecutive days with focus sessions)
  - Auto vs manual time ratio analysis
  - Time distribution by category charts
  - Productivity trends over time

- **AI Time Coach**
  - Personalized insights: "You focus best between 9-11am"
  - Productivity tips based on user patterns
  - Goal achievement suggestions
  - Weekly/monthly summary emails

### Technical Requirements
- Data analytics backend services
- Chart/visualization components (React Native)
- AI insight generation algorithms
- Email notification system
- Data export functionality

### Definition of Done
- Users can set and track time-based goals
- Comprehensive dashboard shows productivity insights
- AI provides personalized coaching tips
- Users can export their time data
- Automated summary emails are sent

---

## 👥 Milestone 4: Squads & Challenges (Week 4)
**Status**: Future
**Priority**: Medium

### Features
- **Squad Creation & Management**
  - Create accountability groups with friends/family
  - Invite system via email or shareable links
  - Squad member management

- **Social Features**
  - Share focus session achievements
  - Share point earnings and rule completions
  - Optional goal sharing within squads

- **Weekly Challenges**
  - Squad-wide productivity challenges
  - Individual vs team goal tracking
  - Challenge progress visualization

- **Leaderboards & Badges**
  - Optional squad leaderboards
  - Achievement badges for milestones
  - Friendly competition elements

### Technical Requirements
- Squad management backend
- Social sharing functionality
- Real-time updates for squad activities
- Badge/achievement system
- Challenge creation and tracking

### Definition of Done
- Users can create and join squads
- Squad members can share achievements
- Weekly challenges engage squad members
- Leaderboards and badges motivate users

---

## 🎁 Milestone 5: Polish & Power Features
**Status**: Future
**Priority**: Low

### Features
- **Advanced Integrations**
  - HealthKit integration for wellness data
  - iOS Calendar integration for automatic time blocking
  - Siri Shortcuts for quick session starts

- **Enhanced User Experience**
  - Custom reminders and reflection prompts
  - Motivational overlays during focus sessions
  - UI celebration moments for achievements
  - Advanced accessibility features

- **Premium Features**
  - Advanced analytics and reporting
  - Custom themes and personalizations
  - Extended goal tracking options
  - Priority customer support

### Technical Requirements
- HealthKit SDK integration
- Calendar API integration
- Siri Shortcuts implementation
- Premium subscription system (Stripe/Apple Pay)
- Advanced UI animations and celebrations

### Definition of Done
- Seamless integration with iOS ecosystem
- Premium subscription offering
- Polished user experience with delightful interactions
- Comprehensive accessibility support

---

## Development Priorities by Week

### Week 1 Focus
1. Authentication system (Apple/Google OAuth)
2. Basic focus session functionality
3. Manual time logging
4. Database schema and API foundation

### Week 2 Focus
1. iOS Screen Time API integration
2. Point system implementation
3. Rule engine development
4. App blocking/unlocking functionality

### Week 3 Focus
1. Analytics and insights dashboard
2. Goal setting system
3. AI coaching features
4. Data visualization components

### Week 4 Focus
1. Squad creation and management
2. Social sharing features
3. Challenge system
4. Beta testing and feedback

## Success Metrics by Milestone

### Milestone 1
- User registration rate > 80%
- Focus session completion rate > 70%
- Manual log usage > 50% of users

### Milestone 2
- Rule creation rate > 60% of users
- Point earning engagement > 80%
- Screen Time API success rate > 95%

### Milestone 3
- Daily dashboard usage > 40%
- Goal setting adoption > 50%
- AI insight engagement > 30%

### Milestone 4
- Squad creation rate > 20% of users
- Squad retention rate > 60%
- Challenge participation > 40% of squad members

## Risk Mitigation

### Technical Risks
- **iOS Screen Time API limitations**: Research alternative approaches, prepare fallback solutions
- **Performance with large datasets**: Implement pagination and data optimization early
- **Cross-platform compatibility**: Focus on iOS first, prepare Android strategy

### Product Risks
- **User adoption of point system**: A/B test different point values and rules
- **Complexity of rule creation**: Provide templates and guided setup
- **Social feature engagement**: Start with simple sharing, expand based on usage

### Business Risks
- **Competition from established apps**: Focus on unique value proposition (positive reinforcement)
- **Monetization timing**: Validate core features before introducing premium tiers
- **User retention**: Implement strong onboarding and engagement hooks early