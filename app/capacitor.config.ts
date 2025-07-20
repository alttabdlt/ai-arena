import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.65b4b25fcd0a41d6bcc8610a770ff8ec',
  appName: 'pokerbot-showdown-arena',
  webDir: 'dist',
  server: {
    url: "https://65b4b25f-cd0a-41d6-bcc8-610a770ff8ec.lovableproject.com?forceHideBadge=true",
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#000000",
      showSpinner: false
    }
  }
};

export default config;