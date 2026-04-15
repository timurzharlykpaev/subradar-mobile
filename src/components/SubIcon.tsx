import React, { useState } from 'react';
import { View, Text, Image, StyleProp, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { CategoryIcon } from './icons';

interface SubIconProps {
  iconUrl?: string | null;
  name: string;
  imageStyle: StyleProp<ImageStyle>;
  placeholderStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  /** When set, placeholder shows CategoryIcon instead of first letter */
  category?: string | null;
  /** Size for CategoryIcon fallback — defaults to 22 */
  categoryIconSize?: number;
  /** Primary color for loading indicator */
  primaryColor?: string;
}

function Placeholder({ category, categoryIconSize, name, placeholderStyle, textStyle, extraStyle }: {
  category?: string | null;
  categoryIconSize?: number;
  name: string;
  placeholderStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  extraStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[placeholderStyle, extraStyle]}>
      {category ? (
        <CategoryIcon category={category} size={categoryIconSize ?? 22} />
      ) : (
        <Text style={textStyle}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
      )}
    </View>
  );
}

export function SubIcon({ iconUrl, name, imageStyle, placeholderStyle, textStyle, category, categoryIconSize }: SubIconProps) {
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  if (iconUrl && !err) {
    return (
      <View>
        {loading && (
          <Placeholder
            category={category}
            categoryIconSize={categoryIconSize}
            name={name}
            placeholderStyle={placeholderStyle}
            textStyle={textStyle}
            extraStyle={{ position: 'absolute' }}
          />
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
    <Placeholder
      category={category}
      categoryIconSize={categoryIconSize}
      name={name}
      placeholderStyle={placeholderStyle}
      textStyle={textStyle}
    />
  );
}
