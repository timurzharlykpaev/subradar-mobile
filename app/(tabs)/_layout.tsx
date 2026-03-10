import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AddSubscriptionSheet } from '../../src/components/AddSubscriptionSheet';
import { COLORS } from '../../src/constants';

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)}
      size={24}
      color={focused ? COLORS.primary : COLORS.textMuted}
    />
  );
}

export default function TabsLayout() {
  const [sheetVisible, setSheetVisible] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: true,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.home'),
            tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="subscriptions"
          options={{
            title: t('tabs.subs'),
            tabBarIcon: ({ focused }) => <TabIcon name="layers" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarButton: () => (
              <TouchableOpacity
                onPress={() => setSheetVisible(true)}
                style={styles.addBtnWrapper}
              >
                <View style={styles.addBtn}>
                  <Ionicons name="add" size={28} color="#FFF" />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: t('tabs.analytics'),
            tabBarIcon: ({ focused }) => <TabIcon name="bar-chart" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
          }}
        />
      </Tabs>

      <AddSubscriptionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0F0F1A',
    borderTopWidth: 0,
    height: 84,
    paddingBottom: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  addBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  addBtnWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
