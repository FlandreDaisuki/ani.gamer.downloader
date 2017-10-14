// ==UserScript==
// @name        動畫瘋 m3u8 下載器
// @description 下載動畫瘋 m3u8 playlists
// @namespace   https://github.com/FlandreDaisuki
// @author      FlandreDaisuki
// @match       *://ani.gamer.com.tw/animeVideo.php?sn=*
// @require     https://cdn.rawgit.com/eligrey/FileSaver.js/master/FileSaver.min.js
// @require     https://i2.bahamut.com.tw/js/anime.js
// @version     1.0
// @grant       none
// ==/UserScript==

/* utility func */

function $(selector) {
	return document.querySelector(selector);
}

function $$(selector) {
	return Array.from(document.querySelectorAll(selector));
}

function $el(name, attr = {}, cb = () => {}) {
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

/* m3u8 parser */

function ahref(href) {
  const a = $el('a');
  a.href = href;
  return a.href;
}

function cfetch(url) {
  return fetch(ahref(url), {
		credentials: 'same-origin'
	});
}

function getPlaylistSrc(sn) {
  const deviceId = animefun.getdeviceid();
  const url = `https://ani.gamer.com.tw/ajax/m3u8.php?sn=${sn}&device=${deviceId}`;
  return cfetch(url)
		.then(res => res.json())
		.then(json => {
			if (json.error) {
				return Promise.reject({
          from: 'getPlaylistSrc',
          url,
          json,
        });
			}
			return json.src;
		})
		.catch(console.error);
}

function src2m3u8(src) {
  const magic = src.replace(/(^.)*-video.*/, '$1');
	return `https://gamer-cds.cdn.hinet.net/vod/gamer/${magic}/hls-ae-2s/${src}`;
}

function parsePlayList(pl) {
	const lines = pl.split('\n');
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
					m3u8: src2m3u8(src),
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
  return cfetch('https://ani.gamer.com.tw/animePay.php')
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
      console.log('playlistSrcs', playlistSrcs);
    }
  } catch(e) {
    /* not logged in */
    $$('#m3u8-dl-options input').forEach(el => el.disabled = true);
  }
  

  const playlistRaws = await Promise.all(playlistSrcs.map(cfetch))
    .then(plResponses => Promise.all(plResponses.map(r => r.text())));
  const playlists = playlistRaws.map(parsePlayList);
  
  const pageResponses = await Promise.all(allTodoData.map(d => cfetch(d.src)));
  const pages = await Promise.all(pageResponses.map(r => r.text()));
  const titles = await Promise.all(pages.map(html => {
    return html.replace(/[\s\S]*<title>(.*) - 巴哈姆特動畫瘋[\s\S]*/g, '$1')
      .replace('[', ' [')
      .replace('/', '／');
  }));
  
  for(const i in allTodoData) {
    const d = allTodoData[i];
    d.playlist = playlists[i];
    d.name = titles[i];
  }
  
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
		saveAs(blob, `playlist_${resolution}_${countType}.json`);
    checkbox.checked = false;
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
