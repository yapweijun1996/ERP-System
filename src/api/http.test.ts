import { describe, expect, it, vi } from 'vitest';
import { apiError } from './http';

describe('apiError i18n compatibility contract', () => {
  it('keeps English fallback fields and adds optional translation parameters', () => {
    const response = {
      locals: { erpContext: { requestId: 'req-i18n' } },
      status: vi.fn(),
      json: vi.fn(),
    };
    response.status.mockReturnValue(response);

    apiError(
      response as never,
      422,
      'quantity_exceeded',
      'Quantity exceeds the available balance.',
      { quantity: 'Quantity is too high.' },
      {
        params: { requested: 12, available: 4 },
        fieldErrorCodes: {
          quantity: { code: 'quantity_exceeded', params: { available: 4 } },
        },
      },
    );

    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'quantity_exceeded',
        message: 'Quantity exceeds the available balance.',
        params: { requested: 12, available: 4 },
        fieldErrors: { quantity: 'Quantity is too high.' },
        fieldErrorCodes: {
          quantity: { code: 'quantity_exceeded', params: { available: 4 } },
        },
        requestId: 'req-i18n',
      },
    });
  });
});
