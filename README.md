# ani.gamer.downloader
下載動畫瘋動畫

## 需求
- python3.6+
- vlc 2.2.6+
- ani.gamer_m3u8_extractor.user.js
- 有巴哈帳號且有付費

## 使用方法
1. 要登入動畫瘋
2. 安裝 `ani.gamer_m3u8_extractor.user.js` 並至想下載的頁面點擊下載 m3u8 資訊，安裝方法參考[這裡](https://greasyfork.org/zh-TW/help/installing-user-scripts)
3. `$ python3 main.py m3u8.json`，其他參數可以使用 `$ python3 main.py -h` 察看

## 注意
若發現下載完成但檔案有異常，請重新下載 m3u8 資訊