# Mock Data Documentation

## Overview

This document describes the mock data structure used in the bittersweet mobile app store for development and testing purposes.

## Store Structure

### Focus Sessions (Primary Entity)
- **Sessions**: Time-based focus periods with tags and progress tracking
- **Tags**: Labels for organizing and categorizing sessions
- **Settings**: User preferences for focus sessions

### Rewards
- **Balance**: Current seed balance
- **Transactions**: History of earned and spent seeds
- **Unlockable Apps**: Apps that can be unlocked with seeds

### Settings
- **Theme**: Light/dark mode preference
- **Language**: User's preferred language
- **Notifications**: Notification preferences

## Mock Data Generation

### Focus Sessions (5)
✅ **Session Management**: Sessions in various states (scheduled, active, completed)
✅ **Tag System**: Pre-defined tags with usage tracking
✅ **Progress Tracking**: Duration, status, and completion data

### Rewards (3)
✅ **Seed Economy**: Balance, transactions, and unlockable content
✅ **Transaction History**: Detailed records of all seed movements
✅ **App Unlocks**: Progressive content unlocking system

## Usage

The mock data is automatically generated when the store is initialized in development mode. This provides a realistic dataset for testing the app's functionality without requiring manual data entry.

## Data Structure

All entities follow a normalized structure with:
- `byId`: Record of entities indexed by ID
- `allIds`: Array of all entity IDs for iteration
- `loading`: Loading state indicator
- `error`: Error state information
- `lastUpdated`: Timestamp of last data update