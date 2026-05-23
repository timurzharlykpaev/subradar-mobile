import { Dimensions, useWindowDimensions } from 'react-native';

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

const MIN_SCALE_FACTOR = 0.85;
const MAX_SCALE_FACTOR = 1.0;

const SMALL_SCREEN_WIDTH = 380;
const SHORT_SCREEN_HEIGHT = 700;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function widthFactor(width: number): number {
  return clamp(width / BASE_WIDTH, MIN_SCALE_FACTOR, MAX_SCALE_FACTOR);
}

function heightFactor(height: number): number {
  return clamp(height / BASE_HEIGHT, MIN_SCALE_FACTOR, MAX_SCALE_FACTOR);
}

export function scaleWith(width: number, size: number): number {
  return Math.round(size * widthFactor(width));
}

export function verticalScaleWith(height: number, size: number): number {
  return Math.round(size * heightFactor(height));
}

export function moderateScaleWith(
  width: number,
  size: number,
  factor = 0.5,
): number {
  return Math.round(size + (scaleWith(width, size) - size) * factor);
}

export function moderateVerticalScaleWith(
  height: number,
  size: number,
  factor = 0.5,
): number {
  return Math.round(size + (verticalScaleWith(height, size) - size) * factor);
}

const initial = Dimensions.get('window');

export const scale = (size: number) => scaleWith(initial.width, size);
export const verticalScale = (size: number) =>
  verticalScaleWith(initial.height, size);
export const moderateScale = (size: number, factor = 0.5) =>
  moderateScaleWith(initial.width, size, factor);
export const moderateVerticalScale = (size: number, factor = 0.5) =>
  moderateVerticalScaleWith(initial.height, size, factor);

export const ms = (size: number) => moderateScale(size, 0.5);
export const mvs = (size: number) => moderateVerticalScale(size, 0.5);

export const wp = (percent: number) => (initial.width * percent) / 100;
export const hp = (percent: number) => (initial.height * percent) / 100;

export const isSmallScreen = initial.width < SMALL_SCREEN_WIDTH;
export const isShortScreen = initial.height < SHORT_SCREEN_HEIGHT;

export type ScreenSize = 'small' | 'medium' | 'large';

export const screenSize: ScreenSize =
  initial.width < SMALL_SCREEN_WIDTH
    ? 'small'
    : initial.width >= BASE_WIDTH
      ? 'large'
      : 'medium';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    scale: (size: number) => scaleWith(width, size),
    verticalScale: (size: number) => verticalScaleWith(height, size),
    moderateScale: (size: number, factor = 0.5) =>
      moderateScaleWith(width, size, factor),
    moderateVerticalScale: (size: number, factor = 0.5) =>
      moderateVerticalScaleWith(height, size, factor),
    ms: (size: number) => moderateScaleWith(width, size, 0.5),
    mvs: (size: number) => moderateVerticalScaleWith(height, size, 0.5),
    wp: (percent: number) => (width * percent) / 100,
    hp: (percent: number) => (height * percent) / 100,
    isSmallScreen: width < SMALL_SCREEN_WIDTH,
    isShortScreen: height < SHORT_SCREEN_HEIGHT,
    screenSize: (width < SMALL_SCREEN_WIDTH
      ? 'small'
      : width >= BASE_WIDTH
        ? 'large'
        : 'medium') as ScreenSize,
  };
}
