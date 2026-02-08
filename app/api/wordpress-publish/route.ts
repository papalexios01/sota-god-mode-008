import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      wpUrl,
      username,
      appPassword,
      title,
      content,
      excerpt,
      status = 'draft',
      slug,
      metaDescription,
      seoTitle,
      sourceUrl,
      existingPostId,
    } = body;

    if (!wpUrl || !username || !appPassword) {
      return NextResponse.json(
        { success: false, error: 'WordPress not configured on server' },
        { status: 400 }
      );
    }

    const base = wpUrl.startsWith('http') ? wpUrl : `https://${wpUrl}`;
    const cleanBase = base.replace(/\/+$/, '');
    const endpoint = `${cleanBase}/wp-json/wp/v2/posts${
      existingPostId ? `/${existingPostId}` : ''
    }`;

    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

    const wpBody: Record<string, unknown> = {
      title,
      content,
      status,
      excerpt,
      slug,
    };

    // Map metaDescription/seoTitle/sourceUrl into post meta if needed
    if (metaDescription || seoTitle || sourceUrl) {
      wpBody.meta = {
        ...(wpBody.meta as Record<string, unknown> | undefined),
        _sota_meta_description: metaDescription,
        _sota_seo_title: seoTitle,
        _sota_source_url: sourceUrl,
      };
    }

    const wpRes = await fetch(endpoint, {
      method: existingPostId ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(wpBody),
    });

    const json = await wpRes.json().catch(() => ({}));

    if (!wpRes.ok) {
      const message =
        (json && (json.message || json.error)) ||
        `WordPress REST error (status ${wpRes.status})`;
      return NextResponse.json(
        { success: false, error: message, status: wpRes.status },
        { status: wpRes.status }
      );
    }

    return NextResponse.json({ success: true, post: json }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { success: false, error: msg || 'Unexpected server error' },
      { status: 500 }
    );
  }
}
