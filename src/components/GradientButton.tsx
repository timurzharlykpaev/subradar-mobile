import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeLinearGradient as LinearGradient } from './SafeLinearGradient';
import { fonts } from '../theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  colors?: [string, string];
  icon?: React.ReactNode;
}

export function GradientButton({
  title,
  onPress,
  loading,
  disabled,
  style,
  textStyle,
  colors = ['#6C47FF', '#9B7AFF'],
  icon,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[disabled && { opacity: 0.5 }]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.button, style ?? {}]}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            {icon}
            <Text style={[styles.text, textStyle]}>{title}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  text: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#FFF',
    letterSpacing: 0.2,
  },
});
