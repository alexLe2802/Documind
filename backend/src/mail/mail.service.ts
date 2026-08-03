import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export type SendMailInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

@Injectable()
export class MailService {
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
    } catch {
      throw new ServiceUnavailableException('Email delivery failed');
    }
  }
}
