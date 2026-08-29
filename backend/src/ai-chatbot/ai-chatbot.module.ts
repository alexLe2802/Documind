import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { AiChatbotController } from './ai-chatbot.controller';
import { AiChatbotService } from './ai-chatbot.service';
import { ChatSourceService } from './services/chat-source.service';
import { GeminiService } from './services/gemini.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [AuthModule, AuditLogModule, PaymentsModule],
  controllers: [AiChatbotController],
  providers: [
    AiChatbotService,
    GeminiService,
    PromptBuilderService,
    ChatSourceService,
  ],
  exports: [AiChatbotService, GeminiService],
})
export class AiChatbotModule {}
