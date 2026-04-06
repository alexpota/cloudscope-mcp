import { toolResult, type ToolResult } from './types.js';

export function handleGetCurrentDate(): ToolResult {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const today = pad(year, month + 1, now.getDate());

  const currentMonthStart = pad(year, month + 1, 1);
  const currentMonthEnd = pad(year, month + 1, daysInMonth(year, month));

  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1; // 0-indexed
  const prevMonthStart = pad(prevYear, prevMonth + 1, 1);
  const prevMonthEnd = pad(prevYear, prevMonth + 1, daysInMonth(prevYear, prevMonth));

  const lines: string[] = [];
  lines.push(`Today: ${today}`);
  lines.push('');
  lines.push(`Current month: ${currentMonthStart} to ${currentMonthEnd}`);
  lines.push(`Previous month: ${prevMonthStart} to ${prevMonthEnd}`);

  return toolResult(lines.join('\n'));
}

function daysInMonth(year: number, month: number): number {
  // month is 0-indexed; day 0 of next month = last day of this month
  return new Date(year, month + 1, 0).getDate();
}

function pad(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
