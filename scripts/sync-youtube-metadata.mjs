import { readFile, writeFile } from 'node:fs/promises';

const dataPath = new URL('../assets/data/video-portfolio.json', import.meta.url);
const data = JSON.parse(await readFile(dataPath, 'utf8'));

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

async function getMetadata(video) {
  const watchUrl = `https://www.youtube.com/watch?v=${video.youtube_id}`;
  const [oembedResponse, pageResponse] = await Promise.all([
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`),
    fetch(`${watchUrl}&hl=vi`, { headers: { 'accept-language': 'vi,en;q=0.8', 'user-agent': 'Mozilla/5.0' } })
  ]);
  if (!oembedResponse.ok) throw new Error(`oEmbed ${oembedResponse.status}`);
  const oembed = await oembedResponse.json();
  const description = pageResponse.ok ? decodeDescription(await pageResponse.text()) : '';
  return { ...video, title: oembed.title, client: inferClient(description, oembed.title), description_excerpt: description.replace(/\s+/g, ' ').trim().slice(0, 240), thumbnail: oembed.thumbnail_url, author: oembed.author_name, metadata_synced_at: new Date().toISOString() };
}

for (const category of data.categories) {
  category.videos = await Promise.all(category.videos.map(async video => {
    try {
      const enriched = await getMetadata(video);
      console.log(`${video.youtube_id}: ${enriched.title} — ${enriched.client}`);
      return enriched;
    } catch (error) {
      console.warn(`${video.youtube_id}: ${error.message}`);
      return video;
    }
  }));
}

data.metadata_synced_at = new Date().toISOString();
await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
