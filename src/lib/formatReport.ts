import { DailyReport } from '../types';

export function formatDailyEmailText(
  orgName: string,
  reportDate: string,
  payload: DailyReport['report_payload']
): string {
  const formattedDate = new Date(reportDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const lines: string[] = [];
  lines.push('CloudBase Digital Feedback');
  lines.push('Daily Summary');
  lines.push(formattedDate);
  lines.push('');
  lines.push('Organization:');
  lines.push(orgName);
  lines.push('');
  lines.push('--------------------------------');
  lines.push('');
  lines.push('SUGGESTIONS');
  lines.push('');
  lines.push(`Total submissions: ${payload.total_suggestions}`);
  lines.push('');
  lines.push('Top repeated suggestions:');
  lines.push('');

  if (payload.top_suggestions.length === 0) {
    lines.push('None recorded today.');
  } else {
    payload.top_suggestions.slice(0, 5).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.text}`);
      lines.push(`   ${item.submissions_count} submissions`);
      lines.push(`   ${item.estimated_devices} estimated devices`);
      lines.push('');
    });
  }

  lines.push('--------------------------------');
  lines.push('');
  lines.push('COMPLAINTS');
  lines.push('');
  lines.push(`Total complaints: ${payload.total_complaints}`);
  lines.push('');

  const statusList = Object.entries(payload.complaints_status_counts);
  if (statusList.length > 0) {
    statusList.forEach(([status, count]) => {
      lines.push(`${status.padEnd(16, ' ')}: ${count}`);
    });
  } else {
    lines.push('New: 0');
    lines.push('Under Review: 0');
    lines.push('Resolved: 0');
  }

  lines.push('');
  lines.push('Recent complaints:');
  lines.push('');

  if (payload.recent_complaints.length === 0) {
    lines.push('• None recorded today');
  } else {
    payload.recent_complaints.forEach((c) => {
      lines.push(`• ${c}`);
    });
  }

  lines.push('');
  lines.push('--------------------------------');
  lines.push('');
  lines.push('View Operator Dashboard: /operator/dashboard');

  return lines.join('\n');
}
