# Bittersweet

A comprehensive screen time management ecosystem that helps users build healthier digital habits through focus sessions, intelligent app blocking, positive reinforcement, and social accountability.

## 📁 Project Structure

```
bittersweet/
├── bittersweet-app/           # React Native mobile application
│   ├── src/                   # Application source code
│   │   ├── app/              # Expo Router screens
│   │   ├── components/       # Reusable UI components
│   │   ├── constants/        # Design system tokens
│   │   ├── types/            # TypeScript definitions
│   │   └── utils/            # Utility functions
│   ├── package.json          # Dependencies and scripts
│   ├── README.md             # Mobile app documentation
│   └── CHANGELOG.md          # Version history
└── .kiro/                    # Kiro AI assistant configuration
    ├── specs/                # Feature specifications
    └── steering/             # Development guidelines
```

## 🚀 Getting Started

### Mobile App Development

Navigate to the mobile app directory and follow the setup instructions:

```bash
cd bittersweet-app
npm install
npm start
```

For detailed development instructions, see [bittersweet-app/README.md](./bittersweet-app/README.md).

## 📱 Mobile App Features

### Current Implementation (v1.0.0)
- ✅ **Project Foundation**: Expo React Native with TypeScript
- ✅ **Design System**: Comprehensive color, typography, and spacing tokens
- ✅ **Navigation**: Tab-based routing with Expo Router
- ✅ **UI Components**: Button and Typography components
- ✅ **Type Safety**: Complete TypeScript models for all features
- ✅ **Utilities**: Time formatting and validation functions

### Planned Features
- 🚧 **Focus Timer**: Customizable focus sessions with progress tracking
- 🚧 **App Blocking**: Intelligent app blocking with seed-based unlocks
- 🚧 **Time Journal**: Calendar-based time tracking and reflection
- 🚧 **Insights Dashboard**: AI-powered productivity analytics
- 🚧 **Social Squads**: Team challenges and accountability features
- 🚧 **Reward System**: Seed-based gamification with achievements

## 🛠️ Technology Stack

### Mobile App
- **React Native** 0.79.5 with **React** 19.0.0
- **Expo SDK** ~53.0.20 for native capabilities
- **TypeScript** ~5.8.3 with strict mode
- **NativeWind v4** for Tailwind CSS styling
- **Expo Router v5** for file-based navigation
- **React Native Reanimated v4** for animations

### Development Tools
- **ESLint** with React Native rules
- **Prettier** for code formatting
- **Kiro AI** for development assistance
- **MCP Servers** for React Native debugging

## 📋 Development Status

The project is currently in **Phase 1: Foundation** with the core architecture, design system, and navigation structure complete. See the [implementation tasks](./.kiro/specs/bittersweet-mobile-app/tasks.md) for detailed progress tracking.

### Completed Tasks
- [x] Project foundation and development environment
- [x] Design system and UI foundation (partial)
- [x] Navigation structure and basic screens

### Next Milestones
- [ ] Focus timer core functionality
- [ ] Session completion and reflection system
- [ ] Seed reward system implementation
- [ ] App blocking and unlock system

## 📖 Documentation

- **[Mobile App README](./bittersweet-app/README.md)**: Comprehensive development guide
- **[Mobile App Changelog](./bittersweet-app/CHANGELOG.md)**: Version history and features
- **[Project Specifications](./.kiro/specs/bittersweet-mobile-app/)**: Detailed requirements and design
- **[Development Guidelines](./.kiro/steering/)**: Code standards and best practices

## 🤝 Contributing

This project uses Kiro AI for development assistance and follows strict TypeScript and React Native best practices. All components must adhere to the design system tokens and accessibility guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.