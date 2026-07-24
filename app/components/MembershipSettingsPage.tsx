import { useEffect, useMemo, useState } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useOutletContext,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import type { MetafieldSource } from "../lib/membership.shared";
import type { MemberPriceCatalogStatus } from "../lib/membership-products.server";
import type { ThemeCardSetupGuide } from "../lib/theme-card-install.server";
import {
  APP_BILLING_AMOUNT_USD,
  APP_BILLING_TRIAL_DAYS,
  APP_DISPLAY_NAME,
} from "../lib/billing.shared";
import { DEFAULT_MEMBERSHIP_CONFIG } from "../lib/membership.shared";
import styles from "../styles/membership-settings.module.css";

type LoaderConfig = {
  title: string;
  enabled: boolean;
  memberLabel: string;
  savingsLabel: string;
  metafieldSource: MetafieldSource;
  linkedProductMemberPrice: string;
  linkedVariantMemberPrice: string;
  linkedCampaign: string;
};

type LoaderData = {
  config: LoaderConfig;
  discountActive: boolean;
  themeEditorUrl: string | null;
  cardBlockEditorUrl: string | null;
  cartBlockEditorUrl: string | null;
  cardStylesEmbedUrl: string | null;
  themesAdminUrl: string | null;
  productsAdminUrl: string | null;
  cardSetup: ThemeCardSetupGuide | null;
  catalogStatus: MemberPriceCatalogStatus;
  cardSnippetSource: string;
};

type ActionData =
  | { ok: true; discountId: string; synced?: number }
  | { ok: false; error: string }
  | undefined;

type BillingStatus = {
  hasActivePayment: boolean;
  isTest: boolean;
  trialDays: number;
  planName: string | null;
  status: string | null;
};

function readTextFieldValue(event: Event): string {
  const target = event.currentTarget as HTMLElement & { value?: string };
  return typeof target.value === "string" ? target.value : "";
}

function MembershipSettingsPageContent() {
  const {
    config: loaderConfig,
    discountActive: loaderDiscountActive,
    themeEditorUrl,
    cardBlockEditorUrl,
    cartBlockEditorUrl,
    cardStylesEmbedUrl,
    themesAdminUrl,
    productsAdminUrl,
    cardSetup,
    catalogStatus,
    cardSnippetSource,
  } = useLoaderData<LoaderData>();

  const { billingStatus, privacyPolicyUrl } = useOutletContext<{
    billingStatus: BillingStatus;
    privacyPolicyUrl: string;
  }>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isSaving =
    navigation.state === "submitting" && navigation.formMethod === "POST";

  const config = loaderConfig;
  const discountActive = actionData?.ok ? true : loaderDiscountActive;

  const [enabled, setEnabled] = useState(config.enabled);
  const [memberLabel, setMemberLabel] = useState(config.memberLabel);
  const [metafieldSource, setMetafieldSource] = useState<MetafieldSource>(
    config.metafieldSource ?? "app",
  );
  const [linkedProductMemberPrice, setLinkedProductMemberPrice] = useState(
    config.linkedProductMemberPrice,
  );
  const [linkedVariantMemberPrice, setLinkedVariantMemberPrice] = useState(
    config.linkedVariantMemberPrice,
  );
  const [linkedCampaign, setLinkedCampaign] = useState(config.linkedCampaign);
  const [copiedRenderLine, setCopiedRenderLine] = useState(false);
  const [copiedSnippetFile, setCopiedSnippetFile] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [legacyOpen, setLegacyOpen] = useState(false);

  useEffect(() => {
    if (actionData?.ok) {
      const synced = actionData.synced ?? 0;
      shopify.toast.show(
        synced > 0
          ? `Settings saved · synced ${synced} field${synced === 1 ? "" : "s"} for checkout`
          : "Settings saved",
      );
    }
  }, [actionData, shopify]);

  useEffect(() => {
    if (actionData && !actionData.ok) {
      shopify.toast.show(actionData.error, { isError: true });
    }
  }, [actionData, shopify]);

  const snippetLine =
    cardSetup?.snippetLine ??
    "{% render 'member-pricing-card', product: card_product %}";

  const setupCompleted = [
    discountActive,
    enabled,
    catalogStatus.productsWithMemberPrice > 0,
    Boolean(themeEditorUrl),
  ].filter(Boolean).length;

  async function copyText(
    text: string,
    setCopied: (value: boolean) => void,
    label: string,
  ) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      shopify.toast.show(`${label} copied`);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      shopify.toast.show("Could not copy — select the text and copy manually", {
        isError: true,
      });
    }
  }

  return (
    <s-page heading={APP_DISPLAY_NAME}>
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={isSaving}
        {...(isSaving ? { loading: true } : {})}
        onClick={() => {
          if (isSaving) return;
          (
            document.getElementById(
              "membership-settings-form",
            ) as HTMLFormElement | null
          )?.requestSubmit();
        }}
      >
        Save
      </s-button>

      <s-section padding="base">
        <s-stack gap="small-200">
          <s-heading>Membership overview</s-heading>
          <s-paragraph color="subdued">
            Member prices on your storefront, automatic discounts at checkout
            for logged-in customers.
          </s-paragraph>
        </s-stack>

        <s-box paddingBlockStart="base">
          <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <s-stack gap="small-200">
                  <s-text color="subdued">Checkout</s-text>
                  <span className={styles.metricValue}>
                    {discountActive ? "Ready" : "Needs sync"}
                  </span>
                  <s-badge tone={discountActive ? "success" : "warning"}>
                    {discountActive ? "Discount active" : "Save to sync"}
                  </s-badge>
                </s-stack>
              </div>

              <div className={styles.metricCard}>
                <s-stack gap="small-200">
                  <s-text color="subdued">Program</s-text>
                  <span className={styles.metricValue}>
                    {enabled ? "On" : "Off"}
                  </span>
                  <s-badge tone={enabled ? "success" : "neutral"}>
                    {enabled ? "Pricing enabled" : "Pricing disabled"}
                  </s-badge>
                </s-stack>
              </div>

              <div className={styles.metricCard}>
                <s-stack gap="small-200">
                  <s-text color="subdued">Catalog</s-text>
                  <span className={styles.metricValue}>
                    {catalogStatus.productsWithMemberPrice}
                  </span>
                  <s-badge
                    tone={
                      catalogStatus.productsWithMemberPrice > 0
                        ? "success"
                        : "neutral"
                    }
                  >
                    Products with member price
                  </s-badge>
                </s-stack>
              </div>

              <div className={styles.metricCard}>
                <s-stack gap="small-200">
                  <s-text color="subdued">Data source</s-text>
                  <span className={styles.metricValue}>
                    {metafieldSource === "linked" ? "Linked" : "App"}
                  </span>
                  <s-badge>
                    {metafieldSource === "linked"
                      ? "Existing fields"
                      : "MemberPro fields"}
                  </s-badge>
                </s-stack>
              </div>
            </div>
          </div>
        </s-box>
      </s-section>

        <s-section heading="Settings">
        <Form
          method="post"
          id="membership-settings-form"
          onSubmit={(event) => {
            const form = event.currentTarget;
            const field = form.querySelector("#member-label-field") as
              | (HTMLElement & { value?: string })
              | null;
            const nextMemberLabel =
              typeof field?.value === "string" ? field.value.trim() : "";

            if (nextMemberLabel) {
              setMemberLabel(nextMemberLabel);
              const hidden = form.elements.namedItem(
                "memberLabel",
              ) as HTMLInputElement | null;
              if (hidden) hidden.value = nextMemberLabel;
            }
          }}
        >
          <input type="hidden" name="title" value={config.title} />
          <div className={styles.formStack}>
            <input type="hidden" name="enabled" value={enabled ? "on" : ""} />
            <s-checkbox
              label="Enable member pricing"
              checked={enabled}
              onChange={(event: Event) => {
                const target = event.currentTarget as HTMLInputElement & {
                  checked?: boolean;
                };
                setEnabled(Boolean(target.checked));
              }}
            />

            <input type="hidden" name="metafieldSource" value={metafieldSource} />
            <s-choice-list
              label="Price data source"
              onChange={(event: Event) => {
                const target = event.currentTarget as HTMLElement & {
                  values?: string[];
                };
                const next = target.values?.[0];
                if (next === "app" || next === "linked") {
                  setMetafieldSource(next);
                }
              }}
            >
              <s-choice value="app" selected={metafieldSource === "app"}>
                Managed by MemberPro — recommended for most stores. Uses
                MemberPro Member price and Campaign fields.
              </s-choice>
              <s-choice value="linked" selected={metafieldSource === "linked"}>
                Connect existing store fields — enter the namespace.key handles
                for metafields already in your store.
              </s-choice>
            </s-choice-list>

            {metafieldSource === "linked" ? (
              <div className={styles.connectPanel}>
                <s-stack gap="base">
                  <s-heading>Connect metafields</s-heading>
                  <s-banner tone="info" heading="Field requirements">
                    <s-unordered-list>
                      <s-list-item>
                        Product member price — type <strong>Money</strong>
                      </s-list-item>
                      <s-list-item>
                        Variant member price — type <strong>Money</strong>
                      </s-list-item>
                      <s-list-item>
                        Campaign / RRP strike — type{" "}
                        <strong>True or false</strong>
                      </s-list-item>
                      <s-list-item>
                        Definitions must be storefront-visible
                      </s-list-item>
                    </s-unordered-list>
                  </s-banner>

                  <s-paragraph color="subdued">
                    Enter each handle as <strong>namespace.key</strong> from
                    Settings → Custom data (for example{" "}
                    <strong>custom.member_price</strong>).
                  </s-paragraph>

                  <div className={styles.connectFields}>
                    <div className={styles.fieldBlock}>
                      <s-text type="strong">Product member price</s-text>
                      <input
                        className={styles.nativeInput}
                        name="linkedProductMemberPrice"
                        value={linkedProductMemberPrice}
                        onChange={(event) =>
                          setLinkedProductMemberPrice(event.currentTarget.value)
                        }
                        placeholder="custom.member_price"
                        required
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <p className={styles.fieldHelp}>
                        Product metafield · Money type · namespace.key
                      </p>
                    </div>

                    <div className={styles.fieldBlock}>
                      <s-text type="strong">Variant member price</s-text>
                      <input
                        className={styles.nativeInput}
                        name="linkedVariantMemberPrice"
                        value={linkedVariantMemberPrice}
                        onChange={(event) =>
                          setLinkedVariantMemberPrice(event.currentTarget.value)
                        }
                        placeholder="custom.variant_member_price"
                        required
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <p className={styles.fieldHelp}>
                        Variant metafield · Money type · overrides product price
                        when set
                      </p>
                    </div>

                    <div className={styles.fieldBlock}>
                      <s-text type="strong">Campaign (RRP strikethrough)</s-text>
                      <input
                        className={styles.nativeInput}
                        name="linkedCampaign"
                        value={linkedCampaign}
                        onChange={(event) =>
                          setLinkedCampaign(event.currentTarget.value)
                        }
                        placeholder="custom.cross_rrp"
                        required
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <p className={styles.fieldHelp}>
                        Product metafield · True/false · when true, RRP is struck
                        through
                      </p>
                    </div>
                  </div>

                  <s-paragraph color="subdued">
                    Saving connects these fields for storefront pricing. If they
                    use a namespace other than the common custom path, MemberPro
                    also syncs values into app fields so checkout discounts keep
                    working.
                  </s-paragraph>
                </s-stack>
              </div>
            ) : null}

            {/*
              Polaris s-text-field is not always included in FormData on submit.
              Hidden inputs guarantee the current React state is what gets saved.
            */}
            <input type="hidden" name="memberLabel" value={memberLabel} />
            <input
              type="hidden"
              name="savingsLabel"
              value={DEFAULT_MEMBERSHIP_CONFIG.savingsLabel}
            />

            <s-text-field
              id="member-label-field"
              label="Member price label"
              value={memberLabel}
              onInput={(event: Event) => {
                setMemberLabel(readTextFieldValue(event));
              }}
              onChange={(event: Event) => {
                setMemberLabel(readTextFieldValue(event));
              }}
              autocomplete="off"
              details="Shown on product pages and collection cards"
            />

            <s-button
              type="submit"
              variant="primary"
              {...(isSaving ? { loading: true } : {})}
            >
              Save settings
            </s-button>
          </div>
        </Form>
      </s-section>

      <s-section>
        <s-stack gap="base">
          <div className={styles.sectionHeader}>
            <s-stack gap="small-200">
              <s-heading>Setup guide</s-heading>
              <s-paragraph color="subdued">
                {setupCompleted} of 4 checklist signals look ready. Finish the
                steps below to go live.
              </s-paragraph>
            </s-stack>
            <s-button
              variant="tertiary"
              tone="neutral"
              icon={setupOpen ? "chevron-up" : "chevron-down"}
              accessibilityLabel="Toggle setup guide"
              onClick={() => setSetupOpen((open) => !open)}
            />
          </div>

          {setupOpen ? (
            <s-box border="base" borderRadius="base" background="base">
              <s-stack gap="none">
                <s-box padding="base">
                  <div className={styles.stepRow}>
                    <span className={styles.stepNumber}>1</span>
                    <div className={styles.stepBody}>
                      <div className={styles.stepHeader}>
                        <s-heading>Save member pricing settings</s-heading>
                        <s-badge
                          tone={
                            enabled && discountActive ? "success" : "warning"
                          }
                        >
                          {enabled && discountActive ? "Done" : "Action needed"}
                        </s-badge>
                      </div>
                      <s-paragraph color="subdued">
                        Enable the program and choose MemberPro-managed fields
                        or connect your existing metafields.
                      </s-paragraph>
                    </div>
                  </div>
                </s-box>

                <s-divider />

                <s-box padding="base">
                  <div className={styles.stepRow}>
                    <span className={styles.stepNumber}>2</span>
                    <div className={styles.stepBody}>
                      <div className={styles.stepHeader}>
                        <s-heading>Add the product page block</s-heading>
                        <s-badge>Theme</s-badge>
                      </div>
                      <s-paragraph color="subdued">
                        Place MemberPro pricing where the price should appear on
                        the product template.
                      </s-paragraph>
                      {themeEditorUrl ? (
                        <s-link href={themeEditorUrl} target="_blank">
                          Open theme editor
                        </s-link>
                      ) : null}
                    </div>
                  </div>
                </s-box>

                <s-divider />

                <s-box padding="base">
                  <div className={styles.stepRow}>
                    <span className={styles.stepNumber}>3</span>
                    <div className={styles.stepBody}>
                      <div className={styles.stepHeader}>
                        <s-heading>Show prices on collection cards</s-heading>
                        <s-badge>Theme</s-badge>
                      </div>
                      <s-paragraph color="subdued">
                        Add the card block, then enable Card pricing styles in
                        app embeds.
                      </s-paragraph>
                      <div className={styles.linkRow}>
                        {cardBlockEditorUrl ? (
                          <s-link href={cardBlockEditorUrl} target="_blank">
                            Add card block
                          </s-link>
                        ) : null}
                        {cardStylesEmbedUrl ? (
                          <s-link href={cardStylesEmbedUrl} target="_blank">
                            App embeds
                          </s-link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </s-box>

                <s-divider />

                <s-box padding="base">
                  <div className={styles.stepRow}>
                    <span className={styles.stepNumber}>4</span>
                    <div className={styles.stepBody}>
                      <div className={styles.stepHeader}>
                        <s-heading>Set member prices on products</s-heading>
                        <s-badge
                          tone={
                            catalogStatus.productsWithMemberPrice > 0
                              ? "success"
                              : "warning"
                          }
                        >
                          {catalogStatus.productsWithMemberPrice > 0
                            ? `${catalogStatus.productsWithMemberPrice} priced`
                            : "No prices yet"}
                        </s-badge>
                      </div>
                      <s-paragraph color="subdued">
                        {metafieldSource === "linked"
                          ? "Edit prices in the metafields you connected above."
                          : "Set Member price on products/variants. Enable Campaign for RRP strike."}
                      </s-paragraph>
                      {productsAdminUrl ? (
                        <s-link href={productsAdminUrl} target="_blank">
                          Open products
                        </s-link>
                      ) : null}
                    </div>
                  </div>
                </s-box>
              </s-stack>
            </s-box>
          ) : null}

          <s-box border="base" borderRadius="base" background="base">
            <s-box padding="base">
              <div className={styles.sectionHeader}>
                <s-stack gap="small-100">
                  <s-heading>Legacy Dawn / snippet setup</s-heading>
                  <s-paragraph color="subdued">
                    Only for older themes that can’t use the card app block.
                  </s-paragraph>
                </s-stack>
                <s-button
                  variant="tertiary"
                  tone="neutral"
                  icon={legacyOpen ? "chevron-up" : "chevron-down"}
                  accessibilityLabel="Toggle legacy setup"
                  onClick={() => setLegacyOpen((open) => !open)}
                />
              </div>
            </s-box>

            {legacyOpen ? (
              <>
                <s-divider />
                <s-box padding="base">
                  <s-stack gap="base">
                    {cardSetup?.canReadTheme ? (
                      <s-stack direction="inline" gap="small">
                        <s-badge
                          tone={
                            cardSetup.snippetFilePresent ? "success" : "warning"
                          }
                        >
                          {cardSetup.snippetFilePresent
                            ? "Snippet present"
                            : "Snippet missing"}
                        </s-badge>
                        <s-badge
                          tone={
                            cardSetup.renderCallPresent ? "success" : "warning"
                          }
                        >
                          {cardSetup.renderCallPresent
                            ? "card-product updated"
                            : "card-product not updated"}
                        </s-badge>
                      </s-stack>
                    ) : null}

                    <s-ordered-list>
                      <s-list-item>
                        In{" "}
                        {themesAdminUrl ? (
                          <s-link href={themesAdminUrl} target="_blank">
                            Online Store → Themes
                          </s-link>
                        ) : (
                          "Online Store → Themes"
                        )}
                        , open Edit code.
                      </s-list-item>
                      <s-list-item>
                        Add member-pricing-card.liquid under Snippets.
                        <s-box paddingBlockStart="small-200">
                          <s-button
                            type="button"
                            onClick={() =>
                              copyText(
                                cardSnippetSource,
                                setCopiedSnippetFile,
                                "Snippet file",
                              )
                            }
                          >
                            {copiedSnippetFile ? "Copied" : "Copy snippet file"}
                          </s-button>
                        </s-box>
                      </s-list-item>
                      <s-list-item>
                        In{" "}
                        {cardSetup?.filename ?? "snippets/card-product.liquid"},
                        replace{" "}
                        <code className={styles.inlineCode}>
                          {"{% render 'price' %}"}
                        </code>{" "}
                        with:
                        <pre className={styles.codeBlock}>{snippetLine}</pre>
                        <s-box paddingBlockStart="small-200">
                          <s-button
                            type="button"
                            onClick={() =>
                              copyText(
                                snippetLine,
                                setCopiedRenderLine,
                                "Render line",
                              )
                            }
                          >
                            {copiedRenderLine ? "Copied" : "Copy render line"}
                          </s-button>
                        </s-box>
                      </s-list-item>
                      <s-list-item>
                        Enable Card pricing styles
                        {cardStylesEmbedUrl ? (
                          <>
                            {" "}
                            (
                            <s-link href={cardStylesEmbedUrl} target="_blank">
                              open embeds
                            </s-link>
                            )
                          </>
                        ) : null}
                        .
                      </s-list-item>
                    </s-ordered-list>

                    {cartBlockEditorUrl ? (
                      <s-paragraph color="subdued">
                        Cart discounts are automatic. Optional:{" "}
                        <s-link href={cartBlockEditorUrl} target="_blank">
                          open cart template
                        </s-link>
                        .
                      </s-paragraph>
                    ) : null}
                  </s-stack>
                </s-box>
              </>
            ) : null}
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Plan & details">
        <div className={styles.infoGrid}>
          <s-box padding="base" border="base" borderRadius="base" background="base">
            <s-stack gap="small">
              <s-heading>Plan</s-heading>
              <s-paragraph>
                <s-text type="strong">${APP_BILLING_AMOUNT_USD}/month</s-text>{" "}
                after a {APP_BILLING_TRIAL_DAYS}-day free trial.
              </s-paragraph>
              {billingStatus.hasActivePayment && billingStatus.planName ? (
                <s-paragraph color="subdued">
                  Current plan: {billingStatus.planName}
                </s-paragraph>
              ) : null}
              <s-link href={privacyPolicyUrl} target="_blank">
                Privacy policy
              </s-link>
            </s-stack>
          </s-box>

          <s-box padding="base" border="base" borderRadius="base" background="base">
            <s-stack gap="small">
              <s-heading>How it works</s-heading>
              <s-unordered-list>
                <s-list-item>Logged-in customers get member pricing.</s-list-item>
                <s-list-item>
                  Variant member price overrides product member price.
                </s-list-item>
                <s-list-item>
                  Use MemberPro fields, or connect your own definitions.
                </s-list-item>
                <s-list-item>
                  Checkout discounts apply automatically — no cart snippet
                  required.
                </s-list-item>
              </s-unordered-list>
            </s-stack>
          </s-box>
        </div>
      </s-section>
    </s-page>
  );
}

export default function MembershipSettingsPage() {
  const { config } = useLoaderData<LoaderData>();
  const configSyncKey = useMemo(
    () =>
      [
        config.enabled,
        config.memberLabel,
        config.metafieldSource ?? "app",
        config.linkedProductMemberPrice,
        config.linkedVariantMemberPrice,
        config.linkedCampaign,
      ].join("|"),
    [
      config.enabled,
      config.memberLabel,
      config.metafieldSource,
      config.linkedProductMemberPrice,
      config.linkedVariantMemberPrice,
      config.linkedCampaign,
    ],
  );

  return <MembershipSettingsPageContent key={configSyncKey} />;
}
