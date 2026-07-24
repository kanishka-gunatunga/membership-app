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
      return JSON.parse(script.textContent);
    } catch (error) {
      return null;
    }
  }

  function loginHintHtml() {
    var returnUrl = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    return (
      '<p class="member-pricing__login-hint" data-member-pricing-login-hint>' +
      '<span class="member-pricing__login-icon" aria-hidden="true">&#128161;</span> ' +
      'To get this product at member price, please ' +
      '<a href="/account/login?return_url=' +
      returnUrl +
      '">login</a> to your account first.' +
      '</p>'
    );
  }

  function memberPricesHtml(variant, moneyFormat, memberLabel) {
    return (
      '<span class="member-pricing__member">' +
      '<span class="member-pricing__member-label">' +
      (memberLabel || 'Member price') +
      '</span> ' +
      '<span class="member-pricing__member-amount" data-member-pricing-member>' +
      formatMoney(variant.memberCents, moneyFormat) +
      '</span></span>' +
      '<span class="member-pricing__rrp' +
      (variant.campaignStrike ? ' member-pricing__rrp--strike' : '') +
      '" data-member-pricing-rrp data-campaign-strike="' +
      Boolean(variant.campaignStrike) +
      '">' +
      '<span class="member-pricing__rrp-label">RRP</span> ' +
      '<span class="member-pricing__rrp-amount" data-member-pricing-rrp-amount>' +
      formatMoney(variant.rrpCents, moneyFormat) +
      '</span></span>'
    );
  }

  function renderMemberPricing(block, variant, moneyFormat, memberLabel) {
    var pricesEl = block.querySelector('[data-member-pricing-prices]');

    if (pricesEl) {
      pricesEl.innerHTML = memberPricesHtml(variant, moneyFormat, memberLabel);
      if (!block.querySelector('[data-member-pricing-login-hint]')) {
        block.insertAdjacentHTML('beforeend', loginHintHtml());
      }
      return;
    }

    block.className = 'member-pricing member-pricing--pdp';
    block.innerHTML =
      '<div class="member-pricing__prices" data-member-pricing-prices">' +
      memberPricesHtml(variant, moneyFormat, memberLabel) +
      '</div>' +
      loginHintHtml();
  }

  function renderRrpOnly(block, variant, moneyFormat) {
    var pricesEl = block.querySelector('[data-member-pricing-prices]');
    var rrpHtml =
      '<span class="member-pricing__rrp' +
      (variant.campaignStrike ? ' member-pricing__rrp--strike' : '') +
      '" data-member-pricing-rrp data-campaign-strike="' +
      Boolean(variant.campaignStrike) +
      '">' +
      '<span class="member-pricing__rrp-label">RRP</span> ' +
      '<span class="member-pricing__rrp-amount" data-member-pricing-rrp-amount>' +
      formatMoney(variant.rrpCents, moneyFormat) +
      '</span></span>';

    var loginHint = block.querySelector('[data-member-pricing-login-hint]');
    if (loginHint) loginHint.remove();

    if (pricesEl) {
      pricesEl.innerHTML = rrpHtml;
      return;
    }

    block.className = 'member-pricing member-pricing--pdp';
    block.innerHTML =
      '<div class="member-pricing__prices" data-member-pricing-prices">' +
      rrpHtml +
      '</div>';
  }

  function updateBlock(block, variantId) {
    var data = findVariantData(block);
    if (!data || !data.variants) return;

    var variant = data.variants.find(function (entry) {
      return String(entry.id) === String(variantId);
    });
    if (!variant) return;

    var hasMemberPrice =
      variant.memberCents > 0 && variant.rrpCents > variant.memberCents;

    if (hasMemberPrice) {
      renderMemberPricing(block, variant, data.moneyFormat, data.memberLabel);
    } else {
      renderRrpOnly(block, variant, data.moneyFormat);
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
