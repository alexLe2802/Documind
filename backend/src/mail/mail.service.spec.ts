import { getSmtpErrorDetails } from './mail.service';

describe('getSmtpErrorDetails', () => {
  it('keeps SMTP diagnostics without serializing credentials', () => {
    const details = getSmtpErrorDetails({
      code: 'EAUTH',
      command: 'AUTH PLAIN',
      responseCode: 535,
      response: '535 Authentication failed',
      message: 'Invalid login',
      password: 're_secret',
    });

    expect(details).toEqual({
      code: 'EAUTH',
      command: 'AUTH PLAIN',
      responseCode: 535,
      response: '535 Authentication failed',
      message: 'Invalid login',
    });
    expect(JSON.stringify(details)).not.toContain('re_secret');
  });

  it('handles non-object errors safely', () => {
    expect(getSmtpErrorDetails('connection failed')).toEqual({
      message: 'connection failed',
    });
  });
});
