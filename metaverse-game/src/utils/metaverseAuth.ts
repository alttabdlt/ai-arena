// Metaverse Authentication Utilities

/**
 * Get the current user address being used in the metaverse
 */
export function getCurrentUserAddress(): string | null {
  return localStorage.getItem('metaverseUserAddress');
}

/**
 * Set a new user address (for testing/development)
 */
export function setUserAddress(address: string): void {
  localStorage.setItem('metaverseUserAddress', address);
  console.log(`✅ User address set to: ${address}`);
  console.log('Refresh the page to load bots for this address');
}

/**
 * Clear the stored user address
 */
export function clearUserAddress(): void {
  localStorage.removeItem('metaverseUserAddress');
  console.log('✅ User address cleared');
  console.log('Refresh the page to use fallback address');
}

/**
 * Display current authentication status
 */
export function showAuthStatus(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const urlAddress = urlParams.get('address');
  const storedAddress = localStorage.getItem('metaverseUserAddress');
  const testAddress = localStorage.getItem('testUserAddress');
  
  console.log('🔐 Metaverse Authentication Status:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`URL Address:    ${urlAddress || 'Not provided'}`);
  console.log(`Stored Address: ${storedAddress || 'Not set'}`);
  console.log(`Test Address:   ${testAddress || 'Not set'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const currentAddress = urlAddress || storedAddress || testAddress || '0x2487155df829977813ea9b4f992c229f86d4f16a';
  console.log(`✨ Using address: ${currentAddress}`);
}

// Export helper functions to window for console access
if (typeof window !== 'undefined') {
  (window as any).metaverseAuth = {
    getCurrentUserAddress,
    setUserAddress,
    clearUserAddress,
    showAuthStatus,
  };
  
  // Show auth status on load
  console.log('💡 Metaverse Auth Helpers Available:');
  console.log('  metaverseAuth.showAuthStatus() - Show current auth status');
  console.log('  metaverseAuth.setUserAddress(address) - Set a new address');
  console.log('  metaverseAuth.clearUserAddress() - Clear stored address');
  console.log('  metaverseAuth.getCurrentUserAddress() - Get current address');
}