// ==UserScript==
// @name         抖音当前视频下载辅助
// @namespace    douyindownload
// @version      0.2.0
// @description  下载当前全屏播放器正在播放的视频
// @author       You
// @match        https://www.douyin.com/**
// @icon         https://a.favicon.im/www.douyin.com
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const mediaById = new Map();
    let currentAwemeId = null;
    let latestMediaUrl = null;
    let hasPlaybackSignal = false;

    function getAwemeId(url) {
        try {
            return new URL(url, location.href).searchParams.get('__vid');
        } catch (_) {
            return null;
        }
    }

    function rememberMedia(url, id) {
        if (!url || !/^https:\/\/[^/]+\.douyinvod\.com\//i.test(url)) return;
        // URL 自带的 __vid 优先，避免切换视频时把预取地址归到旧视频。
        const awemeId = getAwemeId(url) || id;
        if (awemeId) {
            // history/write 是当前播放信号；在它出现后，忽略后台预取视频对 currentAwemeId 的覆盖。
            if (!hasPlaybackSignal) currentAwemeId = awemeId;
            mediaById.set(awemeId, url);
        }
        latestMediaUrl = url;
    }

    // 抖音播放器在页面上下文中使用 fetch/XHR，注入桥接器以捕获实际播放直链。
    const bridge = document.createElement('script');
    bridge.textContent = `(${function () {
        const send = (type, url, body) => {
            if (typeof url !== 'string') return;
            const isMedia = /^https:\/\/[^/]+\.douyinvod\.com\//i.test(url);
            const isHistory = /\/history\/write\//.test(url);
            if (!isMedia && !isHistory) return;
            const normalizedBody = typeof body === 'string' ? body :
                (body instanceof URLSearchParams ? body.toString() : '');
            window.postMessage({
                source: 'douyin-current-video-downloader', type, url,
                body: normalizedBody
            }, '*');
        };
        const nativeFetch = window.fetch;
        window.fetch = function (input, init) {
            send('fetch', typeof input === 'string' ? input : input && input.url, init && init.body);
            return nativeFetch.apply(this, arguments);
        };
        const nativeOpen = XMLHttpRequest.prototype.open;
        const nativeSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (method, url) {
            this.__douyinUrl = String(url);
            return nativeOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (body) {
            send('xhr', this.__douyinUrl, body);
            return nativeSend.apply(this, arguments);
        };
    }.toString()})();`;
    (document.documentElement || document.head || document).appendChild(bridge);
    bridge.remove();

    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data ||
            event.data.source !== 'douyin-current-video-downloader') return;
        const { url, body } = event.data;
        const matchedId = typeof body === 'string' && body.match(/(?:^|&)aweme_id=([^&]+)/)?.[1];
        if (matchedId) {
            currentAwemeId = decodeURIComponent(matchedId);
            hasPlaybackSignal = true;
        }
        rememberMedia(url, currentAwemeId);
    });

    function getCurrentMediaUrl() {
        const video = Array.from(document.querySelectorAll('video'))
            .filter((item) => !item.paused && item.readyState > 0)
            .sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height -
                a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
        const idFromVideo = video && getAwemeId(video.currentSrc || video.src);
        const id = idFromVideo || currentAwemeId;
        return { url: (id && mediaById.get(id)) || latestMediaUrl, id };
    }

    async function downloadCurrentVideo(button) {
        const { url, id } = getCurrentMediaUrl();
        if (!url) {
            alert('还没有捕获到当前视频的播放地址，请先播放几秒后再点击下载。');
            return;
        }
        button.style.opacity = '0.5';
        button.title = '正在准备下载…';
        try {
            const response = await fetch(url, { credentials: 'omit' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blobUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `douyin_${id || 'video'}_${Date.now()}.mp4`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        } catch (error) {
            console.error('[抖音下载] 获取视频失败', error);
            window.open(url, '_blank', 'noopener');
        } finally {
            button.style.opacity = '';
            button.title = id ? `下载当前视频（${id}）` : '下载当前视频';
        }
    }

        // SVG 图标路径（下载图标）
    const SVG_ICON_PATH = 'M112.309677 865.445161h799.380646c42.941935 0 79.277419 36.335484 79.277419 79.27742S954.632258 1024 911.690323 1024H112.309677C69.367742 1024 33.032258 987.664516 33.032258 944.722581c0-42.941935 36.335484-79.277419 79.277419-79.27742z m16.516129-386.477419c-33.032258-29.729032-9.909677-75.974194 39.63871-75.974194h109.006452c29.729032 0 56.154839-19.819355 56.154838-46.245161V46.245161c0-26.425806 26.425806-46.245161 56.154839-46.245161h244.43871c29.729032 0 56.154839 19.819355 56.154839 46.245161v307.2c0-26.425806 26.425806 46.245161 56.154838 46.245162h109.006452c49.548387 0 72.670968 49.548387 39.63871 75.974193l-343.535484 297.290323c-23.122581 19.819355-56.154839 19.819355-79.27742 0L128.825806 478.967742z';

    // 核心逻辑：在容器内的最后一个元素后面插入按钮
    function addButtonToContainer(container) {
        // 防重复注入：如果该容器内已经存在按钮，直接跳过
        if (container.querySelector('.auto-download-btn')) return;

        // const lastChild = container.lastElementChild;

        // 获取所有子元素，找到倒数第二个元素
        const children = Array.from(container.children);
        let lastChild;

        if (children.length >= 2) {
            // 容器内至少有2个子元素时，取倒数第二个
            lastChild = children[children.length - 2];
        } else if (children.length === 1) {
            // 只有1个子元素时，就插在这个元素后面
            lastChild = children[0];
        } else {
            // 容器为空，直接追加到容器末尾
            lastChild = null;
        }


        // 创建"下载"按钮
        const downloadBtn = document.createElement('div');
        downloadBtn.title = '下载';
        downloadBtn.className = 'auto-download-btn';
        downloadBtn.style.cssText = `
            margin-top: 16px;
        `

        // 创建 SVG 图标
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'icon');
        svg.setAttribute('viewBox', '0 0 1024 1024');
        svg.setAttribute('version', '1.1');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('p-id', '5843');
        // 按钮图标不需要 200px 那么大，设成 18px 适配按钮大小
        svg.style.width = '18px';
        svg.style.height = '18px';
        svg.style.verticalAlign = 'middle';

        // 创建 path 元素
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', SVG_ICON_PATH);
        path.setAttribute('fill', '#ffffff');
        path.setAttribute('p-id', '5844');

        // 将 path 插入 svg，再将 svg 插入按钮
        svg.appendChild(path);
        downloadBtn.appendChild(svg);

        // 点击时重新读取当前播放器对应的直链，避免下载已切换的视频。
        downloadBtn.addEventListener('click', function(event) {
            event.stopPropagation();
            downloadCurrentVideo(downloadBtn);
        });

        // 插入到最后一个子元素的后面
        if (lastChild) {
            lastChild.insertAdjacentElement('afterend', downloadBtn);
        } else {
            container.appendChild(downloadBtn);
        }
    }

    // 页面布局或类名变化时，仍提供一个稳定可见的下载入口。
    /**
    function addFloatingButton() {
        if (document.getElementById('douyin-current-download-floating')) return;
        const button = document.createElement('button');
        button.id = 'douyin-current-download-floating';
        button.type = 'button';
        button.textContent = '⬇ 下载当前视频';
        button.title = '下载当前播放的视频';
        button.style.cssText = [
            'position:fixed', 'right:24px', 'top:120px', 'z-index:2147483647',
            'padding:10px 14px', 'border:0', 'border-radius:8px',
            'background:#fe2c55', 'color:#fff', 'font-size:14px',
            'font-weight:600', 'cursor:pointer', 'box-shadow:0 2px 10px #0004'
        ].join(';');
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            downloadCurrentVideo(button);
        });
        document.body.appendChild(button);
    }
    */

    // 批量处理函数：查找页面上所有目标容器并添加按钮
    function processAllContainers() {
        // 使用 querySelectorAll 获取所有匹配的元素
        const containers = document.querySelectorAll('.NpVhAo5w');
        containers.forEach(container => {
            addButtonToContainer(container);
        });
        // addFloatingButton();
    }

    function start() {
        if (!document.body) return;
        processAllContainers();
        let debounceTimer = null;
        const observer = new MutationObserver(() => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(processAllContainers, 100);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.body) start();
    else window.addEventListener('DOMContentLoaded', start, { once: true });

})();
