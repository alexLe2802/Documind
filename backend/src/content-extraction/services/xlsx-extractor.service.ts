import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';

@Injectable()
export class XlsxExtractorService {
  async extract(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const sharedStrings = await this.extractSharedStrings(zip);
    const sheetNames = await this.extractSheetNames(zip);
    const worksheetTexts = await this.extractWorksheets(zip, sharedStrings, sheetNames);
    const normalizedWorksheetText = this.normalize(worksheetTexts.join('\n\n'));

    return normalizedWorksheetText || this.extractArchiveReadableText(zip);
  }

  private async extractSharedStrings(zip: JSZip): Promise<string[]> {
    const sharedStringsFile = zip.file('xl/sharedStrings.xml');

    if (!sharedStringsFile) {
      return [];
    }

    const xml = await sharedStringsFile.async('text');
    const items = [
      ...xml.matchAll(
        /<(?:[A-Za-z0-9_]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?si>/g,
      ),
    ].map((match) =>
      this.normalizeCell(this.extractTextNodes(match[1]).join(' ')),
    );

    return items.length > 0 ? items : this.extractTextNodes(xml);
  }

  private async extractSheetNames(zip: JSZip): Promise<string[]> {
    const workbook = await zip.file('xl/workbook.xml')?.async('text');
    if (!workbook) {
      return [];
    }

    return [
      ...workbook.matchAll(
        /<(?:[A-Za-z0-9_]+:)?sheet\b[^>]*\bname=(["'])(.*?)\1/g,
      ),
    ].map((match) => this.decodeXml(match[2]));
  }

  private async extractWorksheets(
    zip: JSZip,
    sharedStrings: string[],
    sheetNames: string[],
  ): Promise<string[]> {
    const worksheetFiles = Object.values(zip.files)
      .filter((file) => /^xl\/worksheets\/[^/]+\.xml$/.test(file.name))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      );

    const worksheetTexts = await Promise.all(
      worksheetFiles.map(async (file, index) =>
        this.formatWorksheet(
          await file.async('text'),
          sheetNames[index] ?? `Sheet ${index + 1}`,
          sharedStrings,
        ),
      ),
    );

    const parsedWorksheets = worksheetTexts.filter(Boolean);
    if (parsedWorksheets.length > 0) {
      return parsedWorksheets;
    }

    return this.extractFallbackWorksheetText(zip, sharedStrings);
  }

  private formatWorksheet(
    xml: string,
    sheetName: string,
    sharedStrings: string[],
  ): string {
    const rows = [
      ...xml.matchAll(
        /<(?:[A-Za-z0-9_]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?row>/g,
      ),
    ]
      .map((match, index) => ({
        number: Number(this.attr(match[1], 'r') ?? index + 1),
        cells: this.extractCells(match[2], sharedStrings),
      }))
      .filter((row) => row.cells.some(Boolean));

    if (rows.length === 0) {
      return '';
    }

    const lines = [`[SHEET: ${sheetName}]`];
    for (const row of rows) {
      lines.push(`[ROW: ${row.number}] ${row.cells.join(' | ')}`);
    }

    return lines.join('\n');
  }

  private extractCells(rowXml: string, sharedStrings: string[]): string[] {
    return [
      ...rowXml.matchAll(
        /<(?:[A-Za-z0-9_]+:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?c>/g,
      ),
    ].map((match) => {
      const attrs = match[1];
      const cellXml = match[2];
      const type = this.attr(attrs, 't');
      const formula = this.decodeXml(
        this.tagText(cellXml, 'f') ?? '',
      );
      let value: string;

      if (type === 's') {
        const index = Number(this.tagText(cellXml, 'v') ?? -1);
        value = this.normalizeCell(sharedStrings[index] ?? '');
      } else if (type === 'inlineStr' || type === 'str') {
        value = this.normalizeCell(
          this.extractTextNodes(cellXml).join(' ') ||
            this.decodeXml(this.tagText(cellXml, 'v') ?? ''),
        );
      } else {
        value = this.normalizeCell(
          this.decodeXml(this.tagText(cellXml, 'v') ?? ''),
        );
      }

      const renderedValue = value || '[blank]';
      return formula ? `${renderedValue} (formula: ${formula})` : renderedValue;
    });
  }

  private async extractFallbackWorksheetText(
    zip: JSZip,
    sharedStrings: string[],
  ): Promise<string[]> {
    const worksheetFiles = Object.values(zip.files).filter((file) =>
      /^xl\/worksheets\/[^/]+\.xml$/.test(file.name),
    );
    const chunks: string[] = [];

    if (sharedStrings.length > 0) {
      chunks.push(`[SHARED_STRINGS]\n${sharedStrings.join('\n')}`);
    }

    for (const [index, file] of worksheetFiles.entries()) {
      const xml = await file.async('text');
      const textNodes = this.extractTextNodes(xml);
      const values = [
        ...xml.matchAll(
          /<(?:[A-Za-z0-9_]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?v>/g,
        ),
      ].map((match) => this.decodeXml(match[1]));
      const content = [...textNodes, ...values]
        .map((value) => this.normalizeCell(value))
        .filter(Boolean)
        .join('\n');

      if (content) {
        chunks.push(`[SHEET: Sheet ${index + 1}]\n${content}`);
      }
    }

    return chunks;
  }

  private extractTextNodes(xml: string): string[] {
    return [
      ...xml.matchAll(/<(?:[A-Za-z0-9_]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/g),
    ].map((match) => this.decodeXml(match[1]));
  }

  private async extractArchiveReadableText(zip: JSZip): Promise<string> {
    const files = Object.values(zip.files)
      .filter((file) => !file.dir && this.isReadableOfficeXml(file.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const chunks: string[] = [];
    for (const file of files) {
      const xml = await file.async('text');
      const textNodes = this.extractTextNodes(xml);
      const values = [
        ...xml.matchAll(
          /<(?:[A-Za-z0-9_]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?v>/g,
        ),
      ].map((match) => this.decodeXml(match[1]));
      const visibleText = [...textNodes, ...values]
        .map((value) => this.normalizeCell(this.stripXmlTags(value)))
        .filter((value) => this.isUsefulFallbackText(value));

      if (visibleText.length > 0) {
        chunks.push(`[FILE: ${file.name}]\n${[...new Set(visibleText)].join('\n')}`);
      }
    }

    return this.normalize(chunks.join('\n\n'));
  }

  private isReadableOfficeXml(fileName: string): boolean {
    return (
      /^xl\/(?:worksheets|drawings|comments|tables|charts|pivotTables|sharedStrings)\/?.*\.xml$/.test(
        fileName,
      ) || /^docProps\/(?:core|app)\.xml$/.test(fileName)
    );
  }

  private isUsefulFallbackText(value: string): boolean {
    if (!/[A-Za-z0-9\p{L}]/u.test(value)) {
      return false;
    }

    return !/^(Calibri|Arial|Times New Roman|Normal|Sheet\d*|\d+)$/.test(value);
  }

  private tagText(xml: string, tagName: string): string | null {
    return (
      new RegExp(
        `<(?:[A-Za-z0-9_]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${tagName}>`,
      ).exec(xml)?.[1] ?? null
    );
  }

  private attr(attrs: string, name: string): string | null {
    return (
      new RegExp(`\\b${name}=(["'])(.*?)\\1`).exec(attrs)?.[2] ?? null
    );
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
