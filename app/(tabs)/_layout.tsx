import React, { useRef, useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, InteractionManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { AddSubscriptionSheet } from '../../src/components/AddSubscriptionSheet';
import { COLORS } from '../../src/constants';
import { useTheme } from '../../src/theme';
import { useUIStore } from '../../src/stores/uiStore';

function TabIcon({ name, focused }: { name: React.ComponentProps<typeof Ionicons>['name']; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={22}
      color={focused ? colors.primary : colors.textMuted}
    />
  );
}

export default function TabsLayout() {
  const { addSheetVisible, openAddSheet, closeAddSheet } = useUIStore();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  // Pre-mount AddSubscriptionSheet after tab interactions settle (~500ms after load).
  // This eliminates the 1-2s delay on first open (heavy component: 800+ lines, many hooks).
  // Sheet is rendered hidden until user opens it; once mounted stays in tree.
  const [sheetMounted, setSheetMounted] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => setSheetMounted(true), 500);
    });
    return () => task.cancel();
  }, []);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: [styles.tabBar, {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          }],
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
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
                onPress={() => openAddSheet()}
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
          name="workspace"
          options={{
            title: t('tabs.workspace', 'Команда'),
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} />
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

      {sheetMounted && (
        <AddSubscriptionSheet
          visible={addSheetVisible}
          onClose={() => closeAddSheet()}
        />
      )}
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
