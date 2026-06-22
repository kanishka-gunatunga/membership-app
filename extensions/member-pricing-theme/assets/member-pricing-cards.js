(function () {
  var PROXY_PATH = '/apps/membership-pricing/prices';

  function formatMoney(cents) {
    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, Shopify.money_format);
    }
    return '$' + (cents / 100).toFixed(2);
  }

  function renderMemberPricing(rrpCents, memberCents, campaignStrike) {
    var rrpClass =
      'member-pricing__rrp' + (campaignStrike ? ' member-pricing__rrp--strike' : '');
    return (
      '<div class="member-pricing__prices member-pricing__prices--stacked">' +
      '<p class="' +
      rrpClass +
      '">' +
      '<span class="member-pricing__rrp-label">RRP</span> ' +
      '<span class="member-pricing__rrp-amount">' +
      formatMoney(rrpCents) +
      '</span>' +
      '</p>' +
      '<p class="member-pricing__member member-pricing__member--card">' +
      '<span class="member-pricing__member-label">Members</span> ' +
      '<span class="member-pricing__member-amount">' +
      formatMoney(memberCents) +
      '</span>' +
      '</p>' +
      '</div>'
    );
  }

  function renderRegularPrice(rrpCents) {
    return (
      '<p class="member-pricing__regular-only">' +
      '<span class="member-pricing__regular-amount">' +
      formatMoney(rrpCents) +
      '</span>' +
      '</p>'
    );
  }

  function hydrateCard(card, pricing) {
    var slot = card.querySelector('[data-member-pricing-content]');
    if (!slot) return;

    var rrpCents = Number(card.getAttribute('data-rrp-cents')) || pricing.rrpCents;
    var memberCents = pricing.memberCents;
    var hasMemberPrice = memberCents > 0 && rrpCents > memberCents;

    if (hasMemberPrice) {
      slot.innerHTML = renderMemberPricing(
        rrpCents,
        memberCents,
        pricing.campaignStrike,
      );
      card.setAttribute('data-member-pricing-has-member', 'true');
    } else {
      slot.innerHTML = renderRegularPrice(rrpCents);
      card.removeAttribute('data-member-pricing-has-member');
    }

    card.setAttribute('data-member-pricing-ready', 'true');
  }

  function hydrateCards() {
    var cards = document.querySelectorAll(
      '[data-member-pricing-card]:not([data-member-pricing-ready])',
    );
    if (!cards.length) return;

    var handles = [];
    cards.forEach(function (card) {
      var handle = card.getAttribute('data-product-handle');
      if (handle) handles.push(handle);
    });

    if (!handles.length) return;

    var uniqueHandles = handles.filter(function (handle, index) {
      return handles.indexOf(handle) === index;
    });

    fetch(PROXY_PATH + '?handles=' + encodeURIComponent(uniqueHandles.join(',')))
      .then(function (response) {
        if (!response.ok) throw new Error('pricing fetch failed: ' + response.status);
        return response.json();
      })
      .then(function (data) {
        var products = data.products || {};
        if (Object.keys(products).length) {
          console.info('[Membership Pricing] Card prices loaded', products);
        }
        cards.forEach(function (card) {
          var handle = card.getAttribute('data-product-handle');
          if (!handle) return;

          var pricing = products[handle] || {
            rrpCents: Number(card.getAttribute('data-rrp-cents')) || 0,
            memberCents: 0,
            campaignStrike: false,
          };

          hydrateCard(card, pricing);
        });
      })
      .catch(function (error) {
        console.warn('[Membership Pricing] Could not load card prices:', error);
        cards.forEach(function (card) {
          var slot = card.querySelector('[data-member-pricing-content]');
          var rrpCents = Number(card.getAttribute('data-rrp-cents')) || 0;
          if (slot && rrpCents > 0) {
            slot.innerHTML = renderRegularPrice(rrpCents);
          }
          card.setAttribute('data-member-pricing-ready', 'true');
        });
      });
  }

  function scheduleHydrate() {
    hydrateCards();
    window.setTimeout(hydrateCards, 250);
    window.setTimeout(hydrateCards, 1000);
  }

  window.MemberPricingCards = { hydrate: scheduleHydrate };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleHydrate);
  } else {
    scheduleHydrate();
  }

  window.addEventListener('load', scheduleHydrate);
  document.addEventListener('shopify:section:load', scheduleHydrate);
})();
