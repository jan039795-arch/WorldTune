import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { theme } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textDim,
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Radio',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◉</Text>,
        }}
      />
      <Tabs.Screen
        name="top"
        options={{
          title: 'Top 10',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>▲</Text>,
        }}
      />
      <Tabs.Screen
        name="tv"
        options={{
          title: 'Televisión',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>▭</Text>,
        }}
      />
      <Tabs.Screen
        name="favoritos"
        options={{
          title: 'Favoritos',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>★</Text>,
        }}
      />
    </Tabs>
  );
}
