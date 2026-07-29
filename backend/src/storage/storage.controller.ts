import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { StorageObjectDto } from './dto/storage-object.dto';
import {
  DownloadUrlResponse,
  PreviewUrlResponse,
  StorageService,
} from './storage.service';

@Controller('storage')
@UseGuards(FirebaseAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload-url')
  createUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadUrlDto,
  ): ReturnType<StorageService['createUploadUrl']> {
    return this.storageService.createUploadUrl(user.id, dto);
  }

  @Post('download-url')
  createDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StorageObjectDto,
  ): Promise<DownloadUrlResponse> {
    return this.storageService.createDownloadUrl(user.id, dto.key);
  }

  @Post('preview-url')
  createPreviewUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StorageObjectDto,
  ): Promise<PreviewUrlResponse> {
    return this.storageService.createPreviewUrl(user.id, dto.key);
  }

  @Delete('object')
  deleteObject(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StorageObjectDto,
  ): Promise<{ message: string }> {
    return this.storageService.deleteObject(user.id, dto.key);
  }
}
