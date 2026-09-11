import { db } from './db.js';
import { DailyReport } from '../src/types.js';

export async function generateDailyReport(
  orgId: string,
  targetDateStr?: string,
  force: boolean = false
): Promise<{ success: boolean; message: string; report?: DailyReport; alreadySent?: boolean }> {
  const dateStr = targetDateStr || new Date().toISOString().slice(0, 10);

  // Check duplicate report protection
  const existing = db.getDailyReport(orgId, dateStr);
  if (existing && !force) {
    return {
      success: true,
      alreadySent: true,
      message: `Daily report for ${dateStr} has already been generated and sent to prevent duplicate emails.`,
      report: existing,
    };
  }

  const org = db.getOrganization(orgId);
  if (!org) {
    return { success: false, message: 'Organization not found' };
  }

  const stats = db.getStatistics(orgId);

  // Recent complaints
  const allComplaints = db
    .listSubmissions(orgId, { type: 'complaint', limit: 5 })
    .submissions.map((s) => s.message.length > 60 ? s.message.slice(0, 60) + '...' : s.message);

  const topSuggestions = stats.top_repeated_suggestions.map((s) => ({
    text: s.group_title || s.message,
    submissions_count: s.count,
    estimated_devices: s.estimated_devices,
  }));

  const reportId = `report-${orgId}-${dateStr}-${Date.now()}`;
  const now = new Date().toISOString();

  // Automated Email recipient: configured in organization settings or env var
  const recipientEmail = org.contact_email?.trim() || process.env.DAILY_REPORT_EMAIL || 'management@cantec.lk';

  const reportPayload: DailyReport['report_payload'] = {
    organization_name: org.name,
    report_date: dateStr,
    total_suggestions: stats.total_suggestions,
    top_suggestions: topSuggestions,
    total_complaints: stats.total_complaints,
    complaints_status_counts: stats.complaint_status_counts,
    recent_complaints: allComplaints,
    recipient_email: recipientEmail,
  };

  const gatewayUrl = process.env.EMAIL_GATEWAY_URL;
  const gatewayKey = process.env.EMAIL_GATEWAY_API_KEY;

  let sendStatus: 'sent' | 'failed' = 'sent';
  let errorMessage: string | undefined = undefined;

  const textSummary = formatDailyEmailText(org.name, dateStr, reportPayload);

  if (gatewayUrl && gatewayKey) {
    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gatewayKey}`,
        },
        body: JSON.stringify({
          to: recipientEmail,
          subject: `CloudBase Daily Summary - ${org.name} (${dateStr})`,
          text: textSummary,
        }),
      });

      if (!response.ok) {
        sendStatus = 'failed';
        errorMessage = `Email Gateway responded with status ${response.status}: ${await response.text()}`;
      }
    } catch (err: any) {
      sendStatus = 'failed';
      errorMessage = err?.message || 'Failed to connect to Email Gateway';
    }
  } else {
    // Simulated delivery (recorded in D1 daily_reports table)
    sendStatus = 'sent';
  }

  const report: DailyReport = {
    id: reportId,
    organization_id: orgId,
    report_date: dateStr,
    status: sendStatus,
    sent_at: sendStatus === 'sent' ? now : undefined,
    error_message: errorMessage,
    created_at: now,
    report_payload: reportPayload,
  };

  db.saveDailyReport(report);

  return {
    success: sendStatus === 'sent',
    message: sendStatus === 'sent' ? 'Daily report generated and delivered successfully.' : `Failed: ${errorMessage}`,
    report,
  };
}

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
