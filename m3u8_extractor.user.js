// ==UserScript==
// @name        動畫瘋 m3u8 下載器
// @description 下載動畫瘋 m3u8 playlists
// @namespace   https://github.com/FlandreDaisuki
// @author      FlandreDaisuki
// @match       *://ani.gamer.com.tw/animeVideo.php?sn=*
// @require     https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.8/FileSaver.min.js
// @require     https://cdn.rawgit.com/FlandreDaisuki/ani.gamer.downloader/master/anime.patched.js
// @version     1.2
// @grant       none
// ==/UserScript==

/* utility func */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const $el = (name, attr = {}, cb = () => {}) => {
  const el = document.createElement(name);
  Object.assign(el, attr);
  cb(el);
  return el;
}

/* DOM */

/*
<div id="m3u8-dl-menu">
  <input id="m3u8-dl-checkbox" type="checkbox">
  <label class="material-icons" for="m3u8-dl-checkbox">dehaze</label>
  <div id="m3u8-dl-options">
    (div > (input + label)) * 4 +
    (div > (input + label)) * 3 +
    (div > input)
  </div>
</div>
*/
{
  const aniMenu = $('nav>.container-player');
  const menu = $el('div', {id: 'm3u8-dl-menu'});
  aniMenu.parentElement.insertBefore(menu, aniMenu);

  const checkbox = $el('input', {
    id: 'm3u8-dl-checkbox',
    type: 'checkbox',
  });

  const label = $el('label', {
    className: 'material-icons',
    htmlFor: 'm3u8-dl-checkbox',
    textContent: 'video_library',
  });


  const grid = $el('div', {
    id: 'm3u8-dl-options',
  }, grid => {
    const res = ['360p', '540p', '720p', '1080p'];
    const countType = ['episode', 'season', 'all'];
    const countTypeCh = {
      episode: '單集',
      season: '整季',
      all: '全部',
    };

    for(const t of res) {
      grid.appendChild($el('div', {
        className: 'col-span-3',
      }, div => {
        const radio = $el('input', {
          type: 'radio',
          id: `m3u8-dl-options-${t}`,
          name: 'm3u8-dl-options-resolution',
          value: t,
        });
        const label = $el('label', {
          textContent: t,
          htmlFor: `m3u8-dl-options-${t}`,
        });
        div.appendChild(radio);
        div.appendChild(label);
      }));
    }

    for(const t of countType) {
      grid.appendChild($el('div', {
        className: 'col-span-4'
      }, div => {
        const radio = $el('input', {
          type: 'radio',
          id: `m3u8-dl-options-${t}`,
          name: 'm3u8-dl-options-countType',
          value: t,
        });
        const label = $el('label', {
          textContent: countTypeCh[t],
          htmlFor: `m3u8-dl-options-${t}`,
        });
        div.appendChild(radio);
        div.appendChild(label);
      }));
    }

    grid.appendChild($el('div', {
      className: 'col-span-max'
    }, div => {
      const button = $el('input', {
        type: 'button',
        id: 'm3u8-dl-options-download-btn',
        value: '下載',
      });
      div.appendChild(button);
    }));
  });

  menu.appendChild(checkbox);
  menu.appendChild(label);
  menu.appendChild(grid);

  $('#m3u8-dl-options-1080p').checked = true;
  $('#m3u8-dl-options-season').checked = true;
  $('#m3u8-dl-options-download-btn').disabled = true;
}
/* m3u8 parser */

function ahref(href) {
  return $el('a', {href}).href;
}

function xhr(url) {
  return fetch(ahref(url), {
    credentials: 'same-origin'
  });
}

// Playlist === MultipleResolutionM3U8
async function getPlaylistSrc(sn) {
  /* global animefun */
  const deviceId = animefun.getdeviceid();
  const url = ahref(`/ajax/m3u8.php?sn=${sn}&device=${deviceId}`);
  const json = await xhr(url).then(resp => resp.json());

  if (json.error) {
    console.error({ from: 'getPlaylistSrc', url, json});
    return;
  }
  // format:
  //  //gamer2-cds.cdn.hinet.net/vod_gamer/_definst_/smil:gamer2(_fast)?/[\w]{40}/hls-ae-2s.smil/playlist.m3u8?token=***&expires=***&bahaData=***
  return json.src;
}

function parsePlaylistText(text, playlist) {
  const prefix = playlist.replace(/\/\/(.*hls-ae-2s.smil).*/,'$1');
  const lines = text.split('\n');
  const o = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('#EXT-X-')) {
      const attr = line.replace(/#EXT-X-([^:]*):(.*)/, '$1;$2').split(';');
      if (attr[0] == 'VERSION') {
        // pass
      } else if (attr[0] == 'STREAM-INF') {
        const resolution = attr[1].replace(/.*RESOLUTION=([^,]+).*/, '$1');
        const res = resolution.split('x')[1] + 'p';
        const src = lines[i + 1];
        i++;
        o[res] = {
          resolution,
          m3u8: `https://${prefix}/${src}`,
        };
      } else {
        console.error('Unknown line');
      }
    }
  }
  return o;
}

let episodeLinkNodes, seasonLinkNodes, allLinkNodes;
if($('.season')) {
  episodeLinkNodes = [$('.season .playing a')];
  seasonLinkNodes = Array.from($('.season .playing').parentElement.querySelectorAll('a'));
  allLinkNodes = $$('.season a');
} else {
  /* 劇場版沒有季 */
  episodeLinkNodes
    = seasonLinkNodes
    = allLinkNodes
    = [$el('a',{href:location.href})];
}

const countTypeSn = {
  episode: episodeLinkNodes.map(n => n.href.replace(/.*sn=(\d+)/, '$1')),
  season: seasonLinkNodes.map(n => n.href.replace(/.*sn=(\d+)/, '$1')),
  all: allLinkNodes.map(n => n.href.replace(/.*sn=(\d+)/, '$1')),
};

const allData = allLinkNodes.map(n => {
  return {
    src: ahref(n.href),
    sn: n.href.replace(/.*sn=(\d+)/, '$1'),
  };
});

/* m3u8 downloader */

function isPayedAccount() {
  return xhr('/animePay.php')
    .then(response => {
    console.log(response.url);
    return response.url.includes('Payed')
  });
}

function sleep(seconds) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, seconds * 1000);
  });
}

(async () => {
  let allTodoData, playlistSrcs;
  try {
    if(await isPayedAccount()) {
      /* logged in and payed*/
      allTodoData = allData;
      playlistSrcs = await Promise.all(allTodoData.map(d => getPlaylistSrc(d.sn)));
    } else {
      /* logged in and not payed*/
      $('#m3u8-dl-options-episode').checked
        = $('#m3u8-dl-options-season').disabled
        = $('#m3u8-dl-options-all').disabled = true;

      allTodoData = allData.filter(d => countTypeSn.episode.includes(d.sn));
      playlistSrcs = await Promise.all(allTodoData.map(d => getPlaylistSrc(d.sn)));
      while(!playlistSrcs[0]) {
        await sleep(5);
        playlistSrcs = await Promise.all(allTodoData.map(d => getPlaylistSrc(d.sn)));
      }
    }
  } catch(e) {
    /* not logged in */
    $$('#m3u8-dl-options input').forEach(el => { el.disabled = true; });
  }

  const PlaylistResponses = await Promise.all(playlistSrcs.map(xhr));
  const PlaylistTexts = await Promise.all(PlaylistResponses.map(r => r.text()));
  const playlists = PlaylistTexts.map((t, i) => parsePlaylistText(t, playlistSrcs[i]));

  const pageResponses = await Promise.all(allTodoData.map(d => xhr(d.src)));
  const pages = await Promise.all(pageResponses.map(r => r.text()));
  const titles = pages.map(html => {
    return html.replace(/[\s\S]*<title>(.*) - 巴哈姆特動畫瘋[\s\S]*/g, '$1')
      .replace('[', ' [')
      .replace('/', '／');
  });

  for(const i in allTodoData) {
    const d = allTodoData[i];
    d.playlist = playlists[i];
    d.name = titles[i];
  }

  console.log('allTodoData', allTodoData);

  const downloadButton = $('#m3u8-dl-options-download-btn');
  downloadButton.disabled = false;
  downloadButton.onclick = () => {
    const resolution = $('[name="m3u8-dl-options-resolution"]:checked').value;
    const countType = $('[name="m3u8-dl-options-countType"]:checked').value;
    const final = allTodoData.filter(d => countTypeSn[countType].includes(d.sn))
    .map(d => ({
      name: d.name,
      m3u8: d.playlist[resolution].m3u8,
    }));
    const blob = new Blob([JSON.stringify(final, null, 2)], {
      type: "text/plain;charset=utf-8"
    });
    /* global saveAs */
    saveAs(blob, `playlist_${resolution}_${countType}.json`);
    $('#m3u8-dl-checkbox').checked = false;
  }
})();

/* style */

$el('style', {textContent:`
#m3u8-dl-menu {
  position: absolute;
  display: flex;
  flex-direction: column;
  font-size: 1.5rem;
}
#m3u8-dl-checkbox,
#m3u8-dl-options,
#m3u8-dl-options input {
  display: none;
}
#m3u8-dl-options #m3u8-dl-options-download-btn {
  display: inline-block;
}
#m3u8-dl-checkbox + label{
  font-size: 35px;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
#m3u8-dl-checkbox:checked ~ #m3u8-dl-options {
  display: grid;
  grid-template-columns: repeat(12, 20px);
  grid-auto-rows: 25px;
  text-align: center;
  line-height: 25px;
}
#m3u8-dl-checkbox + label,
#m3u8-dl-options label {
  cursor: pointer;
}
#m3u8-dl-options input:checked+label {
  color: red;
}
#m3u8-dl-options input:disabled+label {
  text-decoration: double line-through;
  color: darkgrey;
}
.col-span-3 {
  grid-column: span 3;
}
.col-span-4 {
  grid-column: span 4;
}
.col-span-max {
  grid-column: 1/a;
}
`}, el => document.head.appendChild(el));
