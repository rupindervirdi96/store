import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { cartCount, useCart } from '../store/cart';
import { colors } from '../theme';
import { AccountScreen } from '../screens/AccountScreen';
import { CartScreen } from '../screens/CartScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { LoginScreen, RegisterScreen } from '../screens/AuthScreens';
import { OrdersScreen } from '../screens/OrdersScreen';
import { OrderTrackingScreen } from '../screens/OrderTrackingScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { ShopScreen } from '../screens/ShopScreen';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const TAB_ICONS: Record<keyof TabParamList, string> = { Shop: '🛍️', Cart: '🛒', Orders: '📦', Account: '👤' };

function Tabs() {
  const count = useCart((s) => cartCount(s.items));
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.brand,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{TAB_ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Shop" component={ShopScreen} />
      <Tab.Screen name="Cart" component={CartScreen} options={{ tabBarBadge: count > 0 ? count : undefined }} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

/** Opens the tracking screen when the user taps an order push notification. */
function useNotificationDeepLinks() {
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const orderId = lastResponse?.notification.request.content.data?.orderId;
    if (typeof orderId === 'string' && navigationRef.isReady()) {
      navigationRef.navigate('OrderTracking', { id: orderId });
    }
  }, [lastResponse]);
}

export function RootNavigator() {
  useNotificationDeepLinks();
  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.brand, background: colors.bg } }}
    >
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreen}
          options={({ route }) => ({ title: route.params.title ?? 'Product' })}
        />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ title: 'Track order' }} />
        <Stack.Group screenOptions={{ presentation: 'modal' }}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
