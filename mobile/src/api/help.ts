import { apiClient } from './client';
import {
  BotConversationDetail,
  BotConversationSummary,
  BotInsightsStats,
  BotReplyResult,
  BotWelcome,
  HelpArticle,
  HelpArticleInput,
  HelpCategory,
  SupportMessage,
  SupportTicket,
} from '../types/api';

export const helpApi = {
  getCategories: (audience: 'CUSTOMER' | 'DRIVER' | 'OWNER' = 'CUSTOMER') =>
    apiClient.get<any, HelpCategory[]>('/help/categories', {
      params: { audience },
    }),

  getArticles: (params?: { categoryId?: string; q?: string }) =>
    apiClient.get<any, HelpArticle[]>('/help/articles', {
      params,
    }),

  getPopularArticles: () =>
    apiClient.get<any, HelpArticle[]>('/help/articles/popular'),

  getArticle: (id: string) =>
    apiClient.get<any, HelpArticle>(`/help/articles/${id}`),

  submitFeedback: (id: string, helpful: boolean) =>
    apiClient.post<any, { success: boolean; message: string }>(`/help/articles/${id}/feedback`, {
      helpful,
    }),

  // =========================================================================
  //  SUPPORT TICKETS (ĐỢT B)
  // =========================================================================

  createTicket: (data: {
    orderId?: string;
    category: string;
    subject: string;
    description: string;
    issueType?: string;
    affectedItems?: { name: string; quantity: number; price: number }[];
    attachments?: string[];
  }) => apiClient.post<any, SupportTicket>('/help/tickets', data),

  getMyTickets: (params?: {
    statusGroup?: 'open' | 'closed' | 'all';
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<
      any,
      { items: SupportTicket[]; total: number; page: number; limit: number; totalPages: number }
    >('/help/tickets', { params }),

  countOpenTickets: () => apiClient.get<any, { count: number }>('/help/tickets/open-count'),

  getTicketDetail: (id: string) => apiClient.get<any, SupportTicket>(`/help/tickets/${id}`),

  addTicketMessage: (id: string, data: { content: string; attachments?: string[] }) =>
    apiClient.post<any, SupportMessage>(`/help/tickets/${id}/messages`, data),

  resolveTicket: (id: string) => apiClient.post<any, SupportTicket>(`/help/tickets/${id}/resolve`),

  submitCsat: (id: string, data: { csatScore: number; csatComment?: string }) =>
    apiClient.post<any, SupportTicket>(`/help/tickets/${id}/csat`, data),

  // =========================================================================
  //  CHATBOT ASSISTANT (ĐỢT C)
  // =========================================================================

  adminCompensateTicket: (id: string, data: { amount: number; note?: string }) =>
    apiClient.post<any, SupportTicket>(`/admin/help/tickets/${id}/compensate`, data),

  getBotWelcome: () => apiClient.get<any, BotWelcome>('/help/bot/welcome'),

  botHandover: (data: { conversationId?: string; orderId?: string; summary?: string }) =>
    apiClient.post<any, SupportTicket>('/help/bot/handover', data),

  sendBotMessage: (data: { content: string; conversationId?: string }) =>
    apiClient.post<any, BotReplyResult>('/help/bot/messages', data, { timeout: 35000 }),

  getBotMessages: (conversationId?: string) =>
    apiClient.get<any, BotReplyResult[]>('/help/bot/conversations', { params: { conversationId } }),

  submitBotFeedback: (messageId: string, feedback: 'HELPFUL' | 'UNHELPFUL') =>
    apiClient.post<any, any>(`/help/bot/messages/${messageId}/feedback`, { feedback }),

  // =========================================================================
  //  ADMIN SUPPORT APIs (ĐỢT D)
  // =========================================================================

  adminListTickets: (params?: { status?: string; priority?: string; q?: string; page?: number; limit?: number }) =>
    apiClient.get<
      any,
      { items: SupportTicket[]; total: number; page: number; limit: number; totalPages: number }
    >('/admin/help/tickets', { params }),

  adminUpdateTicketStatus: (id: string, data: { status: string; priority?: string; adminNote?: string }) =>
    apiClient.patch<any, SupportTicket>(`/admin/help/tickets/${id}/status`, data),

  adminAddTicketMessage: (id: string, data: { content: string; attachments?: string[] }) =>
    apiClient.post<any, SupportMessage>(`/admin/help/tickets/${id}/messages`, data),

  adminGetStats: () =>
    apiClient.get<
      any,
      {
        totalTickets: number;
        openTickets: number;
        resolvedTickets: number;
        csat: { averageScore: number; ratedCount: number };
        byCategory: { category: string; count: number }[];
      }
    >('/admin/help/stats'),
  // =========================================================================
  //  ADMIN: SOẠN FAQ & TRỢ LÝ TỰ ĐỘNG (chức năng 18)
  // =========================================================================

  adminListCategories: () => apiClient.get<any, HelpCategory[]>('/help/admin/categories'),

  adminListArticles: (categoryId?: string) =>
    apiClient.get<any, HelpArticle[]>('/help/admin/articles', { params: categoryId ? { categoryId } : undefined }),

  adminCreateArticle: (data: HelpArticleInput) => apiClient.post<any, HelpArticle>('/help/admin/articles', data),

  adminUpdateArticle: (id: string, data: Partial<HelpArticleInput>) =>
    apiClient.put<any, HelpArticle>(`/help/admin/articles/${id}`, data),

  adminDeleteArticle: (id: string) => apiClient.delete<any, unknown>(`/help/admin/articles/${id}`),

  adminBotStats: (days: number) => apiClient.get<any, BotInsightsStats>('/admin/help/bot/stats', { params: { days } }),

  adminBotConversations: (params: { page?: number; limit?: number; onlyProblems?: boolean }) =>
    apiClient.get<
      any,
      { items: BotConversationSummary[]; total: number; page: number; limit: number; hasMore: boolean }
    >('/admin/help/bot/conversations', { params }),

  adminBotConversation: (id: string) =>
    apiClient.get<any, BotConversationDetail>(`/admin/help/bot/conversations/${id}`),
};
