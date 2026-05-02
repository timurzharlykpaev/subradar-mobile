import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface ExportSub {
  name: string;
  amount: number;
  currency: string;
  billingPeriod: string;
  category: string;
  status: string;
  nextPaymentDate?: string;
  startDate?: string;
  currentPlan?: string;
}

function escapeCsv(val: string): string {
  // Escape per RFC 4180: any field containing a comma, quote, CR, or LF
  // gets wrapped in quotes with internal quotes doubled. Previously we
  // only checked for `\n`, so values with `\r\n` slipped through and
  // produced corrupted CSV that Excel read as multiple rows.
  if (/[",\r\n]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function exportSubscriptionsCsv(subscriptions: ExportSub[]): Promise<void> {
  if (!subscriptions || subscriptions.length === 0) {
    throw new Error('No subscriptions to export');
  }

  const headers = ['Name', 'Amount', 'Currency', 'Period', 'Category', 'Status', 'Next Payment', 'Start Date', 'Plan'];

  const rows = subscriptions.map(s => [
    escapeCsv(s.name ?? ''),
    String(s.amount ?? 0),
    s.currency ?? '',
    s.billingPeriod ?? '',
    s.category || '',
    s.status ?? '',
    s.nextPaymentDate || '',
    s.startDate || '',
    s.currentPlan || '',
  ].join(','));

  // CRLF line endings — Excel on Windows requires CRLF; macOS/Linux
  // tolerate it. Prepend a UTF-8 BOM so Excel doesn't mojibake non-ASCII
  // service names (Cyrillic, CJK).
  const BOM = '﻿';
  const csv = BOM + [headers.join(','), ...rows].join('\r\n');

  const fileName = `subradar-subscriptions-${new Date().toISOString().split('T')[0]}.csv`;
  const filePath = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });

  // `isAvailableAsync` returns false on iOS Simulator and on Android
  // builds without a share-capable target. Throw a descriptive error so
  // the UI layer can show "Sharing not available on this device" instead
  // of silently swallowing the request.
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(filePath, {
    mimeType: 'text/csv',
    dialogTitle: 'Export Subscriptions',
    UTI: 'public.comma-separated-values-text',
  });
}
