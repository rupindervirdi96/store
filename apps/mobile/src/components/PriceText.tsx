import { Text, View } from 'react-native';
import { formatPrice } from '../lib/format';
import { colors } from '../theme';

/** Price with the original price struck through when the item is on offer. */
export function PriceText({ price, compareAtPrice, size = 15 }: { price: number; compareAtPrice: number | null; size?: number }) {
  const onSale = compareAtPrice != null && compareAtPrice > price;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
      <Text style={{ fontSize: size, fontWeight: '700', color: onSale ? colors.brandDark : colors.text }}>
        {formatPrice(price)}
      </Text>
      {onSale && (
        <Text style={{ fontSize: size * 0.8, color: colors.muted, textDecorationLine: 'line-through' }}>
          {formatPrice(compareAtPrice)}
        </Text>
      )}
    </View>
  );
}
