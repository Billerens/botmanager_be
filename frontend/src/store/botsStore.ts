import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Bot {
  id: string;
  name: string;
  description?: string;
  username: string;
  status: "active" | "inactive" | "error";
  totalUsers: number;
  totalMessages: number;
  totalLeads: number;
  webhookUrl?: string;
  isWebhookSet: boolean;
  lastError?: string;
  lastErrorAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BotsState {
  bots: Bot[];
  currentBot: Bot | null;
  isLoading: boolean;
  error: string | null;
}

export interface BotsActions {
  setBots: (bots: Bot[]) => void;
  setCurrentBot: (bot: Bot | null) => void;
  addBot: (bot: Bot) => void;
  updateBot: (id: string, updates: Partial<Bot>) => void;
  removeBot: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useBotsStore = create<BotsState & BotsActions>()(
  persist(
    (set, get) => ({
      // State
      bots: [],
      currentBot: null,
      isLoading: false,
      error: null,

      // Actions
      setBots: (bots: Bot[]) => {
        set({ bots });
      },

      setCurrentBot: (bot: Bot | null) => {
        set({ currentBot: bot });
      },

      addBot: (bot: Bot) => {
        set((state) => ({
          bots: [...state.bots, bot],
        }));
      },

      updateBot: (id: string, updates: Partial<Bot>) => {
        set((state) => ({
          bots: state.bots.map((bot) =>
            bot.id === id ? { ...bot, ...updates } : bot
          ),
          currentBot:
            state.currentBot?.id === id
              ? { ...state.currentBot, ...updates }
              : state.currentBot,
        }));
      },

      removeBot: (id: string) => {
        set((state) => ({
          bots: state.bots.filter((bot) => bot.id !== id),
          currentBot: state.currentBot?.id === id ? null : state.currentBot,
        }));
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "bots-storage",
      partialize: (state) => ({
        bots: state.bots,
        currentBot: state.currentBot,
      }),
    }
  )
);
