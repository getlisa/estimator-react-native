import { useWindowDimensions } from 'react-native';

export type LayoutSize = 'compact' | 'medium' | 'expanded' | 'large';

/**
 * Breakpoints: compact <600 (phones), medium 600–1023 (tablets), expanded 1024–1599
 * (laptops/monitors), large ≥1600 (TV / projector in a browser).
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const size: LayoutSize =
    width < 600 ? 'compact' : width < 1024 ? 'medium' : width < 1600 ? 'expanded' : 'large';
  return {
    size,
    width,
    height,
    wide: size !== 'compact',
    /** Side-by-side panes (list+detail, chat+estimate) from laptop width up. */
    split: size === 'expanded' || size === 'large',
    scale: size === 'large' ? 1.25 : 1,
  };
}
