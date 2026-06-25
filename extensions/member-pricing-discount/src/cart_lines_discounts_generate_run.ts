import {
  CartInput,
  CartLinesDiscountsGenerateRunResult,
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

type MoneyValue = {
  amount?: string;
  currencyCode?: string;
};

type FunctionConfig = {
  enabled: boolean;
  memberLabel: string;
  savingsLabel: string;
};

function parseMoneyToCents(amount: string | number): number {
  const value = typeof amount === 'number' ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

function centsToDecimalAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

const DEFAULT_FUNCTION_CONFIG: FunctionConfig = {
  enabled: true,
  memberLabel: 'Member price',
  savingsLabel: 'You save',
};

function parseMoneyMetafield(
  jsonValue: unknown,
  valueString?: string | null,
): MoneyValue | null {
  if (jsonValue && typeof jsonValue === 'object' && !Array.isArray(jsonValue)) {
    const record = jsonValue as Record<string, unknown>;
    if (typeof record.amount === 'string' && record.amount.trim()) {
      return {
        amount: record.amount,
        currencyCode:
          typeof record.currencyCode === 'string'
            ? record.currencyCode
            : undefined,
      };
    }
    if (typeof record.amount === 'number' && Number.isFinite(record.amount)) {
      return {amount: record.amount.toFixed(2)};
    }
  }

  if (typeof valueString === 'string' && valueString.trim()) {
    try {
      return parseMoneyMetafield(JSON.parse(valueString));
    } catch {
      const cleaned = valueString.replace(/[^0-9.-]/g, '');
      if (cleaned) return {amount: cleaned};
    }
  }

  return null;
}

function resolveMemberPriceCents(
  variantMemberPrice: MoneyValue | null,
  productMemberPrice: MoneyValue | null,
): number | null {
  const source = variantMemberPrice ?? productMemberPrice;
  if (!source?.amount) return null;

  const cents = parseMoneyToCents(source.amount);
  return cents > 0 ? cents : null;
}

function parseRecordConfig(record: Record<string, unknown>): FunctionConfig | null {
  return {
    enabled: record.enabled !== false,
    memberLabel:
      typeof record.memberLabel === 'string' && record.memberLabel.trim()
        ? record.memberLabel
        : 'Member price',
    savingsLabel:
      typeof record.savingsLabel === 'string' && record.savingsLabel.trim()
        ? record.savingsLabel
        : 'You save',
  };
}

function parseMetaobjectConfig(input: CartInput): FunctionConfig | null {
  const node = input.shop.metaobject;
  if (!node) return null;

  return {
    enabled: node.enabled?.value !== 'false',
    memberLabel: node.memberLabel?.value || 'Member price',
    savingsLabel: node.savingsLabel?.value || 'You save',
  };
}

function parseDiscountMetafieldConfig(input: CartInput): FunctionConfig | null {
  const jsonValue = input.discount.metafield?.jsonValue;
  if (!jsonValue || typeof jsonValue !== 'object' || Array.isArray(jsonValue)) {
    return null;
  }

  return parseRecordConfig(jsonValue as Record<string, unknown>);
}

function parseFunctionConfig(input: CartInput): FunctionConfig {
  return (
    parseMetaobjectConfig(input) ??
    parseDiscountMetafieldConfig(input) ??
    DEFAULT_FUNCTION_CONFIG
  );
}

function isLevelOneMember(input: CartInput): boolean {
  return input.cart.buyerIdentity?.isAuthenticated === true;
}

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  if (!input.cart.lines.length) {
    return {operations: []};
  }

  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasProductDiscountClass) {
    return {operations: []};
  }

  const functionConfig = parseFunctionConfig(input);
  if (!functionConfig.enabled) {
    return {operations: []};
  }

  if (!isLevelOneMember(input)) {
    return {operations: []};
  }

  const candidates: Array<{
    message: string;
    targets: Array<{cartLine: {id: string}}>;
    value: {fixedAmount: {amount: string}};
  }> = [];

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== 'ProductVariant') continue;

    const variantMemberPrice = parseMoneyMetafield(
      line.merchandise.memberPrice?.jsonValue,
      line.merchandise.memberPrice?.value,
    );
    const productMemberPrice = parseMoneyMetafield(
      line.merchandise.product?.memberPrice?.jsonValue,
      line.merchandise.product?.memberPrice?.value,
    );
    const memberPriceCents = resolveMemberPriceCents(
      variantMemberPrice,
      productMemberPrice,
    );

    if (memberPriceCents === null) continue;

    const unitPriceCents = parseMoneyToCents(
      line.cost.amountPerQuantity.amount,
    );
    const quantity = line.quantity ?? 1;
    const discountPerUnitCents = unitPriceCents - memberPriceCents;

    if (discountPerUnitCents <= 0) continue;

    const totalDiscountCents = discountPerUnitCents * quantity;
    const discountAmount = centsToDecimalAmount(totalDiscountCents);

    candidates.push({
      message: `${functionConfig.savingsLabel} ${centsToDecimalAmount(totalDiscountCents)}`,
      targets: [{cartLine: {id: line.id}}],
      value: {
        fixedAmount: {
          amount: discountAmount,
        },
      },
    });
  }

  if (candidates.length === 0) {
    return {operations: []};
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
