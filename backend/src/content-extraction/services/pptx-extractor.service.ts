import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';

@Injectable()
export class PptxExtractorService {
  async extract(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.values(zip.files)
      .filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file.name))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      );
    const slideTexts = await Promise.all(
      slideFiles.map(async (file) =>
        this.extractSlideText(
          await file.async('text'),
          this.slideNumber(file.name),
        ),
      ),
    );

    return this.normalize(slideTexts.join('\n\n'));
  }

  private extractSlideText(xml: string, slideNumber: number): string {
    const parts = [`[SLIDE: ${slideNumber}]`];
    const tableXmlBlocks = this.extractBlocks(xml, 'a:tbl');
    const textWithoutTables = tableXmlBlocks.reduce(
      (current, tableXml) => current.replace(tableXml, ' '),
      xml,
    );
    const textLines = this.extractTextNodes(textWithoutTables);

    if (textLines.length > 0) {
      parts.push(`[TITLE: ${textLines[0]}]`);
      parts.push(...textLines);
    }

    tableXmlBlocks.forEach((tableXml, index) => {
      const rows = this.extractTableRows(tableXml);
      if (rows.length > 0) {
        parts.push(`[TABLE: Slide ${slideNumber} Table ${index + 1}]`);
        parts.push(...rows);
      }
    });

    return parts.join('\n');
  }

  private extractTableRows(tableXml: string): string[] {
    return this.extractBlocks(tableXml, 'a:tr')
      .map((rowXml) =>
        this.extractBlocks(rowXml, 'a:tc')
          .map((cellXml) => this.extractTextNodes(cellXml).join(' '))
          .map((cellText) => this.normalizeCell(cellText))
          .filter(Boolean)
          .join(' | '),
      )
      .filter(Boolean);
  }

  private extractBlocks(xml: string, tagName: string): string[] {
    const blocks: string[] = [];
    let index = 0;

    while (index < xml.length) {
      const start = xml.indexOf(`<${tagName}`, index);
      if (start < 0) {
        break;
      }

      const end = this.findMatchingClose(xml, tagName, start);
      if (end < 0) {
        break;
      }

      const closeTag = `</${tagName}>`;
      blocks.push(xml.slice(start, end + closeTag.length));
      index = end + closeTag.length;
    }

    return blocks;
  }

  private findMatchingClose(
    xml: string,
    tagName: string,
    start: number,
  ): number {
    const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'g');
    tagPattern.lastIndex = start;
    let depth = 0;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(xml)) !== null) {
      if (match[0].startsWith(`</${tagName}`)) {
        depth -= 1;
        if (depth === 0) {
          return match.index;
        }
      } else if (!match[0].endsWith('/>')) {
        depth += 1;
      }
    }

    return -1;
  }

  private slideNumber(fileName: string): number {
    return Number(/slide(\d+)\.xml$/.exec(fileName)?.[1] ?? '1');
  }

  private extractTextNodes(xml: string): string[] {
    return [
      ...xml.matchAll(/<(?:[A-Za-z0-9_]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/g),
    ]
      .map((match) =>
        this.normalizeCell(this.stripXmlTags(this.decodeXml(match[1]))),
      )
      .filter(Boolean);
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  private normalize(text: string): string {
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private normalizeCell(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private stripXmlTags(value: string): string {
    return value.replace(/<[^>]+>/g, ' ');
  }
}
