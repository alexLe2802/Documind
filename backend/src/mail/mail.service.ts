import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export type SendMailInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

type SmtpErrorDetails = {
  code?: string;
  command?: string;
  responseCode?: number;
  response?: string;
  message: string;
};

export function getSmtpErrorDetails(error: unknown): SmtpErrorDetails {
  if (typeof error !== 'object' || error === null) {
    return { message: String(error) };
  }

  const smtpError = error as Record<string, unknown>;
  return {
    ...(typeof smtpError.code === 'string' && { code: smtpError.code }),
    ...(typeof smtpError.command === 'string' && {
      command: smtpError.command,
    }),
    ...(typeof smtpError.responseCode === 'number' && {
      responseCode: smtpError.responseCode,
    }),
    ...(typeof smtpError.response === 'string' && {
      response: smtpError.response,
    }),
    message:
      typeof smtpError.message === 'string'
        ? smtpError.message
        : 'Unknown SMTP error',
  };
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;

  constructor(private readonly config: ConfigService) {
    if (!this.config.get<boolean>('SMTP_ENABLED')) return;

    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: this.config.getOrThrow<number>('SMTP_PORT'),
      secure: this.config.getOrThrow<boolean>('SMTP_SECURE'),
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
      },
    });
  }

  async send(input: SendMailInput): Promise<void> {
    if (!this.transporter) {
      throw new ServiceUnavailableException('Email delivery is not configured');
    }

    try {
      await this.transporter.sendMail(input);
    } catch (error) {
      this.logger.error(
        `SMTP delivery failed: ${JSON.stringify(getSmtpErrorDetails(error))}`,
      );
      throw new ServiceUnavailableException('Email delivery failed');
    }
  }
}
