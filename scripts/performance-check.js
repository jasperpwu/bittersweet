#!/usr/bin/env node

/**
 * Performance optimization checker
 * Analyzes code for performance anti-patterns and suggests optimizations
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const appDir = path.join(__dirname, '../app');

// Performance anti-patterns to check for
const antiPatterns = {
  // Components without memo
  unmemoizedComponents: {
    pattern: /export\s+const\s+(\w+):\s*FC.*=\s*\(/g,
    message: 'Component not memoized - consider using React.memo()',
    severity: 'warning',
  },

  // Inline object/array creation in JSX
  inlineObjects: {
    pattern: /\s+style=\{\{[^}]+\}\}/g,
    message: 'Inline style object - consider extracting to avoid re-creation',
    severity: 'info',
  },

  // Missing useCallback for event handlers
  unmemoizedHandlers: {
    pattern: /const\s+handle\w+\s*=\s*\([^)]*\)\s*=>\s*\{/g,
    message: 'Event handler not memoized - consider using useCallback',
    severity: 'warning',
  },

  // Large selector usage without equality check
  largeSelectors: {
    pattern: /useAppStore\(\(state\)\s*=>\s*state\.\w+\)/g,
    message: 'Large selector without equality check - consider optimizing',
    severity: 'info',
  },

  // Console.log in production code
  consoleLog: {
    pattern: /console\.log\(/g,
    message: 'Console.log found - should use logger instead',
    severity: 'warning',
  },
};

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', '.expo', '.git'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  Object.entries(antiPatterns).forEach(([key, pattern]) => {
    const matches = content.match(pattern.pattern);
    if (matches) {
      issues.push({
        type: key,
        count: matches.length,
        message: pattern.message,
        severity: pattern.severity,
        matches: matches.slice(0, 3), // Show first 3 matches
      });
    }
  });

  return issues;
}

function generateOptimizationSuggestions(issues) {
  const suggestions = [];

  issues.forEach((issue) => {
    switch (issue.type) {
      case 'unmemoizedComponents':
        suggestions.push('• Wrap components with React.memo() to prevent unnecessary re-renders');
        suggestions.push('• Add custom equality functions for complex props');
        break;
      case 'inlineObjects':
        suggestions.push('• Extract inline styles to constants or useMemo');
        suggestions.push('• Use StyleSheet.create() for React Native styles');
        break;
      case 'unmemoizedHandlers':
        suggestions.push('• Wrap event handlers with useCallback()');
        suggestions.push('• Include proper dependencies in useCallback dependency array');
        break;
      case 'largeSelectors':
        suggestions.push('• Add equality functions to Zustand selectors');
        suggestions.push('• Split large selectors into smaller, focused ones');
        break;
      case 'consoleLog':
        suggestions.push('• Replace console.log with logger utility');
        suggestions.push('• Remove debug logs before production');
        break;
    }
  });

  return [...new Set(suggestions)]; // Remove duplicates
}

function main() {
  console.log('🚀 Performance Analysis Starting...\n');

  const allFiles = [...getAllFiles(srcDir), ...getAllFiles(appDir)];

  console.log(`📁 Analyzing ${allFiles.length} files for performance issues...\n`);

  let totalIssues = 0;
  let filesWithIssues = 0;
  const allIssues = [];

  allFiles.forEach((filePath) => {
    const relativePath = path.relative(process.cwd(), filePath);
    const issues = analyzeFile(filePath);

    if (issues.length > 0) {
      filesWithIssues++;
      totalIssues += issues.reduce((sum, issue) => sum + issue.count, 0);
      allIssues.push(...issues);

      console.log(`⚠️  ${relativePath}:`);
      issues.forEach((issue) => {
        const icon = issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} ${issue.message} (${issue.count} occurrences)`);
        if (issue.matches && issue.matches.length > 0) {
          console.log(`      Examples: ${issue.matches.slice(0, 2).join(', ')}`);
        }
      });
      console.log();
    }
  });

  console.log('📊 Performance Analysis Summary:');
  console.log(`   Files analyzed: ${allFiles.length}`);
  console.log(`   Files with issues: ${filesWithIssues}`);
  console.log(`   Total issues found: ${totalIssues}`);

  if (allIssues.length > 0) {
    console.log('\n💡 Optimization Suggestions:');
    const suggestions = generateOptimizationSuggestions(allIssues);
    suggestions.forEach((suggestion) => {
      console.log(`   ${suggestion}`);
    });

    console.log('\n🎯 Priority Actions:');
    console.log('   1. Memoize frequently re-rendering components');
    console.log('   2. Optimize Zustand selectors with equality checks');
    console.log('   3. Use useCallback for event handlers');
    console.log('   4. Extract inline objects and styles');
    console.log('   5. Replace console.log with proper logging');
  } else {
    console.log('\n✅ No performance issues detected! Great job!');
  }

  console.log('\n📈 Performance Monitoring:');
  console.log('   • Use React DevTools Profiler to identify slow components');
  console.log('   • Monitor store performance with built-in logging');
  console.log('   • Check memory usage in development tools');
  console.log('   • Use Flipper for React Native performance debugging');
}

if (require.main === module) {
  main();
}

module.exports = { analyzeFile, antiPatterns };
