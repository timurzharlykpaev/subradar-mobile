import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { AddSubscriptionSheet } from '../../src/components/AddSubscriptionSheet';
import { COLORS } from '../../src/constants';

function TabIcon({ name, focused }: { name: React.ComponentProps<typeof Ionicons>['name']; focused: boolean }) {
  return (
    <Ionicons
      name={name}
      size={22}
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
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="subscriptions"
          options={{
            title: t('tabs.subs'),
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'layers' : 'layers-outline'} focused={focused} />
            ),
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
                  <Ionicons name="add" size={30} color="#FFF" />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: t('tabs.analytics'),
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} />
            ),
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
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 84,
    paddingBottom: 20,
    paddingTop: 8,
    overflow: 'visible',
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  addBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  addBtnWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    overflow: 'visible',
  },
});
