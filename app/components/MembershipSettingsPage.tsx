import { useEffect, useState } from "react";

import { Form, useActionData, useLoaderData, useNavigation } from "react-router";

import { useAppBridge } from "@shopify/app-bridge-react";



import type { MembershipConfig } from "../lib/membership.shared";

import type { MemberPriceCatalogStatus } from "../lib/membership-products.server";

import type { ThemeCardSetupGuide } from "../lib/theme-card-install.server";

import styles from "../styles/membership-settings.module.css";



type LoaderData = {

  config: MembershipConfig;

  discountActive: boolean;

  themeEditorUrl: string | null;

  cardBlockEditorUrl: string | null;

  cardStylesEmbedUrl: string | null;

  themesAdminUrl: string | null;

  productsAdminUrl: string | null;

  cardSetup: ThemeCardSetupGuide | null;

  catalogStatus: MemberPriceCatalogStatus;

  cardSnippetSource: string;

  appProxyTestUrl: string | null;

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

    cardBlockEditorUrl,

    cardStylesEmbedUrl,

    themesAdminUrl,

    productsAdminUrl,

    cardSetup,

    catalogStatus,

    cardSnippetSource,

    appProxyTestUrl,

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

  const [copiedRenderLine, setCopiedRenderLine] = useState(false);

  const [copiedSnippetFile, setCopiedSnippetFile] = useState(false);



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



  const snippetLine =

    cardSetup?.snippetLine ??

    "{% render 'member-pricing-card', product: card_product %}";



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



  const hasCatalogPrices = catalogStatus.productsWithMemberPrice > 0;



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

                Add product page block

              </s-link>

            </s-stack>

          ) : null}

        </s-section>



        <s-section heading="Product cards">

          <div className={styles.statusRow}>

            <span

              className={`${styles.badge} ${

                hasCatalogPrices ? styles.badgeActive : styles.badgeInactive

              }`}

            >

              {hasCatalogPrices

                ? `${catalogStatus.productsWithMemberPrice} product${

                    catalogStatus.productsWithMemberPrice === 1 ? "" : "s"

                  } with member prices`

                : "No member prices on products yet"}

            </span>

          </div>



          <p className={`${styles.hint} ${styles.hintTop}`}>

            Cards show stacked <strong>RRP</strong> and <strong>Member</strong>{" "}

            prices only when a product has a Member price metafield lower than

            its regular price. If you only see the normal theme price, set

            member prices on products first.

          </p>



          {productsAdminUrl ? (

            <p className={styles.metaLine}>

              <s-link href={productsAdminUrl} target="_blank">

                Open products

              </s-link>

              {" · "}

              Edit a product → Metafields → Member price

            </p>

          ) : null}



          <h3 className={styles.methodHeading}>Recommended — app block</h3>

          <p className={styles.hint}>

            Works on Online Store 2.0 themes without editing theme code. The app

            never modifies your theme files automatically.

          </p>

          <ol className={styles.steps}>

            <li>

              {cardBlockEditorUrl ? (

                <s-link href={cardBlockEditorUrl} target="_blank">

                  Open your collection page in the theme editor

                </s-link>

              ) : (

                "Open your collection page in the theme editor"

              )}

              .

            </li>

            <li>

              Click a <strong>product card</strong> in the preview, then{" "}

              <strong>Add block</strong> → <strong>Member pricing (card)</strong>

              . Place it where the price should appear (usually below the

              title).

            </li>

            <li>

              Remove or hide the theme&apos;s default price block on that card if

              both prices show.

            </li>

            <li>
              Enable the <strong>Card pricing styles</strong> app embed (loads CSS and
              fetches member prices for product cards):{" "}
              {cardStylesEmbedUrl ? (
                <s-link href={cardStylesEmbedUrl} target="_blank">
                  Theme settings → App embeds → Card pricing styles
                </s-link>
              ) : (
                "Theme settings → App embeds → Card pricing styles"
              )}
            </li>

            <li>Save the theme and refresh a collection page.</li>

          </ol>



          <h3 className={styles.methodHeading}>

            Legacy themes (Dawn and snippet-based cards)

          </h3>

          <p className={styles.hint}>

            Yes — for Dawn and similar themes, the snippet in card-product.liquid

            is the right approach. The snippet alone cannot read app metafields

            from theme code, so it shows a regular price first, then the{" "}

            <strong>Card pricing styles</strong> app embed loads member prices from

            the app (via <code className={styles.inlineCodeInline}>/apps/membership-pricing/prices</code>

            ). You need <strong>both</strong>: the snippet in the theme + the app

            embed enabled + the app deployed.

          </p>

          {appProxyTestUrl ? (
            <p className={styles.metaLine}>
              Test pricing API:{" "}
              <s-link href={appProxyTestUrl} target="_blank">
                open proxy response
              </s-link>
              {" "}
              (should return JSON with memberCents &gt; 0 for that product)
            </p>
          ) : null}



          {cardSetup?.canReadTheme ? (

            <div className={styles.statusRow}>

              <span

                className={`${styles.badge} ${

                  cardSetup.snippetFilePresent

                    ? styles.badgeActive

                    : styles.badgeInactive

                }`}

              >

                {cardSetup.snippetFilePresent

                  ? "Snippet file in theme"

                  : "Snippet file missing"}

              </span>

              <span

                className={`${styles.badge} ${

                  cardSetup.renderCallPresent

                    ? styles.badgeActive

                    : styles.badgeInactive

                }`}

              >

                {cardSetup.renderCallPresent

                  ? "card-product.liquid updated"

                  : "card-product.liquid not updated"}

              </span>

            </div>

          ) : null}



          <ol className={styles.steps}>

            <li>

              In Shopify admin go to{" "}

              {themesAdminUrl ? (

                <s-link href={themesAdminUrl} target="_blank">

                  Online Store → Themes

                </s-link>

              ) : (

                "Online Store → Themes"

              )}

              , click <strong>⋯</strong> on your live theme →{" "}

              <strong>Edit code</strong>.

            </li>

            <li>

              Under <strong>Snippets</strong>, add{" "}

              <strong>member-pricing-card.liquid</strong> and paste the snippet

              file below, then save.

              <div className={styles.actionRow}>

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

              </div>

            </li>

            <li>

              Open{" "}

              <strong>{cardSetup?.filename ?? "snippets/card-product.liquid"}</strong>

              {cardSetup?.themeCodeEditorUrl ? (

                <>

                  {" "}

                  (

                  <s-link href={cardSetup.themeCodeEditorUrl} target="_blank">

                    direct link

                  </s-link>

                  )

                </>

              ) : null}

              . <strong>Replace</strong> the default{" "}

              <code className={styles.inlineCodeInline}>

                {"{% render 'price' %}"}

              </code>{" "}

              line with:

              <pre className={styles.codeBlock}>{snippetLine}</pre>

              <div className={styles.actionRow}>

                <s-button

                  type="button"

                  onClick={() =>

                    copyText(snippetLine, setCopiedRenderLine, "Render line")

                  }

                >

                  {copiedRenderLine ? "Copied" : "Copy render line"}

                </s-button>

              </div>

            </li>

            <li>

              Enable the <strong>Card pricing styles</strong> app embed (same as

              above).

            </li>

          </ol>



          <p className={`${styles.hint} ${styles.hintTop}`}>

            This app only reads your theme to show setup status. It does not push

            or change theme files on your store unless you edit the theme

            yourself.

          </p>

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

            Product page: add the Member pricing block in the theme editor.

          </s-list-item>

          <s-list-item>

            Product cards: add the Member pricing (card) app block, or use the

            legacy snippet on Dawn-style themes.

          </s-list-item>

        </s-unordered-list>

      </s-section>

    </s-page>

  );

}

