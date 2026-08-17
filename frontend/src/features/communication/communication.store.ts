import { create } from 'zustand';
import type { MessageView, PresenceUpdate, TypingUpdate } from '@campusconnection/shared';

export interface PendingMessage extends MessageView {
  delivery: 'pending' | 'failed';
}
interface CommunicationState {
  connection: 'disconnected' | 'connecting' | 'connected';
  pending: Record<string, PendingMessage>;
  typing: Record<string, TypingUpdate>;
  presence: Record<string, PresenceUpdate>;
  setConnection: (connection: CommunicationState['connection']) => void;
  addPending: (message: PendingMessage) => void;
  markFailed: (clientMessageId: string) => void;
  removePending: (clientMessageId: string) => void;
  setTyping: (update: TypingUpdate) => void;
  setPresence: (update: PresenceUpdate) => void;
}

export const useCommunicationStore = create<CommunicationState>((set) => ({
  connection: 'disconnected',
  pending: {},
  typing: {},
  presence: {},
  setConnection: (connection) => set({ connection }),
  addPending: (message) =>
    set((state) => ({ pending: { ...state.pending, [message.clientMessageId]: message } })),
  markFailed: (clientMessageId) =>
    set((state) => ({
      pending: state.pending[clientMessageId]
        ? {
            ...state.pending,
            [clientMessageId]: { ...state.pending[clientMessageId], delivery: 'failed' },
          }
        : state.pending,
    })),
  removePending: (clientMessageId) =>
    set((state) => {
      const pending = { ...state.pending };
      delete pending[clientMessageId];
      return { pending };
    }),
  setTyping: (update) =>
    set((state) => ({
      typing: { ...state.typing, [`${update.conversationId}:${update.userId}`]: update },
    })),
  setPresence: (update) =>
    set((state) => ({ presence: { ...state.presence, [update.userId]: update } })),
}));
