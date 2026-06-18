import { useEffect, useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import type { MembershipConfig } from "../lib/membership.shared";
import styles from "../styles/membership-settings.module.css";

type LoaderData = {
  config: MembershipConfig;
  discountActive: boolean;
  themeEditorUrl: string | null;
};

type ActionData =
  | { ok: true; discountId: string }
  | { ok: false; error: string }
  | undefined;

export default function MembershipSettingsPage() {
  const {
    config: loaderConfig,
    discountActive: loaderDiscountActive,
    themeEditorUrl,
  } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isSaving =
    navigation.state === "submitting" && navigation.formMethod === "POST";

  const config = loaderConfig;
  const discountActive = actionData?.ok ? true : loaderDiscountActive;

  const [enabled, setEnabled] = useState(config.enabled);
  const [memberLabel, setMemberLabel] = useState(config.memberLabel);
  const [savingsLabel, setSavingsLabel] = useState(config.savingsLabel);

  useEffect(() => {
    setEnabled(config.enabled);
    setMemberLabel(config.memberLabel);
    setSavingsLabel(config.savingsLabel);
  }, [config.enabled, config.memberLabel, config.savingsLabel]);

  useEffect(() => {
    if (actionData?.ok) {
      shopify.toast.show("Settings saved");
    }
  }, [actionData?.ok, shopify]);

  useEffect(() => {
    if (actionData && !actionData.ok) {
      shopify.toast.show(actionData.error, { isError: true });
    }
  }, [actionData, shopify]);

  return (
    <s-page heading="Member pricing">
      <s-button
        slot="primary-action"
        variant="primary"
        type="submit"
        form="membership-settings-form"
        {...(isSaving ? { loading: true } : {})}
      >
        Save
      </s-button>

      <div className={styles.page}>
        <s-section heading="Program">
          <div className={styles.statusRow}>
            <span
              className={`${styles.badge} ${
                discountActive ? styles.badgeActive : styles.badgeInactive
              }`}
            >
              {discountActive ? "Checkout discount active" : "Discount not synced"}
            </span>
            <span
              className={`${styles.badge} ${
                enabled ? styles.badgeActive : styles.badgeInactive
              }`}
            >
              {enabled ? "Pricing enabled" : "Pricing disabled"}
            </span>
          </div>
          <p className={`${styles.hint} ${styles.hintTop} ${styles.hintBottom}`}>
            Logged-in customers get member prices at checkout. Set member prices
            on products and variants using the Member price metafield. Enable the
            Campaign metafield on a product to show RRP with a strikethrough.
          </p>
          {themeEditorUrl ? (
            <s-stack direction="inline" gap="base">
              <s-link href={themeEditorUrl} target="_blank">
                Add blocks in theme editor
              </s-link>
            </s-stack>
          ) : null}
        </s-section>

        <s-section heading="Display labels">
          <Form method="post" id="membership-settings-form">
            <input type="hidden" name="title" value={config.title} />
            <div className={styles.fieldStack}>
              <label className={styles.toggleRow}>
                <input
                  name="enabled"
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.currentTarget.checked)}
                />
                <span className={styles.toggleLabel}>
                  Enable member pricing
                </span>
              </label>

              <s-text-field
                name="memberLabel"
                label="Member price label"
                value={memberLabel}
                onChange={(event) => setMemberLabel(event.currentTarget.value)}
                autocomplete="off"
              />

              <s-text-field
                name="savingsLabel"
                label="Savings label"
                value={savingsLabel}
                onChange={(event) => setSavingsLabel(event.currentTarget.value)}
                autocomplete="off"
                details="Shown on discounted cart lines at checkout"
              />

              <s-button
                type="submit"
                variant="primary"
                {...(isSaving ? { loading: true } : {})}
              >
                Save
              </s-button>
            </div>
          </Form>
        </s-section>
      </div>

      <s-section slot="aside" heading="How it works">
        <s-unordered-list>
          <s-list-item>
            Any logged-in customer is treated as a Level 1 member.
          </s-list-item>
          <s-list-item>
            Variant member price overrides product member price.
          </s-list-item>
          <s-list-item>
            Product page: Apps → Member pricing. Product cards: open a collection
            in the theme editor, click a product card, then Apps → Member pricing
            (card). Or add the member-pricing-card snippet to your theme card
            template. Cart: Apps → Member pricing (cart).
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
