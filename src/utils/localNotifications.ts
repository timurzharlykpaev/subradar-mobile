/**
 * Local Notifications — scheduled offline reminders for upcoming payments.
 * Works without internet. Called after subscriptions are loaded/updated.
 */
import * as Notifications from 'expo-notifications';
import { Subscription } from '../types';
import { resolveNextPaymentDate } from './nextPaymentDate';

const CHANNEL_ID = 'payment-reminders';

export async function schedulePaymentReminders(
  subscriptions: Subscription[],
): Promise<void> {
  try {
    // Cancel all existing scheduled reminders
    await Notifications.cancelAllScheduledNotificationsAsync();

    const active = subscriptions.filter(
      (s) => s.status === 'ACTIVE' || s.status === 'TRIAL',
    );

    const now = new Date();

    for (const sub of active) {
      // Skip if reminders are explicitly disabled for this subscription
      if (sub.reminderEnabled === false) continue;

      const payDate = resolveNextPaymentDate(sub);
      if (!payDate) continue;

      const reminderDays = (sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0)
        ? sub.reminderDaysBefore
        : [1, 3]; // default fallback

      for (const daysBefore of reminderDays) {
        const triggerDate = new Date(payDate);
        triggerDate.setDate(triggerDate.getDate() - daysBefore);
        triggerDate.setHours(9, 0, 0, 0); // 9:00 AM

        if (triggerDate <= now) continue;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `💳 ${sub.name}`,
            body: daysBefore === 1
              ? `Payment tomorrow: ${sub.amount} ${sub.currency}`
              : `Payment in ${daysBefore} days: ${sub.amount} ${sub.currency}`,
            data: { subscriptionId: sub.id },
            sound: true,
          },
          trigger: { date: triggerDate } as any,
        });
      }
    }
  } catch (e) {
    // Silent — don't crash if notifications not permitted
  }
}
