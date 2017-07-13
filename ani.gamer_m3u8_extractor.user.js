// ==UserScript==
// @name        ani.gamer m3u8 extractor
// @name:zh-TW  動畫瘋 m3u8 抽取器
// @description Extract 1080P m3u8 playlists
// @namespace   https://github.com/FlandreDaisuki
// @author      FlandreDaisuki
// @include     https://ani.gamer.com.tw/animeVideo.php?sn=*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require
// https://raw.githubusercontent.com/eligrey/FileSaver.js/master/FileSaver.min.js
// @require     https://i2.bahamut.com.tw/js/anime.js
// @version     0.1
// @grant       none
// ==/UserScript==
function cFetch(url) {
	if (url.startsWith('//')) {
		url = 'https:' + url;
	}
	return fetch(url, {
		credentials: 'same-origin'
	});
}

function genName(N) {
	return $('.anime_name h1')
		.text()
		.replace(/\[(\D*)(\d+)(\D*)\]/, `[$1${N}$3]`)
		.replace(/\//g, '／');
}

function getPlaylistSrc(sn) {
	const url =
		`https://ani.gamer.com.tw/ajax/m3u8.php?sn=${sn}&device=${deviceId}`;
	return cFetch(url)
		.then(res => res.json())
		.then(json => {
			if (json.error) {
				return Promise.reject();
			}
			return json.src;
		})
		.catch(console.error);
}

function parsePlayList(pl) {
	const lines = pl.split('\n');
	const o = {
		version: '',
		streams: {}
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.includes('#EXT-X-')) {
			const attr = line.replace(/#EXT-X-([^:]*):(.*)/, '$1;$2')
				.split(';');
			if (attr[0] == 'VERSION') {
				o.version = attr[1];
			} else if (attr[0] == 'STREAM-INF') {
				const resolution = attr[1].replace(/.*RESOLUTION=([^,]+).*/, '$1');
				const res = resolution.split('x')[1] + 'p';
				const src = lines[i + 1];
				i++;
				o.streams[res] = {
					resolution,
					src
				};
			} else {
				console.error('Unknown line');
			}
		}
	}
	return o;
}

const deviceId = animefun.getdeviceid();

const snListNodes = $('.season .playing')
	.parent()
	.find('a')
	.toArray();

if (snListNodes.length === 0) {
	snListNodes.push({
		href: location.href,
		textContent: ''
	});
}

const snList = snListNodes.map(a => {
	return {
		sn: a.href.replace(/.*sn=(\d+)/, '$1'),
		text: a.textContent
	};
});

Promise.all(snList.map(a => a.sn)
		.map(getPlaylistSrc))
	.then(plSrcs => {
		return Promise.all(plSrcs.map(cFetch))
			.then(plRess => Promise.all(plRess.map(x => x.text())));
	})
	.then(pls => pls.map(parsePlayList))
	.then(pls => {
		snList.forEach((s, i) => {
			s.streams = pls[i].streams;
			s.name = genName(s.text);
		});
	})
	.catch(console.error);

snList.getResolution = function(p) {
	return this.map(ep => {
		const src = ep.streams[p].src;
		const magic = src.replace(/(^.)*-video.*/, '$1');
		const m3u8 =
			`https://gamer-cds.cdn.hinet.net/vod/gamer/${magic}/hls-ae-2s/${src}`;
		return {
			name: ep.name,
			m3u8
		};
	});
};

for (let res of [1080, 720, 540, 360]) {
	$(`<div class="sn-res">點擊儲存 ${res}p 的 m3u8</div>`)
		.insertAfter('.anime_name button')
		.click(() => {
			const blob = new Blob([JSON.stringify(snList.getResolution(`${res}p`), null, 2)], {
				type: "text/plain;charset=utf-8"
			});
			saveAs(blob, `m3u8_${res}p.json`);
		});
}

$('head')
	.append(
		`
<style>
.sn-res {
	display: inline-block;
	vertical-align: middle;
	background: #000;
	border: 0px;
	border-radius: 5px;
	color: #fff;
	cursor: pointer;
	padding: 5px 10px;
	line-height: 1.5em;
	font-size: 1.3em;
	margin: 0 5px;
}
</style>`
	);
