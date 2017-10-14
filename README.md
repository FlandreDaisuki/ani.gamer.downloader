# ani.gamer.downloader
下載動畫瘋動畫

## 需求
- python3.6+
- vlc 2.2.6+
- [m3u8_extractor.user.js](m3u8_extractor.user.js)
- 有巴哈帳號(且有付費)

## 使用方法
1. 安裝 `m3u8_extractor.user.js` 並至想下載的頁面點擊下載 m3u8 資訊，安裝方法參考[這裡](https://greasyfork.org/zh-TW/help/installing-user-scripts)
   1. 不登入完全無法下載
   2. 登入但沒付費只能等廣告結束後下載單集
   3. 登入且有付費可載所有動畫
2. `$ python3 main.py m3u8.json`，其他參數可以使用 `$ python3 main.py -h` 察看

## 注意
若發現下載完成但檔案有異常(不到1KB, ...)，請重新下載 m3u8 資訊
