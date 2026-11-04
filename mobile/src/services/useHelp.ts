import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { helpApi } from '../api/help';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/useAuthStore';

// =========================================================================
//  FAQ & DANH MỤC (ĐỢT A)
// =========================================================================

export function useHelpCategories(audience: 'CUSTOMER' | 'DRIVER' | 'OWNER' = 'CUSTOMER') {
  return useQuery({
    queryKey: queryKeys.help.categories(audience),
    queryFn: () => helpApi.getCategories(audience),
    staleTime: 5 * 60 * 1000,
  });
}

export function useHelpArticles(params?: { categoryId?: string; q?: string }) {
  return useQuery({
    queryKey: queryKeys.help.articles(params),
    queryFn: () => helpApi.getArticles(params),
    staleTime: 60 * 1000,
  });
}

export function usePopularHelpArticles() {
  return useQuery({
    queryKey: queryKeys.help.popular,
    queryFn: () => helpApi.getPopularArticles(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useHelpArticle(id: string) {
  return useQuery({
    queryKey: queryKeys.help.detail(id),
    queryFn: () => helpApi.getArticle(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

export function useSubmitArticleFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, helpful }: { id: string; helpful: boolean }) =>
      helpApi.submitFeedback(id, helpful),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.help.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.help.all });
    },
  });
}

// =========================================================================
//  PHIẾU HỖ TRỢ / TICKETS (ĐỢT B)
// =========================================================================

export function useMyTickets(statusGroup?: 'open' | 'closed' | 'all') {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.help.tickets({ statusGroup }),
    queryFn: () => helpApi.getMyTickets({ statusGroup }),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

export function useOpenTicketsCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.help.openTicketsCount,
    queryFn: () => helpApi.countOpenTickets(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    select: (res) => res.count,
  });
}

export function useTicketDetail(ticketId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.help.ticketDetail(ticketId),
    queryFn: () => helpApi.getTicketDetail(ticketId),
    enabled: isAuthenticated && Boolean(ticketId),
    refetchInterval: 10 * 1000, // Tự động làm mới tin nhắn mỗi 10s
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof helpApi.createTicket>[0]) =>
      helpApi.createTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['help', 'tickets'] });
    },
  });
}

export function useAddTicketMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: { content: string; attachments?: string[] } }) =>
      helpApi.addTicketMessage(ticketId, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.help.ticketDetail(vars.ticketId) });
      queryClient.invalidateQueries({ queryKey: ['help', 'tickets'] });
    },
  });
}

export function useResolveTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) => helpApi.resolveTicket(ticketId),
    onSuccess: (_res, ticketId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.help.ticketDetail(ticketId) });
      queryClient.invalidateQueries({ queryKey: ['help', 'tickets'] });
    },
  });
}

export function useSubmitCsat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: { csatScore: number; csatComment?: string } }) =>
      helpApi.submitCsat(ticketId, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.help.ticketDetail(vars.ticketId) });
      queryClient.invalidateQueries({ queryKey: ['help', 'tickets'] });
    },
  });
}

// =========================================================================
//  CHATBOT ASSISTANT (ĐỢT C)
// =========================================================================

export function useBotMessages(conversationId?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.help.botMessages(conversationId),
    queryFn: () => helpApi.getBotMessages(conversationId),
    enabled: isAuthenticated,
  });
}

export function useBotWelcome() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['help', 'bot', 'welcome'],
    queryFn: () => helpApi.getBotWelcome(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

export function useBotHandover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { conversationId?: string; orderId?: string; summary?: string }) =>
      helpApi.botHandover(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['help', 'tickets'] });
    },
  });
}

export function useSendBotMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { content: string; conversationId?: string }) =>
      helpApi.sendBotMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['help', 'bot', 'welcome'] });
    },
  });
}

export function useSubmitBotFeedback() {
  return useMutation({
    mutationFn: ({ messageId, feedback }: { messageId: string; feedback: 'HELPFUL' | 'UNHELPFUL' }) =>
      helpApi.submitBotFeedback(messageId, feedback),
  });
}

// =========================================================================
//  ADMIN SUPPORT HOOKS (ĐỢT D)
// =========================================================================

export function useAdminSupportTickets(params?: { status?: string; priority?: string; q?: string; page?: number }) {
  return useQuery({
    queryKey: ['admin', 'help', 'tickets', params],
    queryFn: () => helpApi.adminListTickets(params),
    staleTime: 15 * 1000,
  });
}

export function useAdminSupportStats() {
  return useQuery({
    queryKey: ['admin', 'help', 'stats'],
    queryFn: () => helpApi.adminGetStats(),
    staleTime: 60 * 1000,
  });
}

export function useAdminUpdateTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string; priority?: string; adminNote?: string } }) =>
      helpApi.adminUpdateTicketStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'help'] });
      queryClient.invalidateQueries({ queryKey: ['help'] });
    },
  });
}

/** Admin tặng voucher bồi thường cho khách của phiếu */
export function useAdminCompensateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note?: string }) =>
      helpApi.adminCompensateTicket(id, { amount, note }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.help.ticketDetail(vars.id) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'help'] });
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    },
  });
}

export function useAdminAddTicketMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { content: string; attachments?: string[] } }) =>
      helpApi.adminAddTicketMessage(id, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.help.ticketDetail(vars.id) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'help'] });
    },
  });
}
