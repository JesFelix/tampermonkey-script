// ==UserScript==
// @name         黄果短剧
// @namespace    picture-in-picture
// @version      0.0.2
// @description  黄果去播放页面广告、添加小窗播放按钮
// @author       JesFelix
// @match        https://huangguoai.com/video/**
// @match        https://vt7s.juatinpqz.com/video/**
// @match        https://d5gpb.juatinpqz.com/video/**
// @match        https://tois.juatinpqz.com/video/**
// @match        https://rq3f.zlgncitla.cc/video/**
// @match        https://rn5lk.fejivxks.cc/video/**
// @match        https://e1nqgm.fejivxks.cc/video/**
// @match        https://uwux.fejivxks.cc/video/**
// @match        https://ffpoe.fejivxks.cc/video/**
// @match        https://jxyr.vqojfzoq.cc/video/**
// @icon         https://a.favicon.im/huangguoai.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==================================================== 创建小窗播放按钮 ====================================================
    const checkTarget = setInterval(() => {
        const targetContainer = document.getElementsByClassName("hg-web-play__actions")[0];
        if (targetContainer) {
            clearInterval(checkTarget);

            // 创建小窗播放按钮
            const btn = document.createElement('button');
            btn.innerText = '📺 小窗播放';
            // 适配容器内样式，可根据实际页面调整
            btn.style.cssText = `
                padding: 6px 12px;
                background: #0078d4;
                color: #fff;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
            `;

            // 将按钮添加到目标容器的子元素最后
            targetContainer.appendChild(btn);

            // 点击事件：触发/退出画中画
            btn.addEventListener('click', () => {
                const video = document.querySelector('video');
                if (!video) {
                    alert('当前页面未找到可播放的视频！');
                    return;
                }
                if (document.pictureInPictureElement) {
                    // 已在画中画模式则退出
                    document.exitPictureInPicture();
                } else {
                    video.requestPictureInPicture()
                        .then(() => console.log('已进入画中画模式'))
                        .catch(err => alert('进入画中画失败：' + err.message));
                }
            });
        }
    }, 500); // 每500ms检查一次目标元素是否存在


    // ==================================================== 去广告 ====================================================
    function removeByXPath() {
        const xpath = '/html/body/div[1]/div/main/section/aside/div/div';
        const element = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;

        if (element) {
            element.remove();
            console.log('[Tampermonkey] 已删除元素:', xpath);
        }
    }

    // 页面加载时执行
    removeByXPath();

    // 监听页面动态变化
    const observer = new MutationObserver(() => {
        removeByXPath();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();