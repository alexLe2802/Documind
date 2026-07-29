import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ChatMode } from '../enums/chat-mode.enum';

/**
 * CreateChatSessionDto
 *
 * Inbound payload for POST /ai-chatbot/session
 *
 * Initialises a new chat session with the chosen mode and optional context.
 */
export class CreateChatSessionDto {
  /**
   * The scope of the conversation.
   * ASK_THIS_DOCUMENT - questions about a specific document.
   * ASK_MY_LIBRARY - questions spanning the full document library.
   */
  @ApiProperty({ enum: ChatMode })
  @IsEnum(ChatMode)
  mode!: ChatMode;

  /**
   * Required when mode is ASK_THIS_DOCUMENT.
   * The ID of the document this session will be anchored to.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  documentId?: string;
}
