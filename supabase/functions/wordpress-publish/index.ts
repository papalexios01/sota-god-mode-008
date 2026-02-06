import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PublishRequest {
  wpUrl: string;
  username: string;
  appPassword: string;
  title: string;
  content: string;
  excerpt?: string;
  status?: string;
  categories?: number[];
  tags?: number[];
  slug?: string;
  metaDescription?: string;
  seoTitle?: string;
  sourceUrl?: string;
  existingPostId?: number | string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let payload: PublishRequest;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
    }

    const {
      wpUrl,
      username,
      appPassword,
      title,
      content,
      excerpt,
      status = "draft",
      categories,
      tags,
      slug,
      metaDescription,
      seoTitle,
      sourceUrl,
      existingPostId,
    } = payload;

    if (!wpUrl || !username || !appPassword || !title || !content) {
      return jsonResponse({
        success: false,
        error:
          "Missing required fields: wpUrl, username, appPassword, title, content",
      }, 400);
    }

    let baseUrl = wpUrl.trim().replace(/\/+$/, "");
    if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    }

    const apiUrl = `${baseUrl}/wp-json/wp/v2/posts`;
    const authBase64 = btoa(`${username}:${appPassword}`);

    const authHeaders: Record<string, string> = {
      Authorization: `Basic ${authBase64}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const wpFetch = async (
      url: string,
      options: RequestInit = {},
    ): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let targetPostId: number | null = existingPostId
      ? parseInt(String(existingPostId), 10)
      : null;
    if (targetPostId !== null && isNaN(targetPostId)) targetPostId = null;

    if (!targetPostId && slug) {
      try {
        const cleanSlug =
          slug.replace(/^\/+|\/+$/g, "").split("/").pop() || slug;
        const searchUrl =
          `${apiUrl}?slug=${encodeURIComponent(cleanSlug)}&status=any`;
        const searchRes = await wpFetch(searchUrl, { headers: authHeaders });
        if (searchRes.ok) {
          const posts = await searchRes.json();
          if (Array.isArray(posts) && posts.length > 0) {
            targetPostId = posts[0].id;
          }
        }
      } catch {
        // slug search failed, proceed with create
      }
    }

    if (!targetPostId && sourceUrl) {
      try {
        const pathMatch = sourceUrl.match(/\/([^\/]+)\/?$/);
        if (pathMatch) {
          const sourceSlug = pathMatch[1].replace(/\/$/, "");
          const searchUrl =
            `${apiUrl}?slug=${encodeURIComponent(sourceSlug)}&status=any`;
          const searchRes = await wpFetch(searchUrl, { headers: authHeaders });
          if (searchRes.ok) {
            const posts = await searchRes.json();
            if (Array.isArray(posts) && posts.length > 0) {
              targetPostId = posts[0].id;
            }
          }
        }
      } catch {
        // sourceUrl search failed, proceed with create
      }
    }

    const postData: Record<string, unknown> = { title, content, status };

    if (excerpt) postData.excerpt = excerpt;
    if (slug) {
      postData.slug =
        slug.replace(/^\/+|\/+$/g, "").split("/").pop() || slug;
    }
    if (categories && categories.length > 0) postData.categories = categories;
    if (tags && tags.length > 0) postData.tags = tags;

    if (metaDescription || seoTitle) {
      postData.meta = {
        _yoast_wpseo_metadesc: metaDescription || "",
        _yoast_wpseo_title: seoTitle || title,
        rank_math_description: metaDescription || "",
        rank_math_title: seoTitle || title,
        _aioseo_description: metaDescription || "",
        _aioseo_title: seoTitle || title,
      };
    }

    const targetUrl = targetPostId ? `${apiUrl}/${targetPostId}` : apiUrl;
    const method = targetPostId ? "PUT" : "POST";

    let response: Response;
    try {
      response = await wpFetch(targetUrl, {
        method,
        headers: authHeaders,
        body: JSON.stringify(postData),
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      const isTimeout = msg.includes("abort") || msg.includes("timeout");
      return jsonResponse({
        success: false,
        error: isTimeout
          ? "Connection to WordPress timed out after 60s. Check URL and site availability."
          : `Could not connect to WordPress: ${msg}`,
        status: isTimeout ? 504 : 502,
      }, isTimeout ? 504 : 502);
    }

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `WordPress API error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // not JSON
      }

      if (response.status === 401) {
        errorMessage =
          "Authentication failed. Check your username and application password.";
      } else if (response.status === 403) {
        errorMessage =
          "Permission denied. Ensure the user has publish capabilities.";
      } else if (response.status === 404) {
        errorMessage =
          "WordPress REST API not found. Ensure permalinks are enabled and REST API is accessible.";
      }

      return jsonResponse({
        success: false,
        error: errorMessage,
        status: response.status,
      });
    }

    let post: {
      id: number;
      link: string;
      status: string;
      title?: { rendered: string };
      slug: string;
    };
    try {
      post = JSON.parse(responseText);
    } catch {
      return jsonResponse({
        success: false,
        error: "Invalid response from WordPress",
      });
    }

    return jsonResponse({
      success: true,
      updated: !!targetPostId,
      post: {
        id: post.id,
        url: post.link,
        status: post.status,
        title: post.title?.rendered || title,
        slug: post.slug,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ success: false, error: msg }, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
