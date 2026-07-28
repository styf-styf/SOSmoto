const { createClient } = require('@supabase/supabase-js');
const { notFoundPage, renderPreviewPage } = require('./_lib/previewPage');

// Dispatcher único para las 4 páginas de vista previa de contenido
// compartido (post/producto/servicio/anuncio) -- antes eran 4 funciones
// serverless separadas (post/[id].js, product/[id].js, service/[id].js,
// ad/[id].js), consolidadas acá para no superar el límite de 12 funciones
// del plan Hobby de Vercel (ver vercel.json: /post/:id, /product/:id, etc.
// reescriben a /api/content?type=...&id=...). Comportamiento idéntico al de
// cada función original, solo movido a un solo archivo.
function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Mismo orden de prioridad que getPostTag() en services/posts.ts.
function resolveTag(post) {
  if (post.tag_business) return { label: post.tag_business.name };
  if (post.tag_client) return { label: post.tag_client.full_name };
  if (post.tag_service) return { label: post.tag_service.name };
  if (post.tag_product) return { label: post.tag_product.name };
  return null;
}

async function renderPost(supabase, id, res) {
  const [{ data: post }, { data: comments }] = await Promise.all([
    supabase
      .from('posts')
      .select(
        `id, caption, photos,
         author_business:businesses!posts_business_id_fkey(name, logo_url),
         author_client:users!posts_client_id_fkey(full_name, avatar_url),
         tag_business:businesses!posts_tag_business_id_fkey(name),
         tag_client:users!posts_tag_client_id_fkey(full_name),
         tag_service:services!posts_tag_service_id_fkey(name),
         tag_product:products!posts_tag_product_id_fkey(name)`
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('post_comments')
      .select('body, users(full_name, avatar_url)')
      .eq('post_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!post) {
    res.status(404).send(notFoundPage('Esta publicación ya no está disponible.'));
    return;
  }

  const authorName = post.author_business?.name ?? post.author_client?.full_name ?? 'Usuario';
  const authorAvatar = post.author_business?.logo_url ?? post.author_client?.avatar_url ?? null;
  const caption = post.caption || `Publicación de ${authorName} en SOSmoto`;
  const images = Array.isArray(post.photos) ? post.photos : [];
  const universalLink = `https://sosmoto.net/post/${post.id}`;
  const appLink = `sosmoto://post/${post.id}`;
  const commentList = (comments ?? []).map((c) => ({
    authorName: c.users?.full_name ?? 'Usuario',
    avatarUrl: c.users?.avatar_url ?? null,
    body: c.body,
  }));

  res.status(200).send(
    renderPreviewPage({
      authorName,
      authorAvatar,
      description: post.caption || null,
      images,
      tag: resolveTag(post),
      comments: commentList,
      appLink,
      og: { title: `${authorName} en SOSmoto`, description: caption, url: universalLink, type: 'article' },
    })
  );
}

async function renderCatalogItem(supabase, id, res, { table, kind, notFoundLabel }) {
  const { data: item } = await supabase
    .from(table)
    .select('id, name, description, photos, reference_price, is_active, category_id, business:businesses(name, logo_url)')
    .eq('id', id)
    .maybeSingle();

  if (!item || !item.is_active) {
    res.status(404).send(notFoundPage(`Este ${notFoundLabel} ya no está disponible.`));
    return;
  }

  const businessName = item.business?.name ?? 'SOSmoto';
  const description = item.description || `${notFoundLabel[0].toUpperCase()}${notFoundLabel.slice(1)} de ${businessName} en SOSmoto`;
  const images = Array.isArray(item.photos) ? item.photos : [];
  const price = item.reference_price != null ? `$${Number(item.reference_price).toFixed(2)}` : null;
  const universalLink = `https://sosmoto.net/${kind}/${item.id}`;
  const appLink = `sosmoto://${kind}/${item.id}`;

  let related = [];
  if (item.category_id) {
    const { data: relatedRows } = await supabase
      .from(table)
      .select('id, name, photos, reference_price')
      .eq('category_id', item.category_id)
      .eq('is_active', true)
      .neq('id', item.id)
      .order('created_at', { ascending: false })
      .limit(10);
    related = (relatedRows ?? []).map((r) => ({
      href: `https://sosmoto.net/${kind}/${r.id}`,
      image: Array.isArray(r.photos) ? r.photos[0] : null,
      name: r.name,
      price: r.reference_price != null ? `$${Number(r.reference_price).toFixed(2)}` : null,
      kind,
    }));
  }

  res.status(200).send(
    renderPreviewPage({
      authorName: businessName,
      authorAvatar: item.business?.logo_url ?? null,
      title: item.name,
      price,
      description: item.description || null,
      images,
      related,
      appLink,
      og: {
        title: `${item.name}${price ? ` · ${price}` : ''}`,
        description,
        url: universalLink,
        type: 'product',
      },
    })
  );
}

async function renderAd(supabase, id, res) {
  const { data: ad } = await supabase
    .from('ads')
    .select('id, title, photos, status, business:businesses(name)')
    .eq('id', id)
    .maybeSingle();

  if (!ad || !['approved', 'active'].includes(ad.status)) {
    res.status(404).send(notFoundPage('Este anuncio ya no está disponible.'));
    return;
  }

  const businessName = ad.business?.name ?? 'Anuncio';
  const title = ad.title || `Anuncio de ${businessName} en SOSmoto`;
  const universalLink = `https://sosmoto.net/ad/${ad.id}`;
  const appLink = `sosmoto://ad/${ad.id}`;

  res.status(200).send(
    renderPreviewPage({
      kicker: businessName,
      title: ad.title || businessName,
      image: ad.photos?.[0],
      appLink,
      og: { title: `${businessName} en SOSmoto`, description: title, url: universalLink, type: 'article' },
    })
  );
}

module.exports = async (req, res) => {
  const { type, id } = req.query;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const supabase = supabaseAdmin();
  if (type === 'post') return renderPost(supabase, id, res);
  if (type === 'product') return renderCatalogItem(supabase, id, res, { table: 'products', kind: 'product', notFoundLabel: 'producto' });
  if (type === 'service') return renderCatalogItem(supabase, id, res, { table: 'services', kind: 'service', notFoundLabel: 'servicio' });
  if (type === 'ad') return renderAd(supabase, id, res);

  res.status(404).send(notFoundPage('Contenido no encontrado.'));
};
