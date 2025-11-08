import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { Fonts } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const tint = useThemeColor({}, 'tint');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? [styles.link, { color: tint }] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Fonts?.serif,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: Fonts?.serif,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '600',
    fontFamily: Fonts?.serif,
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    fontFamily: Fonts?.serif,
    letterSpacing: 0.25,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    fontFamily: Fonts?.serif,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
