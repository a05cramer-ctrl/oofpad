// OOFPAD live API — Vercel Routing Middleware (works on a plain static project, no build step).
// Routes:  /api/top   /api/game?q=<link|placeId>   /api/sol   /api/oof?place=<placeId>
export const config = { matcher: ['/api/:path*'] };

const HEAD = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=20',
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: HEAD });
const get = async (u) => {
  const r = await fetch(u, { headers: { accept: 'application/json', 'user-agent': 'oofpad/1.0' } });
  if (!r.ok) throw new Error(`${new URL(u).host} ${r.status}`);
  return r.json();
};
const clean = (n) => String(n || '').replace(/^\s*\[[^\]]*\]\s*/g, '').trim();

async function icons(ids) {
  if (!ids.length) return {};
  const j = await get(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids.join(',')}&size=150x150&format=Png&isCircular=false`).catch(() => ({ data: [] }));
  const m = {}; (j.data || []).forEach((d) => (m[d.targetId] = d.imageUrl)); return m;
}
async function details(ids) {
  if (!ids.length) return {};
  const j = await get(`https://games.roblox.com/v1/games?universeIds=${ids.join(',')}`).catch(() => ({ data: [] }));
  const m = {}; (j.data || []).forEach((d) => (m[d.id] = d)); return m;
}
async function registry(origin) {
  const [coins, buys] = await Promise.all([
    fetch(`${origin}/coins.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch(`${origin}/purchases.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ]);
  return { coins, buys };
}

async function top(origin) {
  const sid = crypto.randomUUID();
  const j = await get(`https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=${sid}&sortId=top-playing-now&device=computer&country=all`);
  const g = (j.games || []).slice(0, 24);
  const ids = g.map((x) => x.universeId);
  const [ic, dt, reg] = await Promise.all([icons(ids), details(ids), registry(origin)]);
  return {
    live: true, at: new Date().toISOString(),
    games: g.map((x) => ({
      u: x.universeId, p: x.rootPlaceId, n: clean(x.name), pl: x.playerCount, up: x.totalUpVotes, dn: x.totalDownVotes,
      c: dt[x.universeId]?.creator?.name || '', v: dt[x.universeId]?.visits || 0, i: ic[x.universeId] || '',
      coin: reg.coins[String(x.rootPlaceId)] || null,
    })),
  };
}

function placeOf(q) {
  q = String(q || '').trim();
  const m = q.match(/games\/(?:start\?placeId=)?(\d{3,})/i) || q.match(/placeId=(\d{3,})/i) || q.match(/^(\d{3,})$/);
  return m ? m[1] : null;
}

async function game(q, origin) {
  const p = placeOf(q);
  if (!p) return { error: 'Paste a game page link like roblox.com/games/4924922222 or just the number.' };
  const uj = await get(`https://apis.roblox.com/universes/v1/places/${p}/universe`).catch(() => null);
  const u = uj && uj.universeId;
  if (!u) return { error: `No Roblox game found for place ${p}.` };
  const [dt, ic, votes, passes, reg] = await Promise.all([
    details([u]), icons([u]),
    get(`https://games.roblox.com/v1/games/votes?universeIds=${u}`).catch(() => ({ data: [] })),
    get(`https://apis.roblox.com/game-passes/v1/universes/${u}/game-passes?passView=Full&pageSize=100`).catch(() => ({ gamePasses: [] })),
    registry(origin),
  ]);
  const d = dt[u] || {}; const v = (votes.data || [])[0] || {};
  return {
    live: true, u: Number(u), p: Number(p), n: clean(d.name), c: d.creator?.name || '', pl: d.playing || 0, v: d.visits || 0,
    up: v.upVotes || 0, dn: v.downVotes || 0, i: ic[u] || '',
    passes: (passes.gamePasses || []).filter((x) => x.isForSale && x.price).map((x) => ({ id: x.id, n: x.name, r: x.price })),
    coin: reg.coins[String(p)] || null,
  };
}

async function sol() {
  try { const j = await get('https://api.coinbase.com/v2/prices/SOL-USD/spot'); return { usd: Number(j.data.amount), src: 'coinbase', live: true }; }
  catch (e) { const j = await get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'); return { usd: j.solana.usd, src: 'coingecko', live: true }; }
}

async function oof(place, origin) {
  const p = placeOf(place);
  if (!p) return { error: 'place missing' };
  const g = await game(p, origin);
  const { buys } = await registry(origin);
  const mine = (buys || []).filter((b) => String(b.place) === String(p));
  return {
    place: Number(p), name: g.n || '', playing: g.pl || 0, coin: g.coin || null,
    bought: mine.length, robux: mine.reduce((s, b) => s + (Number(b.robux) || 0), 0),
    last: mine.slice(-3).map((b) => b.pass),
  };
}

export default async function middleware(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  try {
    if (path === 'top') return json(await top(url.origin));
    if (path === 'game') return json(await game(url.searchParams.get('q') || url.searchParams.get('place'), url.origin));
    if (path === 'sol') return json(await sol());
    if (path === 'oof') return json(await oof(url.searchParams.get('place'), url.origin));
    return json({ error: 'unknown route' }, 404);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }
}
