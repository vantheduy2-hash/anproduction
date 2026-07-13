function decodeDescription(html) {
  const match = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
  if (!match) return '';
  try { return JSON.parse(`"${match[1]}"`); } catch { return ''; }
}

function inferClient(description, title) {
  const lines = description.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const explicit = lines.map(line => line.match(/(?:khách hàng|khach hang|client|customer|thương hiệu|thuong hieu|brand|đối tác|doi tac)\s*[:\-–|]\s*(.+)/i)).find(Boolean);
  const explicitClient = explicit?.[1]?.replace(/https?:\/\/\S+/g, '').replace(/^[-–•#\s]+/, '').trim();
  if (explicitClient && explicitClient.length <= 80 && !/(contact|gmail|email|hotline|phone|website|facebook|instagram|youtube|zalo|@|thông tin liên hệ|ekip)/i.test(explicitClient)) return explicitClient;
  const isMusic = /(live studio|cover|\bft\b|music|official mv)/i.test(title);
  const titleParts = title.split(/\s+[–—-]\s+/).map(part => part.trim()).filter(Boolean);
  const source = isMusic && titleParts.length > 1 ? titleParts[1] : titleParts[0] || title;
  const cleaned = source.replace(/\[[^\]]*]|\([^)]*\)/g, ' ').replace(/\b(tvc|phim doanh nghiệp|corporate film|company profile|commercial|music video|official video|official mv|quảng cáo|video|interview|final|cover|new version|live studio session)\b/gi, ' ').replace(/\b(a\.?n\.? production|an production)\b/gi, ' ').split('|')[0].replace(/\s+/g, ' ').trim();
  return (cleaned || 'A.N Production').slice(0, 80).trim();
}

async function getVideo(id) {
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  const [oembedResponse, pageResponse] = await Promise.all([
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`),
    fetch(`${watchUrl}&hl=vi`, { headers: { 'accept-language': 'vi,en;q=0.8', 'user-agent': 'Mozilla/5.0' } })
  ]);
  if (!oembedResponse.ok) throw new Error(`YouTube returned ${oembedResponse.status}`);
  const oembed = await oembedResponse.json();
  const description = pageResponse.ok ? decodeDescription(await pageResponse.text()) : '';
  return { id, title: oembed.title, client: inferClient(description, oembed.title), thumbnail: oembed.thumbnail_url };
}

module.exports = async function handler(req, res) {
  const ids = String(req.query.ids || req.query.id || '').split(',').map(id => id.trim()).filter(id => /^[\w-]{11}$/.test(id)).slice(0, 8);
  if (!ids.length) return res.status(400).json({ error: 'A valid YouTube id is required.' });
  try {
    const videos = await Promise.all(ids.map(getVideo));
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ videos });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
};
