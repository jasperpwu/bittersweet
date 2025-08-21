# Development Workflow & Best Practices

## MCP-Powered Development Workflow

This document outlines the development workflow using Model Context Protocol (MCP) tools for efficient React Native development.

## MCP Tools Configuration

### Required MCP Servers

Add these to your `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "react-native-guide": {
      "command": "uvx",
      "args": ["react-native-guide-mcp@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "autoApprove": ["analyze_component", "architecture_advice", "debug_issue"]
    },
    "react-native": {
      "command": "uvx", 
      "args": ["react-native-mcp@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "autoApprove": ["buildAppleAppWithoutStarting", "getReactNativeConfig"]
    },
    "react-native-debugger": {
      "command": "uvx",
      "args": ["@twodoorsdev/react-native-debugger-mcp@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "autoApprove": ["getConnectedApps", "readConsoleLogsFromApp"]
    }
  }
}
```

## Development Workflow Steps

### 1. Pre-Development Planning

Before writing any code, use MCP tools for architectural guidance:

```bash
# Get architecture advice for the feature
mcp_react_native_guide_architecture_advice({
  project_type: "complex_app",
  features: ["focus_sessions", "timer_functionality", "reward_system"]
})
```

**When to use**: 
- Starting a new feature
- Refactoring existing code
- Making architectural decisions

### 2. Component Development Cycle

#### Step 1: Create Component Scaffold
```typescript
// Create basic component structure
export const ComponentName: FC<ComponentNameProps> = memo(({
  // Props
}) => {
  return (
    <StyledView>
      {/* Component content */}
    </StyledView>
  );
});
```

#### Step 2: Analyze Component with MCP
```bash
# Analyze component for best practices
mcp_react_native_guide_analyze_component({
  code: "component_code_here",
  type: "functional"
})
```

**What it checks**:
- Performance optimizations
- Accessibility compliance
- React Native best practices
- Memory leak prevention
- Animation performance

#### Step 3: Build and Test
```bash
# Build without starting to check for errors
mcp_react_native_buildAppleAppWithoutStarting({
  platform: "ios",
  configuration: "Debug"
})
```

#### Step 4: Debug Issues (if any)
```bash
# Get debugging guidance for specific issues
mcp_react_native_guide_debug_issue({
  issue_type: "performance", # or "crash", "ui_layout", etc.
  platform: "ios",
  error_message: "specific_error_if_available"
})
```

### 3. Feature Implementation Workflow

#### Focus Session Feature Example (Updated)

1. **Architecture Planning**
```bash
mcp_react_native_guide_architecture_advice({
  project_type: "complex_app",
  features: ["focus_sessions", "fruit_rewards", "app_blocking", "ai_insights"]
})
```

2. **Create Enhanced Timer Component with Fruit Garden**
```typescript
// components/focus/CircularTimer/CircularTimer.tsx
export const CircularTimer: FC<CircularTimerProps> = memo(({
  duration,
  elapsed,
  isActive,
  fruitCount,
  color = '#EF786C'
}) => {
  const progress = useSharedValue(0);
  const fruitScale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }]
  }));
  
  const fruitAnimationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fruitScale.value }]
  }));
  
  useEffect(() => {
    progress.value = withTiming(elapsed / duration, {
      duration: 1000,
      easing: Easing.linear
    });
  }, [elapsed, duration]);
  
  // Animate fruit earning every 5 minutes
  useEffect(() => {
    if (elapsed > 0 && elapsed % 300 === 0) {
      fruitScale.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );
    }
  }, [elapsed]);
  
  return (
    <StyledView className="items-center justify-center relative">
      {/* Fruit Garden Background */}
      <FruitGarden 
        fruitCount={fruitCount}
        isGrowing={isActive}
        sessionProgress={progress.value}
      />
      
      {/* Timer Ring */}
      <Animated.View style={animatedStyle} className="absolute">
        <Svg width={280} height={280}>
          <Circle
            cx={140}
            cy={140}
            r={130}
            stroke={color}
            strokeWidth={8}
            fill="transparent"
            strokeDasharray={`${progress.value * 816} 816`}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      
      {/* Fruit Counter */}
      <Animated.View style={fruitAnimationStyle} className="absolute bottom-4">
        <FruitCounter count={fruitCount} animated showEarningAnimation />
      </Animated.View>
    </StyledView>
  );
});
```

3. **Create Fruit Garden Background Component**
```typescript
// components/focus/FruitGarden/FruitGarden.tsx
export const FruitGarden: FC<FruitGardenProps> = memo(({
  fruitCount,
  isGrowing,
  sessionProgress
}) => {
  const treeGrowth = useSharedValue(0);
  
  const animatedTreeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: treeGrowth.value }]
  }));
  
  useEffect(() => {
    if (isGrowing) {
      treeGrowth.value = withTiming(sessionProgress, {
        duration: 1000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1)
      });
    }
  }, [sessionProgress, isGrowing]);
  
  return (
    <StyledView className="absolute inset-0 items-center justify-center">
      <Animated.View style={animatedTreeStyle}>
        <Svg width={200} height={200}>
          {/* Tree trunk */}
          <Rect x={95} y={150} width={10} height={40} fill="#8B4513" />
          
          {/* Tree crown */}
          <Circle cx={100} cy={140} r={30} fill="#228B22" />
          
          {/* Fruits based on count */}
          {Array.from({ length: Math.min(fruitCount, 8) }).map((_, index) => (
            <Circle
              key={index}
              cx={85 + (index % 4) * 8}
              cy={125 + Math.floor(index / 4) * 8}
              r={3}
              fill="#FF6B35"
            />
          ))}
        </Svg>
      </Animated.View>
    </StyledView>
  );
});
```

3. **Analyze Component**
```bash
mcp_react_native_guide_analyze_component({
  code: "CircularTimer component code",
  type: "functional"
})
```

4. **Build and Test**
```bash
mcp_react_native_buildAppleAppWithoutStarting({
  platform: "ios",
  configuration: "Debug"
})
```

### 4. Performance Optimization Workflow

#### Step 1: Analyze Performance
```bash
mcp_react_native_guide_analyze_codebase_performance({
  codebase_path: "./src",
  focus_areas: ["list_rendering", "animations", "memory_usage"]
})
```

#### Step 2: Get Optimization Suggestions
```bash
mcp_react_native_guide_optimize_performance({
  scenario: "list_rendering", # or other performance scenarios
  platform: "both"
})
```

#### Step 3: Implement Optimizations
- Replace FlatList with FlashList
- Add React.memo to components
- Use native driver for animations
- Implement proper cleanup in useEffect

#### Step 4: Verify Improvements
```bash
# Build release version for performance testing
mcp_react_native_buildAppleAppWithoutStarting({
  platform: "ios", 
  configuration: "Release"
})
```

### 5. Code Quality Workflow

#### Automated Code Analysis
```bash
# Comprehensive codebase analysis
mcp_react_native_guide_analyze_codebase_comprehensive({
  codebase_path: "./src",
  analysis_types: ["performance", "security", "code_quality", "accessibility"]
})
```

#### Code Remediation
```bash
# Fix identified issues automatically
mcp_react_native_guide_remediate_code({
  code: "problematic_code_here",
  remediation_level: "expert",
  add_comments: true
})
```

#### Refactoring
```bash
# Get refactoring suggestions
mcp_react_native_guide_refactor_component({
  code: "component_to_refactor",
  refactor_type: "performance", # or "maintainability", "accessibility"
  include_tests: true
})
```

### 6. Testing Workflow

#### Generate Component Tests
```bash
mcp_react_native_guide_generate_component_test({
  component_code: "component_code_here",
  component_name: "ComponentName",
  test_type: "comprehensive",
  testing_framework: "jest",
  include_accessibility: true,
  include_performance: true
})
```

#### Analyze Testing Strategy
```bash
mcp_react_native_guide_analyze_testing_strategy({
  project_path: "./",
  focus_areas: ["unit", "integration", "accessibility"]
})
```

#### Test Coverage Analysis
```bash
mcp_react_native_guide_analyze_test_coverage({
  project_path: "./",
  coverage_threshold: 80,
  generate_report: true
})
```

## Daily Development Routine

### Morning Setup
1. Check MCP server status
2. Pull latest changes
3. Run comprehensive codebase analysis
4. Review any new issues or recommendations

### Feature Development (Updated for bittersweet)
1. Get architecture advice before starting
2. Create component scaffold with design system compliance
3. Implement core functionality with fruit reward integration
4. Add AI coach integration points where applicable
5. Implement Dynamic Island integration (iOS)
6. Analyze component with MCP
7. Build and test (Debug and Release)
8. Test app blocking functionality (if applicable)
9. Debug any issues
10. Optimize performance (especially animations)
11. Generate comprehensive tests
12. Verify accessibility compliance

### Pre-Commit Checklist
- [ ] Component analysis passed
- [ ] Build successful (Debug and Release)
- [ ] No performance regressions
- [ ] Tests generated and passing
- [ ] Accessibility compliance verified
- [ ] Code quality issues resolved

### End of Day
1. Run comprehensive analysis on changed files
2. Address any critical issues
3. Update documentation if needed
4. Commit changes with descriptive messages

## Debugging Workflow

### Performance Issues
1. **Identify Issue Type**
   - List rendering performance
   - Animation stuttering
   - Memory leaks
   - Slow navigation

2. **Use Debug Tool**
```bash
mcp_react_native_guide_debug_issue({
  issue_type: "performance",
  platform: "ios",
  error_message: "List scrolling is laggy"
})
```

3. **Apply Recommendations**
   - Switch to FlashList
   - Add useNativeDriver to animations
   - Implement proper memoization
   - Clean up event listeners

4. **Verify Fix**
```bash
# Test in release build
mcp_react_native_buildAppleAppWithoutStarting({
  platform: "ios",
  configuration: "Release"
})
```

### Build Errors
1. **Capture Error Message**
2. **Use Debug Tool**
```bash
mcp_react_native_guide_debug_issue({
  issue_type: "crash",
  platform: "ios",
  error_message: "full_error_message_here"
})
```

3. **Follow Recommendations**
4. **Rebuild and Test**

### UI Layout Issues
1. **Screenshot the Issue**
2. **Use Debug Tool**
```bash
mcp_react_native_guide_debug_issue({
  issue_type: "ui_layout",
  platform: "both"
})
```

3. **Check Flexbox Properties**
4. **Verify NativeWind Classes**
5. **Test on Different Screen Sizes**

## Best Practices

### Component Development
- Always use `React.memo` for functional components
- Implement proper TypeScript interfaces
- Use NativeWind for consistent styling
- Add accessibility properties
- Include proper error boundaries

### Performance
- Use FlashList instead of FlatList
- Enable native driver for all animations
- Implement proper cleanup in useEffect
- Use useMemo and useCallback appropriately
- Test performance in release builds only

### Code Quality
- Run MCP analysis after every component
- Fix issues immediately, don't accumulate technical debt
- Generate tests for all new components
- Maintain consistent code style
- Document complex logic

### MCP Integration
- Use architecture advice before major changes
- Analyze components after implementation
- Debug issues systematically with MCP tools
- Generate comprehensive tests
- Perform regular codebase analysis

This workflow ensures high-quality, performant React Native code while leveraging MCP tools for automated analysis and optimization.