import Parser from 'rss-parser';
const parser = new Parser({
  customFields: {
    item: ['media:group', 'media:thumbnail'],
  },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});
async function test() {
  try {
    const feed = await parser.parseURL('https://www.youtube.com/feeds/videos.xml?channel_id=UC-yJ1V3fN75A4dlR6dgRgEg');
    console.log(feed.title);
  } catch (e) {
    console.log(e.message);
  }
}
test();
