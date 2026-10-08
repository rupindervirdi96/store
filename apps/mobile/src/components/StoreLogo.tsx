import { StyleSheet, Text, View } from 'react-native';
import { store } from '../config/store';
import { colors } from '../theme';

/** Brand mark + store name, used as the Shop header title. */
export function StoreLogo() {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={store.name}>
      <View style={styles.badge}>
        <Text style={{ fontSize: 16 }}>🔥</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {store.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 19, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
});
