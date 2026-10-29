export const queryKeys = {
  restaurants: {
    all: ['restaurants'] as const,
    nearby: (params: Record<string, unknown>) => ['restaurants', 'nearby', params] as const,
    detail: (id: string) => ['restaurants', 'detail', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    mine: (status?: string) => ['orders', 'mine', { status }] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  user: {
    me: ['user', 'me'] as const,
    addresses: ['user', 'addresses'] as const,
  },
};

