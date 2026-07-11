import React, { Component, ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '../../../config/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('Error boundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center', 
          backgroundColor: colors.dark.background,
          padding: 20,
        }}>
          <Text style={{ 
            color: colors.white, 
            fontSize: 18, 
            fontWeight: 'bold',
            marginBottom: 10,
            textAlign: 'center',
          }}>
            Something went wrong
          </Text>
          <Text style={{ 
            color: colors.dark.textSecondary, 
            fontSize: 14,
            marginBottom: 20,
            textAlign: 'center',
          }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Pressable
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
            }}
            onPress={() => this.setState({ hasError: false, error: undefined })}
          >
            <Text style={{ color: colors.white, fontWeight: '600' }}>
              Try Again
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}