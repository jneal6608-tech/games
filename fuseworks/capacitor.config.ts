import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fuseworks.game', // CHANGE before first Play upload if you want your own namespace; it can never change afterwards.
  appName: 'Fuseworks',
  webDir: 'dist',
  backgroundColor: '#070b1a',
  android: { backgroundColor: '#070b1a', allowMixedContent: false },
  plugins: {
    // The game finishes purchases itself, only after the reward is saved (see Store in src/platform/platform.ts).
    NativePurchases: { autoFinishTransactions: false },
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'DARK' },
    SplashScreen: { launchAutoHide: true, launchShowDuration: 600, backgroundColor: '#070b1a', showSpinner: false },
  },
};
export default config;
