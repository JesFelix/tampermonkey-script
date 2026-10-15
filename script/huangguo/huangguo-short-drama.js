// ==UserScript==
// @name         黄果短剧
// @namespace    huangguo-short-drama
// @version      0.0.3
// @description  黄果去播放页面广告、添加小窗播放按钮
// @author       JesFelix
// @match        https://*/video/**
// @icon         https://a.favicon.im/huangguoai.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==================================================== 创建小窗播放按钮 ====================================================

    const SELECTOR = '.xg-right-grid';
    const TIMEOUT = 10000; // 10秒超时兜底
    const SVG_ICON = `<svg t="1790935434672" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6707" width="28" height="28"><path d="M900.266667 614.4c29.866667 0 51.2 21.333333 51.2 51.2v170.666667c0 29.866667-21.333333 51.2-51.2 51.2h-341.333334c-29.866667 0-51.2-21.333333-51.2-51.2v-170.666667c0-29.866667 21.333333-51.2 51.2-51.2h341.333334zM819.2 136.533333c72.533333 0 128 55.466667 128 128v243.2c0 25.6-17.066667 42.666667-42.666667 42.666667s-42.666667-17.066667-42.666666-42.666667V264.533333c0-25.6-17.066667-42.666667-42.666667-42.666666H200.533333c-25.6 0-42.666667 17.066667-42.666666 42.666666v430.933334c0 25.6 17.066667 42.666667 42.666666 42.666666h221.866667c25.6 0 42.666667 17.066667 42.666667 42.666667s-17.066667 42.666667-42.666667 42.666667H200.533333c-72.533333 0-128-55.466667-128-128V264.533333c0-72.533333 55.466667-128 128-128h618.666667z m-337.066667 166.4c25.6 0 42.666667 17.066667 42.666667 42.666667v204.8c0 25.6-17.066667 42.666667-42.666667 42.666667H277.333333c-25.6 0-42.666667-17.066667-42.666666-42.666667s17.066667-42.666667 42.666666-42.666667h102.4L247.466667 375.466667c-17.066667-17.066667-17.066667-42.666667 0-59.733334 17.066667-17.066667 42.666667-17.066667 59.733333 0l132.266667 132.266667V345.6c0-25.6 21.333333-42.666667 42.666666-42.666667z" p-id="6708" fill="#ffffff"></path></svg>`

    function handleTarget(el) {
        console.log('✅ 找到目标元素:', el);
        // 页面可能重渲染工具栏，避免重复插入按钮。
        if (el.querySelector('[data-huangguo-pip]')) return;
        const secondIcon = el.querySelectorAll('xg-icon')[1];

        // 创建新的小窗播放按钮 (xg-icon 自定义元素)
        const pipIcon = document.createElement('xg-icon');
        pipIcon.dataset.huangguoPip = 'true';
        pipIcon.innerHTML = SVG_ICON;

        // 设置样式，使其与周围图标风格一致
        pipIcon.style.cssText = `
            height: 100%;
            display: grid;
            place-items: center;
            width: 50px;
            padding-top:4px;
            margin-left: 10px;
        `;

        pipIcon.title = "小窗播放（等待视频加载）";
        pipIcon.style.opacity = '0.5';

        let selectedVideo = null;
        const videoReady = video => video && video.readyState >= HTMLMediaElement.HAVE_METADATA;

        // 优先选择有画面且正在播放的视频，其次选择已经加载元数据的视频。
        function findVideo() {
            const videos = Array.from(document.querySelectorAll('video'));
            return videos.find(v => !v.paused && !v.ended && videoReady(v))
                || videos.find(videoReady)
                || videos.find(v => !v.paused && !v.ended)
                || videos[0]
                || null;
        }

        function refreshVideo() {
            const video = findVideo();
            if (selectedVideo && selectedVideo !== video) {
                selectedVideo.removeEventListener('loadedmetadata', refreshVideo);
                selectedVideo.removeEventListener('emptied', refreshVideo);
            }
            selectedVideo = video;
            if (video) {
                video.addEventListener('loadedmetadata', refreshVideo);
                video.addEventListener('emptied', refreshVideo);
            }
            const ready = videoReady(video);
            pipIcon.style.opacity = ready ? '1' : '0.5';
            pipIcon.title = ready ? '小窗播放' : '等待视频加载完成后可开启小窗';
        }

        refreshVideo();

        // 在第二个图标后面插入新图标
        if (secondIcon && secondIcon.parentNode) {
            secondIcon.insertAdjacentElement('afterend', pipIcon);
            console.log('[PiP] 图标已插入到第二个图标之后');
        } else {
            // 如果找不到第二个图标，追加到容器末尾
            el.appendChild(pipIcon);
            console.log('[PiP] 未找到第二个图标，已追加到容器末尾');
        }

        pipIcon.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();

            try {
                refreshVideo();
                const video = selectedVideo;

                if (!video) {
                    console.warn('[PiP] 仍未找到可用的视频元素');
                    return;
                }

                // 不能在未加载元数据时请求 PiP；等待事件后再请求通常会失去浏览器的用户手势授权。
                if (!videoReady(video)) {
                    console.info('[PiP] 视频仍在加载，请等画面出现后再次点击');
                    return;
                }

                // 检查浏览器是否支持 Picture-in-Picture
                if (!document.pictureInPictureEnabled) {
                    console.warn('[PiP] 当前浏览器不支持画中画功能');
                    return;
                }

                // 如果已经在画中画模式中，则退出
                if (document.pictureInPictureElement === video) {
                    await document.exitPictureInPicture();
                    console.log('[PiP] 已退出画中画模式');
                    return;
                }

                // 请求画中画模式
                var pipWindow = await video.requestPictureInPicture();
                console.log('[PiP] 画中画模式已开启, 窗口大小:', pipWindow.width, 'x', pipWindow.height);

                // 监听画中画窗口关闭
                pipWindow.addEventListener('leavepictureinpicture', function() {
                    console.log('[PiP] 用户手动关闭了画中画窗口');
                });

            } catch (err) {
                console.error('[PiP] 画中画请求失败:', err.message);
            }
        });

        // 鼠标悬停效果
        pipIcon.addEventListener('mouseenter', function() {
            pipIcon.style.opacity = '0.7';
        });
        pipIcon.addEventListener('mouseleave', function() {
            pipIcon.style.opacity = '1';
        });

        console.log('[PiP] 小窗播放按钮初始化完成');
    }

    // 1. 先尝试直接获取（元素可能已经存在）
    const existing = document.querySelector(SELECTOR);
    if (existing) {
        handleTarget(existing);
        return;
    }

    // 2. 用 MutationObserver 等待元素出现
    const observer2 = new MutationObserver(() => {
        const el = document.querySelector(SELECTOR);
        if (el) {
            observer2.disconnect(); // 找到后立即断开，释放资源
            clearTimeout(observerTimeout);
            handleTarget(el);
        }
    });

    observer2.observe(document.body, { childList: true, subtree: true });

    // 视频元素可能在按钮出现之后才由播放器挂载，持续刷新按钮对应的视频状态。
    const videoObserver = new MutationObserver(() => {
        const button = document.querySelector('[data-huangguo-pip]');
        if (!button) return;
        // 事件绑定在按钮自身的闭包中；触发其后代变更时，刷新由独立事件处理器完成。
        const video = document.querySelector('video');
        if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            button.style.opacity = '1';
            button.title = '小窗播放';
        }
    });
    videoObserver.observe(document.body, { childList: true, subtree: true });

    // 3. 超时保护，防止无限监听
    const observerTimeout = setTimeout(() => {
        observer2.disconnect();
        console.warn('⏰ 超时：未在', TIMEOUT, 'ms 内找到', SELECTOR);
    }, TIMEOUT);


    // ==================================================== 去广告 ====================================================
    function removeByXPath() {
        const xpath = '/html/body/div[1]/div/main/section/aside/div/div';
        const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (element) {
            element.remove();
            console.log('[Tampermonkey] 已删除元素:', xpath);
        }
    }

    // 页面加载时执行
    removeByXPath();

    // 监听页面动态变化
    const observer = new MutationObserver(() => { removeByXPath(); });
    observer.observe(document.body, { childList: true, subtree: true });

})();
