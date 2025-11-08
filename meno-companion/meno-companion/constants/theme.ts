/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2a211c',
    background: '#faf7f2',
    card: '#fffdf8',
    paper: '#ffffff',
    elevated: '#f2ebe1',
    muted: '#8f8375',
    accent: '#8b5e3c',
    accentContrast: '#fdfbf7',
    border: '#e6dccd',
    tint: '#8b5e3c',
    icon: '#8f8375',
    tabIconDefault: '#8f8375',
    tabIconSelected: '#8b5e3c',
  },
  dark: {
    text: '#e9e5dc',
    background: '#1b1b1a',
    card: '#23221f',
    paper: '#242422',
    elevated: '#2d2c29',
    muted: '#afa89e',
    accent: '#c4a46e',
    accentContrast: '#1b1b1a',
    border: '#3c3b38',
    tint: '#c4a46e',
    icon: '#afa89e',
    tabIconDefault: '#afa89e',
    tabIconSelected: '#c4a46e',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
