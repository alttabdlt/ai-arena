#!/usr/bin/env node

// Simple script to add test lootboxes via Convex mutation
// Usage: node add-test-lootbox.cjs

async function main() {
  console.log('This functionality is now available directly in the UI!');
  console.log('\nTo add test lootboxes:');
  console.log('1. Start the dev server: npm run dev');
  console.log('2. Open http://localhost:5173 (or the port shown)');
  console.log('3. Select a bot from the dropdown');
  console.log('4. Click the Inventory button (briefcase icon)');
  console.log('5. In the Lootboxes tab, click "Create Test Lootbox"');
  console.log('\nThe test button only appears in development mode.');
}

main().catch(console.error);