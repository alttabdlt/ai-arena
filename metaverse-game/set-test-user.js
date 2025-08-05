#!/usr/bin/env node

/**
 * Helper script to set a test user address for development
 * Usage: node set-test-user.js <address>
 */

const address = process.argv[2];

if (!address) {
  console.error('Usage: node set-test-user.js <address>');
  console.error('Example: node set-test-user.js 0x1234567890123456789012345678901234567890');
  process.exit(1);
}

console.log(`Setting test user address to: ${address}`);
console.log('\nTo use this in the browser console:');
console.log(`localStorage.setItem('testUserAddress', '${address}');`);
console.log('window.location.reload();');
console.log('\nOr you can get a real user address from the AI Arena backend by running:');
console.log('cd ../backend && npx prisma studio');
console.log('Then look at the User table for addresses with bots.');