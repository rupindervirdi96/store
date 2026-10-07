import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform, Text } from 'react-native';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { EditItemScreen } from '../screens/EditItemScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useAuth } from '../store/auth';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const ICONS: Record<keyof TabParamList, string> = { Orders: '🧾', Menu: '🍔', Categories: '🗂️', Settings: '⚙️' };

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.brand,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{ICONS[route.name]}</Text>,
        headerTitleStyle: { fontWeight: '800' },
        headerStyle: { backgroundColor: '#fff' },
      })}
    >
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: 'Live orders' }} />
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

/** Tapping a "new order" notification opens that order. */
function useOrderNotificationLinks(enabled: boolean) {
  const last = Platform.OS === 'web' ? null : Notifications.useLastNotificationResponse();
  useEffect(() => {
    const orderId = last?.notification.request.content.data?.orderId;
    if (enabled && typeof orderId === 'string' && navigationRef.isReady()) {
      navigationRef.navigate('OrderDetail', { id: orderId });
    }
  }, [last, enabled]);
}

export function RootNavigator() {
  const token = useAuth((s) => s.token);
  useOrderNotificationLinks(!!token);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.brand, background: colors.bg } }}
    >
      <Stack.Navigator>
        {!token ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{ presentation: 'modal', title: 'Order' }}
            />
            <Stack.Screen name="EditItem" component={EditItemScreen} options={{ title: 'Menu item' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
