import { lineItemAmounts } from './line-item-amounts.util';
import type { ShopifyLineItem } from './dto/shopify-order.dto';

const line = (overrides: Partial<ShopifyLineItem> = {}): ShopifyLineItem => ({
  id: 1,
  title: 'Rompecabezas',
  quantity: 1,
  price: '69.99',
  total_discount: '0.00',
  properties: [],
  ...overrides,
});

const amounts = (l: ShopifyLineItem) => {
  const r = lineItemAmounts(l);
  return { unit: r.unitPrice.toFixed(2), total: r.totalPrice.toFixed(2) };
};

describe('lineItemAmounts', () => {
  it('sin descuento, el precio de lista', () => {
    expect(amounts(line())).toEqual({ unit: '69.99', total: '69.99' });
  });

  it('bundle de 2: descuento automático de $10 en discount_allocations', () => {
    expect(
      amounts(
        line({
          discount_allocations: [
            { amount: '10.00', discount_application_index: 0 },
          ],
        }),
      ),
    ).toEqual({ unit: '59.99', total: '59.99' });
  });

  it('no suma total_discount cuando hay asignaciones', () => {
    expect(
      amounts(
        line({
          total_discount: '20.00',
          discount_allocations: [{ amount: '20.00' }],
        }),
      ),
    ).toEqual({ unit: '49.99', total: '49.99' });
  });

  it('sin asignaciones usa total_discount', () => {
    expect(amounts(line({ total_discount: '5.00' }))).toEqual({
      unit: '64.99',
      total: '64.99',
    });
  });

  it('reparte el descuento entre las unidades de la línea', () => {
    expect(
      amounts(
        line({
          quantity: 3,
          discount_allocations: [{ amount: '60.00' }],
        }),
      ),
    ).toEqual({ unit: '49.99', total: '149.97' });
  });

  it('nunca negativo', () => {
    expect(
      amounts(line({ discount_allocations: [{ amount: '100.00' }] })),
    ).toEqual({ unit: '0.00', total: '0.00' });
  });
});
