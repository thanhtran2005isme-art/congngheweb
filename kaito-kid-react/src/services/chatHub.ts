/**
 * Wrapper SignalR HubConnection cho chat real-time.
 * Kết nối thẳng tới API.Customer (VITE_CHAT_HUB_URL) vì Ocelot không proxy WebSocket.
 * Tự gắn access_token qua query string (header Authorization không khả dụng với WebSocket).
 */

import {
  HubConnectionBuilder,
  HubConnection,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import type { ChatAttachment, ChatMessage } from './chatService';

const HUB_URL = (import.meta.env.VITE_CHAT_HUB_URL as string) || 'http://localhost:5265/hubs/chat';

export type ChatHubEvents = {
  onReceiveMessage?: (msg: ChatMessage) => void;
  onConversationUpdated?: (conversationId: number) => void;
  onTypingChanged?: (conversationId: number, role: string, isTyping: boolean) => void;
  onReadReceipt?: (conversationId: number, by: string) => void;
  onQueueUpdated?: (conversationId: number) => void;
  onHandoffRequested?: (conversationId: number) => void;
  onConversationClosed?: (conversationId: number) => void;
  onClaimFailed?: (conversationId: number) => void;
  onReconnected?: () => void;
};

export class ChatHubClient {
  private connection: HubConnection;
  private events: ChatHubEvents = {};

  constructor(getToken: () => string | null) {
    this.connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => getToken() ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection.on('ReceiveMessage', (m: ChatMessage) => this.events.onReceiveMessage?.(m));
    this.connection.on('ConversationUpdated', (id: number) => this.events.onConversationUpdated?.(id));
    this.connection.on('TypingChanged', (id: number, role: string, isTyping: boolean) =>
      this.events.onTypingChanged?.(id, role, isTyping));
    this.connection.on('ReadReceipt', (id: number, by: string) => this.events.onReadReceipt?.(id, by));
    this.connection.on('QueueUpdated', (id: number) => this.events.onQueueUpdated?.(id));
    this.connection.on('HandoffRequested', (id: number) => this.events.onHandoffRequested?.(id));
    this.connection.on('ConversationClosed', (id: number) => this.events.onConversationClosed?.(id));
    this.connection.on('ClaimFailed', (id: number) => this.events.onClaimFailed?.(id));

    this.connection.onreconnected(() => this.events.onReconnected?.());
  }

  setEvents(events: ChatHubEvents) {
    this.events = { ...this.events, ...events };
  }

  get state(): HubConnectionState {
    return this.connection.state;
  }

  async start(): Promise<void> {
    if (this.connection.state === HubConnectionState.Disconnected) {
      await this.connection.start();
    }
  }

  async stop(): Promise<void> {
    await this.connection.stop();
  }

  // ===== Khách =====
  joinConversation(conversationId: number) {
    return this.connection.invoke('JoinConversation', conversationId);
  }

  sendMessage(conversationId: number, text: string, attach?: ChatAttachment, guestId?: string) {
    return this.connection.invoke('SendMessage', conversationId, text, attach ?? null, guestId ?? null);
  }

  requestHandoff(conversationId: number) {
    return this.connection.invoke('RequestHandoff', conversationId);
  }

  endConversation(conversationId: number, guestId?: string) {
    return this.connection.invoke('EndConversation', conversationId, guestId ?? null);
  }

  typing(conversationId: number, isTyping: boolean) {
    return this.connection.invoke('Typing', conversationId, isTyping);
  }

  markRead(conversationId: number) {
    return this.connection.invoke('MarkRead', conversationId);
  }

  // ===== Nhân viên =====
  joinAgentQueue() {
    return this.connection.invoke('JoinAgentQueue');
  }

  claimConversation(conversationId: number) {
    return this.connection.invoke('ClaimConversation', conversationId);
  }

  agentSendMessage(conversationId: number, text: string, attach?: ChatAttachment) {
    return this.connection.invoke('AgentSendMessage', conversationId, text, attach ?? null);
  }
}
