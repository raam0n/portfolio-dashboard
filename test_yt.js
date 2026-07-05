import ytSearch from 'yt-search';
async function test() {
  const result = await ytSearch('Arte de Invertir');
  console.log(result.videos[0].title);
}
test();
