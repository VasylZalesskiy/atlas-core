const allowedOrigin = 'https://ovi-order-system.vercel.app';

function env(name) {
  return String(process.env[name] || '').trim();
}

async function rest(path, url, key) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.hint || text || `HTTP ${response.status}`);
  }

  return data || [];
}

export default async function handler(req, res) {
  const requestOrigin = String(req.headers.origin || '');
  if (requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method-not-allowed' });

  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
  const key =
    env('SUPABASE_PUBLISHABLE_KEY') ||
    env('SUPABASE_ANON_KEY') ||
    env('VITE_SUPABASE_PUBLISHABLE_KEY') ||
    env('VITE_SUPABASE_ANON_KEY');

  if (!url || !key) {
    return res.status(503).json({ error: 'atlas-catalog-config-unavailable' });
  }

  try {
    const [groups, items] = await Promise.all([
      rest(
        'atlas_need_groups?select=group_key,name_uk,name_en,icon,is_active,sort_order&is_active=eq.true&order=sort_order.asc,name_uk.asc',
        url,
        key,
      ),
      rest(
        'atlas_need_items?select=group_key,item_key,name_uk,name_en,icon,unit,is_active,sort_order,canonical_code,family_code,updated_at&is_active=eq.true&canonical_code=not.is.null&order=sort_order.asc,name_uk.asc',
        url,
        key,
      ),
    ]);

    const groupByKey = new Map(groups.map((group) => [group.group_key, group]));
    const candidates = items
      .filter((item) => String(item.canonical_code || '').trim())
      .map((item) => {
        const group = groupByKey.get(item.group_key) || null;
        return {
          item_key: item.item_key,
          name_uk: item.name_uk,
          name_en: item.name_en || '',
          icon: item.icon || '📦',
          unit: item.unit || 'шт',
          canonical_code: String(item.canonical_code || '').trim().toUpperCase(),
          family_code: String(item.family_code || '').trim().toUpperCase() || null,
          group_key: item.group_key,
          group_name_uk: group?.name_uk || '',
          group_name_en: group?.name_en || '',
          updated_at: item.updated_at || null,
        };
      });

    return res.status(200).json({
      source: 'atlas',
      generated_at: new Date().toISOString(),
      count: candidates.length,
      items: candidates,
    });
  } catch (error) {
    return res.status(502).json({
      error: 'atlas-catalog-unavailable',
      message: String(error?.message || error),
    });
  }
}
