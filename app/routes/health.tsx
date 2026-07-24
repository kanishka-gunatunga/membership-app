import type { LoaderFunctionArgs } from "react-router";

/** Load balancer / uptime probe — no auth required. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  return Response.json(
    { ok: true, service: "memberpro-app" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
};
