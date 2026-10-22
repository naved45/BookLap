import fs from 'fs';
import { config } from './config.js';
// No email provider is wired in. In development, messages go to an outbox file (never the console, since links carry tokens).
// In production without a provider, sending fails loudly instead of pretending.
export const outbox = [];
export async function sendMail({ to, subject, text }) {
  if (config.isProd) throw new Error('Email provider not configured');
  outbox.push({ to, subject, text });
  if (process.env.NODE_ENV !== 'test') fs.appendFileSync(new URL('../.dev-outbox.log', import.meta.url), `\n--- ${new Date().toISOString()} to ${to}: ${subject}\n${text}\n`);
  return { sent: false, devOutbox: true };
}
