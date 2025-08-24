/**
 * Simple validation script to check store functionality
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating store implementation...');

// Check if all required files exist
const requiredFiles = [
  'src/store/index.ts',
  'src/store/types.ts',
  'src/store/slices/authSlice.ts',
  'src/store/slices/focusSlice.ts',
  'src/store/slices/tasksSlice.ts',
  'src/store/slices/rewardsSlice.ts',
  'src/store/slices/socialSlice.ts',
  'src/store/slices/settingsSlice.ts',
  'src/store/slices/uiSlice.ts',
  'src/store/utils/entityManager.ts',
  'src/store/utils/eventBus.ts',
  'src/store/middleware/persistence.ts',
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing file: ${file}`);
    allFilesExist = false;
  } else {
    console.log(`✅ Found: ${file}`);
  }
});

if (allFilesExist) {
  console.log('\n✅ All required store files exist!');
} else {
  console.log('\n❌ Some required files are missing.');
  process.exit(1);
}

// Check for common issues in the main store file
const storeIndexPath = path.join(__dirname, '..', 'src/store/index.ts');
const storeContent = fs.readFileSync(storeIndexPath, 'utf8');

// Check for proper imports
const requiredImports = [
  'createAuthSlice',
  'createFocusSlice', 
  'createTasksSlice',
  'createRewardsSlice',
  'createSocialSlice',
  'createSettingsSlice',
  'createUISlice'
];

let allImportsPresent = true;

requiredImports.forEach(importName => {
  if (!storeContent.includes(importName)) {
    console.error(`❌ Missing import: ${importName}`);
    allImportsPresent = false;
  } else {
    console.log(`✅ Import found: ${importName}`);
  }
});

if (allImportsPresent) {
  console.log('\n✅ All required imports are present!');
} else {
  console.log('\n❌ Some required imports are missing.');
  process.exit(1);
}

console.log('\n🎉 Store validation completed successfully!');
console.log('\n📝 Next steps:');
console.log('1. Start the development server: npm start');
console.log('2. Check the console for any runtime errors');
console.log('3. Test the tasks screen functionality');
console.log('4. Verify date selection works properly');