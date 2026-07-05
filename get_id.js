fetch('https://www.youtube.com/@Artedeinvertir').then(r=>r.text()).then(t=>{
    const match = t.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
    if (match) console.log(match[1]);
    else console.log('not found');
});
