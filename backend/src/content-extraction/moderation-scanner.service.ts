import { Injectable } from '@nestjs/common';

export type ModerationScanResult = {
  flag: 'NORMAL' | 'FLAGGED' | 'SCAN_FAILED';
  priority: number;
  matchedKeywords: string[];
  matchedContexts: Array<{ keyword: string; excerpt: string }>;
};

const DEFAULT_KEYWORDS = ['gian lận', 'ma túy', 'bạo lực', 'malware', 'crack'];

@Injectable()
export class ModerationScannerService {
  private readonly keywords = this.loadKeywords();

  scan(extractedText: string | null | undefined): ModerationScanResult {
    const text = extractedText?.trim();
    if (!text) {
      return {
        flag: 'SCAN_FAILED',
        priority: 1,
        matchedKeywords: [],
        matchedContexts: [],
      };
    }

    const normalized = text.toLocaleLowerCase('vi');
    const matchedKeywords = this.keywords.filter((keyword) =>
      normalized.includes(keyword.toLocaleLowerCase('vi')),
    );
    const matchedContexts = matchedKeywords.map((keyword) => {
      const index = normalized.indexOf(keyword.toLocaleLowerCase('vi'));
      const start = Math.max(0, index - 120);
      const end = Math.min(text.length, index + keyword.length + 120);
      return { keyword, excerpt: text.slice(start, end).trim() };
    });

    return {
      flag: matchedKeywords.length ? 'FLAGGED' : 'NORMAL',
      priority: matchedKeywords.length ? 0 : 2,
      matchedKeywords,
      matchedContexts,
    };
  }

  private loadKeywords(): string[] {
    const configured = process.env.MODERATION_KEYWORDS?.split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    return [...new Set(configured?.length ? configured : DEFAULT_KEYWORDS)];
  }
}
