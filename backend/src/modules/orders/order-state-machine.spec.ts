import { actorMayTransition, isValidTransition } from './order-state-machine';

describe('order-state-machine', () => {
  it('rejects transitions outside the graph for everyone, including ADMIN', () => {
    expect(isValidTransition('PENDING', 'DELIVERED')).toBe(false);
    expect(actorMayTransition('ADMIN', 'PENDING', 'DELIVERED')).toBe(false);
    expect(actorMayTransition('ADMIN', 'DELIVERED', 'CANCELLED')).toBe(false);
  });

  it('owner drives the kitchen flow', () => {
    expect(actorMayTransition('OWNER', 'PENDING', 'CONFIRMED')).toBe(true);
    expect(actorMayTransition('OWNER', 'CONFIRMED', 'PREPARING')).toBe(true);
    expect(actorMayTransition('OWNER', 'PREPARING', 'READY_FOR_PICKUP')).toBe(true);
    expect(actorMayTransition('OWNER', 'READY_FOR_PICKUP', 'PICKED_UP')).toBe(false);
  });

  it('driver handles pickup and delivery only', () => {
    expect(actorMayTransition('DRIVER', 'READY_FOR_PICKUP', 'PICKED_UP')).toBe(true);
    expect(actorMayTransition('DRIVER', 'PICKED_UP', 'DELIVERED')).toBe(true);
    expect(actorMayTransition('DRIVER', 'PENDING', 'CONFIRMED')).toBe(false);
    expect(actorMayTransition('DRIVER', 'CONFIRMED', 'CANCELLED')).toBe(false);
  });

  it('customer may cancel only while PENDING', () => {
    expect(actorMayTransition('CUSTOMER', 'PENDING', 'CANCELLED')).toBe(true);
    expect(actorMayTransition('CUSTOMER', 'CONFIRMED', 'CANCELLED')).toBe(false);
    expect(actorMayTransition('CUSTOMER', 'PENDING', 'CONFIRMED')).toBe(false);
  });
});
