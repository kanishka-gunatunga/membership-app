import type { LoaderFunctionArgs } from "react-router";
import { Link, redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import {
  APP_DISPLAY_NAME,
  APP_TAGLINE,
  APP_BILLING_AMOUNT_USD,
  APP_BILLING_TRIAL_DAYS,
  PRIVACY_POLICY_PATH,
} from "../../lib/billing.shared";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>{APP_DISPLAY_NAME}</h1>
        <p className={styles.text}>{APP_TAGLINE}</p>
        <p className={styles.pricing}>
          ${APP_BILLING_AMOUNT_USD}/month · {APP_BILLING_TRIAL_DAYS}-day free trial
        </p>

        {showForm ? (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g. my-shop.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        ) : null}

        <ul className={styles.list}>
          <li>
            <strong>Storefront member pricing</strong>. Show member prices on
            product pages and collection cards for logged-in customers.
          </li>
          <li>
            <strong>Automatic checkout discounts</strong>. Apply member discounts
            at checkout with a Shopify discount function — no manual cart edits.
          </li>
          <li>
            <strong>Theme app extensions</strong>. Guided setup with deep links to
            the theme editor for app blocks and embeds.
          </li>
        </ul>

        <p className={styles.legalLinks}>
          <Link to={PRIVACY_POLICY_PATH}>Privacy policy</Link>
        </p>
      </div>
    </div>
  );
}
