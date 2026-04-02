import React, { useState } from 'react';
import { View, Text, Image, StyleProp, ViewStyle, TextStyle, ImageStyle, ActivityIndicator } from 'react-native';

interface SubIconProps {
  iconUrl?: string | null;
  name: string;
  imageStyle: StyleProp<ImageStyle>;
  placeholderStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  /** Primary color for loading indicator */
  primaryColor?: string;
}

export function SubIcon({ iconUrl, name, imageStyle, placeholderStyle, textStyle, primaryColor }: SubIconProps) {
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  if (iconUrl && !err) {
    return (
      <View>
        {/* Show placeholder letter while image loads */}
        {loading && (
          <View style={[placeholderStyle, { position: 'absolute' }]}>
            <Text style={textStyle}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        <Image
          source={{ uri: iconUrl }}
          style={[imageStyle, loading && { opacity: 0 }]}
          onLoad={() => setLoading(false)}
          onError={() => { setErr(true); setLoading(false); }}
        />
      </View>
    );
  }

  return (
    <View style={placeholderStyle}>
      <Text style={textStyle}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  );
}
