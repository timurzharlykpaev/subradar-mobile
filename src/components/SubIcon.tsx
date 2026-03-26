import React, { useState } from 'react';
import { View, Text, Image, StyleProp, ViewStyle, TextStyle, ImageStyle } from 'react-native';

interface SubIconProps {
  iconUrl?: string | null;
  name: string;
  imageStyle: StyleProp<ImageStyle>;
  placeholderStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}

export function SubIcon({ iconUrl, name, imageStyle, placeholderStyle, textStyle }: SubIconProps) {
  const [err, setErr] = useState(false);

  if (iconUrl && !err) {
    return <Image source={{ uri: iconUrl }} style={imageStyle} onError={() => setErr(true)} />;
  }

  return (
    <View style={placeholderStyle}>
      <Text style={textStyle}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  );
}
