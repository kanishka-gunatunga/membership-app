import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { authenticate } from "../shopify.server";

import {
  getThemeCodeEditorUrl,
  getThemesAdminUrl,
  loadMainTheme,
} from "./theme-admin-urls.server";

type AdminClient = Awaited<
  ReturnType<typeof authenticate.admin>
>["admin"];

export const SNIPPET_MARKER = "member-pricing-card";

const CARD_SNIPPET_CANDIDATES = [
  "snippets/card-product.liquid",
  "snippets/product-card.liquid",
  "snippets/card.liquid",
  "snippets/product-card-grid.liquid",
];

const THEME_FILES_QUERY = `#graphql
  query ThemeCardFiles($themeId: ID!, $filenames: [String!]!) {
    theme(id: $themeId) {
      files(filenames: $filenames) {
        nodes {
          filename
          body {
            ... on OnlineStoreThemeFileBodyText {
              content
            }
          }
        }
      }
    }
  }
`;

export const SNIPPET_FILENAME = "snippets/member-pricing-card.liquid";

export type ThemeCardSetupGuide = {
  canReadTheme: boolean;
  installed: boolean;
  snippetFilePresent: boolean;
  renderCallPresent: boolean;
  themeName: string | null;
  themeId: string | null;
  filename: string | null;
  productVariable: string;
  snippetLine: string;
  themeCodeEditorUrl: string | null;
  snippetFileEditorUrl: string | null;
  themesAdminUrl: string | null;
};

function detectProductVariable(content: string): string {
  if (/\bcard_product\b/.test(content)) return "card_product";
  if (/\bproduct_ref\b/.test(content)) return "product_ref";
  if (/\bitem\b/.test(content)) return "item";
  return "product";
}

export function buildSnippetLine(productVariable: string): string {
  return `{% render '${SNIPPET_MARKER}', product: ${productVariable} %}`;
}

export function getCardSnippetSource(): string {
  return readFileSync(
    join(
      process.cwd(),
      "extensions/member-pricing-theme/snippets/member-pricing-card.liquid",
    ),
    "utf8",
  );
}

function isInstalled(content: string): boolean {
  return content.includes(SNIPPET_MARKER);
}

export async function getThemeCardSetupGuide(
  admin: AdminClient,
  shop: string,
): Promise<ThemeCardSetupGuide> {
  const defaultVariable = "card_product";
  const defaultFilename = "snippets/card-product.liquid";
  const themesAdminUrl = getThemesAdminUrl(shop);

  const fallback: ThemeCardSetupGuide = {
    canReadTheme: false,
    installed: false,
    snippetFilePresent: false,
    renderCallPresent: false,
    themeName: null,
    themeId: null,
    filename: defaultFilename,
    productVariable: defaultVariable,
    snippetLine: buildSnippetLine(defaultVariable),
    themeCodeEditorUrl: null,
    snippetFileEditorUrl: null,
    themesAdminUrl,
  };

  try {
    const theme = await loadMainTheme(admin);

    if (!theme?.id) {
      return fallback;
    }

    const filesResponse = await admin.graphql(THEME_FILES_QUERY, {
      variables: {
        themeId: theme.id,
        filenames: [...CARD_SNIPPET_CANDIDATES, SNIPPET_FILENAME],
      },
    });
    const filesJson = await filesResponse.json();
    const fileNodes = filesJson.data?.theme?.files?.nodes ?? [];
    const cardFile = fileNodes.find(
      (node: { filename: string; body?: { content?: string } }) =>
        CARD_SNIPPET_CANDIDATES.includes(node.filename) && node.body?.content,
    );
    const memberSnippetFile = fileNodes.find(
      (node: { filename: string; body?: { content?: string } }) =>
        node.filename === SNIPPET_FILENAME && node.body?.content,
    );

    const filename = cardFile?.filename ?? defaultFilename;
    const content = cardFile?.body?.content as string | undefined;
    const productVariable = content
      ? detectProductVariable(content)
      : defaultVariable;
    const renderCallPresent = content ? isInstalled(content) : false;
    const snippetFilePresent = Boolean(memberSnippetFile?.body?.content);

    return {
      canReadTheme: true,
      installed: renderCallPresent && snippetFilePresent,
      snippetFilePresent,
      renderCallPresent,
      themeName: theme.name,
      themeId: theme.id,
      filename,
      productVariable,
      snippetLine: buildSnippetLine(productVariable),
      themeCodeEditorUrl: getThemeCodeEditorUrl(shop, filename, theme.id),
      snippetFileEditorUrl: getThemeCodeEditorUrl(
        shop,
        SNIPPET_FILENAME,
        theme.id,
      ),
      themesAdminUrl,
    };
  } catch {
    return fallback;
  }
}
