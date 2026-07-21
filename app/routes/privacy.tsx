import type { MetaFunction } from "react-router";
import { Link } from "react-router";

import {
  APP_DISPLAY_NAME,
  APP_TAGLINE,
  PRIVACY_POLICY_PATH,
} from "../lib/billing.shared";
import styles from "../styles/legal.module.css";

const SUPPORT_EMAIL =
  process.env.APP_SUPPORT_EMAIL || "support@example.com";

export const meta: MetaFunction = () => [
  { title: `Privacy Policy — ${APP_DISPLAY_NAME}` },
  {
    name: "description",
    content: `Privacy policy for the ${APP_DISPLAY_NAME} Shopify app.`,
  },
];

export default function PrivacyPolicyPage() {
  const effectiveDate = "July 21, 2026";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.homeLink}>
          ← {APP_DISPLAY_NAME}
        </Link>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.subtitle}>{APP_TAGLINE}</p>
        <p className={styles.meta}>Effective date: {effectiveDate}</p>
      </header>

      <main className={styles.content}>
        <section>
          <h2>Overview</h2>
          <p>
            {APP_DISPLAY_NAME} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
            is a Shopify application that helps merchants offer member pricing on
            their storefront and apply member discounts at checkout. This policy
            explains what information we collect, how we use it, and the choices
            merchants have.
          </p>
        </section>

        <section>
          <h2>Information we collect</h2>
          <h3>Merchant and store data</h3>
          <ul>
            <li>
              Shopify store domain, OAuth access tokens, and session data
              required to operate the app inside Shopify Admin.
            </li>
            <li>
              Product and variant data, metafields, discount configuration, and
              theme-related setup status needed to display member prices and
              apply checkout discounts.
            </li>
            <li>
              Optional order analytics when the merchant enables order webhooks
              (for example, orders that used a MemberPro discount).
            </li>
          </ul>
          <h3>Customer data</h3>
          <p>
            The app processes customer login state on the storefront to determine
            whether member pricing and discounts apply. We do not require customers
            to create accounts with {APP_DISPLAY_NAME}. Customer data processed
            through Shopify (such as cart and checkout information) is handled
            according to Shopify&apos;s platform policies and the merchant&apos;s
            own privacy practices.
          </p>
        </section>

        <section>
          <h2>How we use information</h2>
          <ul>
            <li>Provide, maintain, and improve app functionality.</li>
            <li>Sync member pricing settings, discounts, and theme extensions.</li>
            <li>Respond to support requests and troubleshoot issues.</li>
            <li>Comply with legal obligations and Shopify platform requirements.</li>
          </ul>
          <p>
            We do not sell merchant or customer personal information. We do not use
            store data for advertising unrelated to operating the app.
          </p>
        </section>

        <section>
          <h2>Data storage and retention</h2>
          <p>
            Session and configuration data are stored on secure infrastructure used
            to host the app. When a merchant uninstalls the app, Shopify session
            data for that store is removed via the app/uninstalled webhook. Shop
            data is deleted when Shopify sends a shop/redact compliance webhook.
          </p>
        </section>

        <section>
          <h2>Data sharing</h2>
          <p>
            We share data only with service providers that help us host and operate
            the app (for example, cloud hosting and database providers), and only
            to the extent necessary to provide the service. We may disclose
            information if required by law or to protect our rights and users.
          </p>
        </section>

        <section>
          <h2>Merchant privacy obligations</h2>
          <p>
            Merchants are responsible for informing their customers about how
            member pricing works and for maintaining their own store privacy
            policies. {APP_DISPLAY_NAME} acts as a service provider to the
            merchant.
          </p>
        </section>

        <section>
          <h2>GDPR and data subject requests</h2>
          <p>
            We support Shopify&apos;s mandatory compliance webhooks, including
            customers/data_request, customers/redact, and shop/redact. Merchants
            can contact us regarding data subject requests related to information
            processed by the app.
          </p>
        </section>

        <section>
          <h2>Security</h2>
          <p>
            We use industry-standard measures to protect data in transit (HTTPS/TLS)
            and at rest. Access to production systems is restricted to authorized
            personnel.
          </p>
        </section>

        <section>
          <h2>Changes to this policy</h2>
          <p>
            We may update this policy from time to time. We will post the revised
            version at this URL and update the effective date above.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions about this privacy policy or data practices can be sent to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          <Link to="/">{APP_DISPLAY_NAME}</Link>
          {" · "}
          <Link to={PRIVACY_POLICY_PATH}>Privacy Policy</Link>
        </p>
      </footer>
    </div>
  );
}
