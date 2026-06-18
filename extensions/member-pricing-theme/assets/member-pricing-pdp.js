(function () {
  function formatMoney(cents, moneyFormat) {
    var format =
      moneyFormat ||
      (typeof Shopify !== 'undefined' ? Shopify.money_format : null);

    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, format);
    }

    return '$' + (cents / 100).toFixed(2);
  }

  function findVariantData(block) {
    var blockId = block.getAttribute('data-member-pricing-block');
    if (!blockId) return null;
    var script = document.querySelector(
      'script[data-member-pricing-variants="' + blockId + '"]',
    );
    if (!script) return null;
    try {
      var parsed = JSON.parse(script.textContent);
      if (Array.isArray(parsed)) {
        return { moneyFormat: null, variants: parsed };
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function updateBlock(block, variantId) {
    var data = findVariantData(block);
    if (!data || !data.variants) return;

    var variant = data.variants.find(function (entry) {
      return String(entry.id) === String(variantId);
    });
    if (!variant) return;

    var memberEl = block.querySelector('[data-member-pricing-member]');
    var rrpAmountEl = block.querySelector('[data-member-pricing-rrp-amount]');
    var rrpEl = block.querySelector('[data-member-pricing-rrp]');

    if (memberEl) {
      memberEl.textContent = formatMoney(variant.memberCents, data.moneyFormat);
    }
    if (rrpAmountEl) {
      rrpAmountEl.textContent = formatMoney(variant.rrpCents, data.moneyFormat);
    }
    if (rrpEl) {
      rrpEl.classList.toggle('member-pricing__rrp--strike', Boolean(variant.campaignStrike));
      rrpEl.setAttribute('data-campaign-strike', String(Boolean(variant.campaignStrike)));
    }
  }

  function onVariantChange(event) {
    var variantId =
      event.detail?.variant?.id ||
      event.detail?.variantId ||
      event.detail?.id ||
      document.querySelector('form[action*="/cart/add"] [name="id"]')?.value;

    if (!variantId) return;

    document
      .querySelectorAll('[data-member-pricing-block]')
      .forEach(function (block) {
        updateBlock(block, variantId);
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var initialVariantId = document.querySelector(
      'form[action*="/cart/add"] [name="id"]',
    )?.value;
    if (initialVariantId) {
      document
        .querySelectorAll('[data-member-pricing-block]')
        .forEach(function (block) {
          updateBlock(block, initialVariantId);
        });
    }
  });

  document.addEventListener('variant:change', onVariantChange);
  document.addEventListener('variantChange', onVariantChange);

  var variantInput = document.querySelector('form[action*="/cart/add"] [name="id"]');
  if (variantInput) {
    variantInput.addEventListener('change', function (event) {
      onVariantChange({ detail: { variantId: event.target.value } });
    });
  }
})();
