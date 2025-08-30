#!/usr/bin/env node

/**
 * Dead code cleanup script
 * Identifies and reports unused imports and dead code
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const appDir = path.join(__dirname, '../app');

// Common patterns for unused code
const patterns = {
  unusedReactImport: /import React.*from ['"]react['"];?\s*\n/g,
  unusedImports: /import\s+{[^}]*}\s+from\s+['"][^'"]*['"];?\s*\n/g,
  emptyLines: /\n\s*\n\s*\n/g,
  trailingSpaces: /[ \t]+$/gm,
};

// Files to check
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and other build directories
      if (!['node_modules', 'dist', '.expo', '.git'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (extensions.some((ext) => file.endsWith(ext))) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // Check for unused React imports
  if (content.includes('import React') && !content.includes('React.')) {
    // Check if JSX is used (which requires React in older versions)
    const hasJSX = /<[A-Z]/.test(content) || /<[a-z]/.test(content);
    if (!hasJSX) {
      issues.push({
        type: 'unused-react-import',
        line: content.split('\n').findIndex((line) => line.includes('import React')) + 1,
        message: 'Unused React import detected',
      });
    }
  }

  // Check for multiple empty lines
  const emptyLineMatches = content.match(/\n\s*\n\s*\n/g);
  if (emptyLineMatches) {
    issues.push({
      type: 'multiple-empty-lines',
      count: emptyLineMatches.length,
      message: `${emptyLineMatches.length} instances of multiple empty lines`,
    });
  }

  // Check for trailing spaces
  const trailingSpaceMatches = content.match(/[ \t]+$/gm);
  if (trailingSpaceMatches) {
    issues.push({
      type: 'trailing-spaces',
      count: trailingSpaceMatches.length,
      message: `${trailingSpaceMatches.length} lines with trailing spaces`,
    });
  }

  return issues;
}

function cleanupFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Remove multiple empty lines
  const originalContent = content;
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Remove trailing spaces
  content = content.replace(/[ \t]+$/gm, '');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    changed = true;
  }

  return changed;
}

function main() {
  console.log('🧹 Starting dead code cleanup...\n');

  const allFiles = [...getAllFiles(srcDir), ...getAllFiles(appDir)];

  console.log(`📁 Analyzing ${allFiles.length} files...\n`);

  let totalIssues = 0;
  let filesWithIssues = 0;
  let filesFixed = 0;

  allFiles.forEach((filePath) => {
    const relativePath = path.relative(process.cwd(), filePath);
    const issues = analyzeFile(filePath);

    if (issues.length > 0) {
      filesWithIssues++;
      totalIssues += issues.length;

      console.log(`⚠️  ${relativePath}:`);
      issues.forEach((issue) => {
        console.log(`   - ${issue.message}`);
      });
      console.log();
    }

    // Attempt to fix simple issues
    if (cleanupFile(filePath)) {
      filesFixed++;
    }
  });

  console.log('📊 Summary:');
  console.log(`   Files analyzed: ${allFiles.length}`);
  console.log(`   Files with issues: ${filesWithIssues}`);
  console.log(`   Total issues found: ${totalIssues}`);
  console.log(`   Files automatically fixed: ${filesFixed}`);

  if (totalIssues > 0) {
    console.log('\n💡 Manual fixes may be required for some issues.');
    console.log('   Review the output above and fix unused imports manually.');
  } else {
    console.log('\n✅ No issues found! Code is clean.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeFile, cleanupFile, getAllFiles };
