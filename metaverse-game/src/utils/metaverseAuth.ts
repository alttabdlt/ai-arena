// Metaverse Authentication Utilities

// Extract and store authentication data from URL on page load
(function extractAuthFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');
  const urlAddress = urlParams.get('address');
  
  // Store token if provided in URL
  if (urlToken) {
    localStorage.setItem('ai-arena-access-token', urlToken);
    console.log('🔐 Authentication token stored from URL');
    
    // Clean up URL to remove sensitive token
    urlParams.delete('token');
    const newUrl = urlParams.toString() 
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }
  
  // Store address if provided in URL
  if (urlAddress) {
    localStorage.setItem('metaverseUserAddress', urlAddress);
    // Also store as ai-arena-user for compatibility
    const userObj = { address: urlAddress };
    localStorage.setItem('ai-arena-user', JSON.stringify(userObj));
    console.log(`🔐 User address stored from URL: ${urlAddress}`);
  }
})();

/**
 * Get the current user address being used in the metaverse
 */
export function getCurrentUserAddress(): string | null {
  return localStorage.getItem('metaverseUserAddress');
}

/**
 * Get the current authentication token
 */
export function getCurrentAuthToken(): string | null {
  return localStorage.getItem('ai-arena-access-token');
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
 * Clear the stored user address and token
 */
export function clearUserAddress(): void {
  localStorage.removeItem('metaverseUserAddress');
  localStorage.removeItem('ai-arena-access-token');
  localStorage.removeItem('ai-arena-user');
  console.log('✅ User address and token cleared');
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
  const authToken = localStorage.getItem('ai-arena-access-token');
  
  console.log('🔐 Metaverse Authentication Status:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`URL Address:    ${urlAddress || 'Not provided'}`);
  console.log(`Stored Address: ${storedAddress || 'Not set'}`);
  console.log(`Test Address:   ${testAddress || 'Not set'}`);
  console.log(`Auth Token:     ${authToken ? '✅ Present' : '❌ Missing'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const currentAddress = urlAddress || storedAddress || testAddress || '0x2487155df829977813ea9b4f992c229f86d4f16a';
  console.log(`✨ Using address: ${currentAddress}`);
  console.log(`🔑 Auth status: ${authToken ? 'Authenticated' : 'Not authenticated'}`);
}

// Export helper functions to window for console access
if (typeof window !== 'undefined') {
  (window as any).metaverseAuth = {
    getCurrentUserAddress,
    getCurrentAuthToken,
    setUserAddress,
    clearUserAddress,
    showAuthStatus,
  };
  
  // Show auth status on load
  console.log('💡 Metaverse Auth Helpers Available:');
  console.log('  metaverseAuth.showAuthStatus() - Show current auth status');
  console.log('  metaverseAuth.setUserAddress(address) - Set a new address');
  console.log('  metaverseAuth.clearUserAddress() - Clear stored address and token');
  console.log('  metaverseAuth.getCurrentUserAddress() - Get current address');
  console.log('  metaverseAuth.getCurrentAuthToken() - Get current auth token');
}