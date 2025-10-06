# Live Activity Assets

This directory contains images that can be used in iOS Live Activities.

## Usage

Images placed in this directory can be referenced in Live Activity state by their filename.

Example:
- Place `timer-icon.png` in this directory
- Reference it in LiveActivityService as: `iconName: 'timer-icon'`

## Supported Formats

- PNG files
- Recommended sizes: 24x24, 32x32, 48x48 for small icons
- Keep file sizes small for better performance

## Current Implementation

The unlock countdown Live Activity currently uses system symbols and doesn't require custom images, but this directory is available for future enhancements.