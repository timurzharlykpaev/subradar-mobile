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
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function exportSubscriptionsCsv(subscriptions: ExportSub[]): Promise<void> {
  const headers = ['Name', 'Amount', 'Currency', 'Period', 'Category', 'Status', 'Next Payment', 'Start Date', 'Plan'];

  const rows = subscriptions.map(s => [
    escapeCsv(s.name),
    String(s.amount),
    s.currency,
    s.billingPeriod,
    s.category || '',
    s.status,
    s.nextPaymentDate || '',
    s.startDate || '',
    s.currentPlan || '',
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  const fileName = `subradar-subscriptions-${new Date().toISOString().split('T')[0]}.csv`;
  const filePath = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Subscriptions',
      UTI: 'public.comma-separated-values-text',
    });
  }
}
