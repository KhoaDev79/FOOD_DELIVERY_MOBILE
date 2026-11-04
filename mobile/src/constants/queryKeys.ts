export const queryKeys = {
  restaurants: {
    all: ['restaurants'] as const,
    nearby: (params: Record<string, unknown>) => ['restaurants', 'nearby', params] as const,
    detail: (id: string) => ['restaurants', 'detail', id] as const,
    schedule: (id: string) => ['restaurants', 'schedule', id] as const,
    nearbyDishes: (params: Record<string, unknown>) => ['restaurants', 'nearby-dishes', params] as const,
  },
  banners: ['banners'] as const,
  cuisines: ['cuisines'] as const,
  search: {
    popular: ['search', 'popular'] as const,
  },
  orders: {
    all: ['orders'] as const,
    mine: (status?: string) => ['orders', 'mine', { status }] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  chat: {
    all: ['chat'] as const,
    unread: ['chat', 'unread'] as const,
    conversations: ['chat', 'conversations'] as const,
  },
  user: {
    me: ['user', 'me'] as const,
    addresses: ['user', 'addresses'] as const,
  },
  vouchers: {
    all: ['vouchers'] as const,
    available: (params: Record<string, unknown>) => ['vouchers', 'available', params] as const,
    wallet: (tab: string) => ['vouchers', 'wallet', tab] as const,
    featured: ['vouchers', 'featured'] as const,
    manage: (scope: string, params?: Record<string, unknown>) => ['vouchers', 'manage', scope, params] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (page?: number) => ['notifications', 'list', page] as const,
    unread: ['notifications', 'unread'] as const,
  },
  help: {
    all: ['help'] as const,
    categories: (audience?: string) => ['help', 'categories', audience] as const,
    articles: (params?: Record<string, unknown>) => ['help', 'articles', params] as const,
    popular: ['help', 'popular'] as const,
    detail: (id: string) => ['help', 'detail', id] as const,
    tickets: (params?: Record<string, unknown>) => ['help', 'tickets', params] as const,
    ticketDetail: (id: string) => ['help', 'tickets', 'detail', id] as const,
    openTicketsCount: ['help', 'tickets', 'open-count'] as const,
    botMessages: (convId?: string) => ['help', 'bot', 'messages', convId] as const,
  },
};

