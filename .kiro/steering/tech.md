# Technology Stack - bittersweet

## Frontend
- **Framework**: React Native
- **Navigation**: React Navigation (latest version)
- **State Management**: Zustand (preferred for simpler state)
- **UI Components**: Custom components following design system
- **Icons**: React Native Vector Icons
- **Animations**: React Native Reanimated 3

## Backend
- **Language**: Go (Golang)
- **Architecture**: RESTful API
- **Framework**: Gin
- **Database**: PostgreSQL
- **Authentication**: Apple OAuth + Google OAuth
- **Containerization**: Docker (buildable image for easy deployment)
- **Push Notifications**: Apple Push Notification Service (APNs) + Firebase Cloud Messaging
- **Payments**: Stripe + Apple Pay integration

## iOS Integration
- **Screen Time API**: iOS Screen Time API for app blocking/unlocking
- **HealthKit**: Future integration for health data
- **Calendar**: iOS Calendar integration for milestone 5

## Development Tools
- **Code Editor**: VS Code with React Native extensions
- **Version Control**: Git
- **Package Manager**: npm
- **Testing**: Jest for unit tests, Detox for E2E testing
- **Linting**: ESLint with React Native configuration
- **Code Formatting**: Prettier

## Deployment & Infrastructure
- **Mobile**: App Store (iOS), Google Play Store (Android)
- **Backend Hosting**: Docker containers (AWS/GCP/DigitalOcean)
- **Database**: PostgreSQL (managed service preferred)
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry for error tracking
- **Analytics**: Custom analytics

## Third-Party Services
- **Authentication**: Apple Sign-In, Google Sign-In
- **Push Notifications**: Native iOS/Android + Firebase
- **Payments**: Stripe SDK, Apple Pay
- **File Storage**: AWS S3 or similar (if needed for user data export)

## Development Environment Setup
```bash
# React Native CLI setup
npm install -g react-native-cli

# Backend setup
docker build -t bittersweet-backend .
docker run -p 8080:8080 bittersweet-backend
```

## Architecture Principles
- **Mobile-First**: Optimized for mobile user experience
- **API-Driven**: Clear separation between frontend and backend
- **Dockerized Backend**: Easy deployment and scaling
- **Native Integration**: Leverage iOS Screen Time API and native features
- **Offline-First**: Core features should work without internet connection
- **Privacy-Focused**: Minimal data collection, user control over data sharing