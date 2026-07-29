import { ModerationScannerService } from './moderation-scanner.service';

describe('ModerationScannerService', () => {
  const originalKeywords = process.env.MODERATION_KEYWORDS;

  afterEach(() => {
    if (originalKeywords === undefined) delete process.env.MODERATION_KEYWORDS;
    else process.env.MODERATION_KEYWORDS = originalKeywords;
  });

  it('flags matching text case-insensitively without rejecting it', () => {
    process.env.MODERATION_KEYWORDS = 'Sensitive Phrase,another';
    const result = new ModerationScannerService().scan(
      'Academic discussion of a SENSITIVE PHRASE in context.',
    );
    expect(result.flag).toBe('FLAGGED');
    expect(result.priority).toBe(0);
    expect(result.matchedKeywords).toEqual(['Sensitive Phrase']);
    expect(result.matchedContexts[0].excerpt).toContain('SENSITIVE PHRASE');
  });

  it('marks unreadable or empty content for manual review', () => {
    expect(new ModerationScannerService().scan('')).toEqual({
      flag: 'SCAN_FAILED',
      priority: 1,
      matchedKeywords: [],
      matchedContexts: [],
    });
  });

  it('keeps readable content with no matches normal', () => {
    process.env.MODERATION_KEYWORDS = 'blocked';
    const result = new ModerationScannerService().scan(
      'Ordinary lecture notes',
    );
    expect(result.flag).toBe('NORMAL');
    expect(result.priority).toBe(2);
  });
});
