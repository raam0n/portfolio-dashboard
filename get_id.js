const ucs = ['UCfpfbIPoALCyV6Y8uEzpe8E', 'UC7sukepQIaKnx8i2I7BBSEG', 'UCDWJj8JVxnA9LJncYsegM4B', 'UCBc0sqNYg8E51nPiRti4bUI', 'UCdmg52MQjbWQpZQo8Ud3mYQ', 'UCQTeCxHvlLpFnXYHN8Qp6Zw', 'UCEO2_EhgAIhMIs46x2OiFlg', 'UCEPBbIhMIs46x2OiFlgMVzE'];
ucs.forEach(uc => {
    fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + uc).then(r=>r.text()).then(t=>{
        if (!t.includes('404')) {
            const title = t.match(/<title>(.*?)<\/title>/);
            console.log("FOUND OK:", uc, "->", title ? title[1] : 'No title');
        }
    });
});
