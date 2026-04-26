/**
 * Local Notifications — scheduled offline reminders for upcoming payments.
 * Works without internet. Called after subscriptions are loaded/updated.
 */
import * as Notifications from 'expo-notifications';
import i18n from '../i18n';
import { Subscription } from '../types';
import { parseBackendDate } from './formatters';

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

      const payDate = parseBackendDate(sub.nextPaymentDate);
      if (!payDate) continue;

      const reminderDays = (sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0)
        ? sub.reminderDaysBefore
        : [1, 3]; // default fallback

      for (const daysBefore of reminderDays) {
        const triggerDate = new Date(payDate);
        triggerDate.setDate(triggerDate.getDate() - daysBefore);
        triggerDate.setHours(9, 0, 0, 0); // 9:00 AM

        if (triggerDate <= now) continue;

        const title = i18n.t('localPush.payment.title', { name: sub.name });
        const body =
          daysBefore === 1
            ? i18n.t('localPush.payment.body_tomorrow', {
                amount: sub.amount,
                currency: sub.currency,
              })
            : i18n.t('localPush.payment.body_in_days', {
                days: daysBefore,
                amount: sub.amount,
                currency: sub.currency,
              });

        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
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
