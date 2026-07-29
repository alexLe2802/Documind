import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { UploadedDocumentFile } from './interfaces/uploaded-document-file.interface';

export const DOCUMENT_UPLOAD_MAX_SIZE = 10 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
]);

@Injectable()
export class DocumentUploadValidationPipe implements PipeTransform<
  UploadedDocumentFile | undefined,
  UploadedDocumentFile
> {
  transform(file: UploadedDocumentFile | undefined): UploadedDocumentFile {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const size = file.size ?? file.buffer.length;
    if (size > DOCUMENT_UPLOAD_MAX_SIZE) {
      throw new PayloadTooLargeException('File size must not exceed 10 MB');
    }

    const extension = this.getExtension(file.originalname);
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      throw new UnsupportedMediaTypeException(
        'Only PDF, DOC/DOCX, PPT/PPTX, and XLS/XLSX files are supported',
      );
    }

    return file;
  }

  private getExtension(fileName: string): string {
    const trimmedName = fileName.trim();
    const extension = trimmedName.split('.').pop()?.toLowerCase() ?? '';
    return trimmedName.includes('.') ? extension : '';
  }
}
