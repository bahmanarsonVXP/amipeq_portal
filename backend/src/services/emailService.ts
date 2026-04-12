import nodemailer from 'nodemailer';
import { config } from '../lib/config';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

export async function sendEmail(options: EmailOptions) {
  return transporter.sendMail({
    from: `"AMIPEQ" <${config.smtp.user}>`,
    ...options,
  });
}
