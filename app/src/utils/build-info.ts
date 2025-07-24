// Build information to help identify cache issues
export const BUILD_INFO = {
  version: '1.0.0',
  buildTime: new Date().toISOString(),
  buildId: Math.random().toString(36).substring(7)
};

// Log build info on startup
console.log('AI Arena Build Info:', BUILD_INFO);