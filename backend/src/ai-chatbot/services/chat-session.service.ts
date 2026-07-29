import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChatMode } from '../enums/chat-mode.enum';
import { MessageSender } from '../enums/message-sender.enum';
import { SessionMessage } from './prompt-builder.service';

/** Full internal session record */
export interface ChatSession {
  id: string;
  mode: ChatMode;
  documentId?: string;
  createdAt: string;
  history: SessionMessage[];
}

/**
 * ChatSessionService
 *
 * Manages the lifecycle of chat sessions:
 *   - Create sessions with a mode (ASK_THIS_DOCUMENT | ASK_MY_LIBRARY | COMMUNITY_SEARCH)
 *   - Retrieve session state and history
 *   - Append user and AI messages to the conversation history
 *
 * Sprint 1: In-memory Map store.
 * Future: Replace with a persistent store (Redis / DB).
 */
@Injectable()
export class ChatSessionService {
  private readonly logger = new Logger(ChatSessionService.name);

  /** In-memory store: sessionId → ChatSession */
  private readonly sessions = new Map<string, ChatSession>();

  /**
   * Creates a new chat session.
   *
   * @param mode       - ASK_THIS_DOCUMENT, ASK_MY_LIBRARY, or COMMUNITY_SEARCH
   * @param documentId - Required for ASK_THIS_DOCUMENT mode
   */
  create(mode: ChatMode, documentId?: string): ChatSession {
    const session: ChatSession = {
      id: randomUUID(),
      mode,
      documentId,
      createdAt: new Date().toISOString(),
      history: [],
    };

    this.sessions.set(session.id, session);
    this.logger.log(`Session created [${mode}]: ${session.id}`);

    return session;
  }

  /**
   * Retrieves a session by ID.
   *
   * @throws NotFoundException if the session does not exist
   */
  findById(sessionId: string): ChatSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`Chat session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Appends a message to the session history.
   *
   * @param sessionId - Target session ID
   * @param sender    - MessageSender.USER or MessageSender.AI
   * @param content   - Message text
   */
  appendMessage(
    sessionId: string,
    sender: MessageSender,
    content: string,
  ): SessionMessage {
    const session = this.findById(sessionId);

    const message: SessionMessage = {
      sender,
      content,
      timestamp: new Date().toISOString(),
    };

    session.history.push(message);
    return message;
  }
}
