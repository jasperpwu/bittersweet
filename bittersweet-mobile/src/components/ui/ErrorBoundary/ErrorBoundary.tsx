import React, { Component, ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';

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
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Error info:', errorInfo);
    }
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
          backgroundColor: '#1B1C30',
          padding: 20,
        }}>
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 18, 
            fontWeight: 'bold',
            marginBottom: 10,
            textAlign: 'center',
          }}>
            Something went wrong
          </Text>
          <Text style={{ 
            color: '#CACACA', 
            fontSize: 14,
            marginBottom: 20,
            textAlign: 'center',
          }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Pressable
            style={{
              backgroundColor: '#6592E9',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
            }}
            onPress={() => this.setState({ hasError: false, error: undefined })}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
              Try Again
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}