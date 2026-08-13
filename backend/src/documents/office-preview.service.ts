import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyXlsxPrintLayout } from './xlsx-print-layout';

@Injectable()
export class OfficePreviewService {
  private readonly logger = new Logger(OfficePreviewService.name);
  private readonly conversionTimeoutMs = 10_000;

  async convertToPdf(input: {
    buffer: Buffer;
    fileName: string;
  }): Promise<Buffer> {
    const workspace = await mkdtemp(join(tmpdir(), 'doc-preview-'));
    const inputPath = join(workspace, this.safePreviewFileName(input.fileName));

    try {
      const previewInput =
        extname(input.fileName).toLowerCase() === '.xlsx'
          ? await applyXlsxPrintLayout(input.buffer)
          : input.buffer;
      await writeFile(inputPath, previewInput);
      await this.runLibreOffice(workspace, inputPath);

      const files = await readdir(workspace);
      const pdfFile = files.find((file) => file.toLowerCase().endsWith('.pdf'));
      if (!pdfFile) {
        throw new ServiceUnavailableException(
          'Document preview PDF could not be generated',
        );
      }

      return await readFile(join(workspace, pdfFile));
    } finally {
      await rm(workspace, { recursive: true, force: true }).catch(
        (error: unknown) => {
          this.logger.warn(
            `Could not clean preview workspace: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        },
      );
    }
  }

  private runLibreOffice(outDir: string, inputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('soffice', [
        `-env:UserInstallation=${pathToFileURL(join(outDir, '.libreoffice-profile')).href}`,
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        outDir,
        inputPath,
      ]);

      let stderr = '';
      let settled = false;
      const finish = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback();
      };
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        finish(() =>
          reject(
            new ServiceUnavailableException(
              'Office preview conversion timed out',
            ),
          ),
        );
      }, this.conversionTimeoutMs);

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', () => {
        finish(() =>
          reject(
            new ServiceUnavailableException(
              'LibreOffice is required to generate Office document previews',
            ),
          ),
        );
      });

      child.on('close', (code) => {
        if (code === 0) {
          finish(resolve);
          return;
        }

        finish(() =>
          reject(
            new ServiceUnavailableException(
              stderr.trim() || 'Document preview conversion failed',
            ),
          ),
        );
      });
    });
  }

  private safePreviewFileName(fileName: string): string {
    const extension = extname(fileName).toLowerCase();
    const stem = basename(fileName, extension).replace(
      /[^a-zA-Z0-9._-]+/g,
      '-',
    );
    return `${stem || 'document'}${extension}`;
  }
}
