// ==UserScript==
// @name         X 视频下载
// @namespace    x-download
// @version      0.1.1
// @description  在 X 推文视频下添加下载按钮
// @author       JesFelix
// @match        https://x.com/**
// @match        https://twitter.com/**
// @match        https://abs.twimg.com/**
// @icon         https://abs.twimg.com/favicons/twitter.3.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @connect      video.twimg.com
// @connect      abs.twimg.com
// ==/UserScript==

(function() {
    'use strict';
    let bearerTokenPromise = null;

    //  ================================================ 初始化脚本参数  ================================================
    function InitializationBearerToken(){
        // 避免重复初始化
        if (bearerTokenPromise) {
            return bearerTokenPromise;
        }

        const JS_URL = 'https://abs.twimg.com/responsive-web/client-web/main.22feefda9e8e84cca.js';
        const regex = /Bearer\s+[A-Za-z0-9._~+/=%-]+/g;

        function getCookies(name){
            const cookie = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`));
            return cookie ? cookie.slice(name.length + 1) : null;
        }

        GM_setValue('authToken', getCookies('auth_token'));
        GM_setValue('ct0', getCookies('ct0'));

        bearerTokenPromise = new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: JS_URL,
                timeout: 30000,

                onload(response) {
                    if (response.status !== 200) {
                        reject(new Error(`JS 请求失败：${response.status}`));
                        return;
                    }

                    const match = response.responseText.match(regex);
                    if (!match || !match[0]) {
                        reject(new Error('未能提取 Bearer Token'));
                        return;
                    }

                    GM_setValue('bearer_token', match[0]);
                    resolve(match[0]);
                },
                onerror() { reject(new Error('Bearer Token 请求失败')); },
                ontimeout() { reject(new Error('Bearer Token 请求超时')); }
            });
        }).catch(error => {
            // 允许下次重试
            bearerTokenPromise = null;
            throw error;
        });

        return bearerTokenPromise;
    }

    // ================================================ 获取 Tweet ID  ================================================
    function getTweetId(article) {
        // 推文发布时间链接中包含 <time>，可避免误取引用推文或分析链接
        const timeLink = article.querySelector('a[href*="/status/"] time')
        ?.closest('a[href*="/status/"]');

        const href = timeLink?.getAttribute('href');
        return href?.match(/\/status\/(\d+)/)?.[1] ?? null;
    }

    // ================================================ 发送 TweetDetail 请求  ================================================
    function sendTweetDetailRequest(bearer_token, authToken, ct0, tweetId){
        // console.log(bearer_token, authToken, ct0, tweetId)

        // 1. 基础参数准备
        const variables = {
            focalTweetId: tweetId,
            with_rux_injections: false,
            rankingMode: 'Relevance',
            includePromotedContent: true,
            withCommunity: true,
            withQuickPromoteEligibilityTweetFields: true,
            withBirdwatchNotes: true,
            withVoice: true
        };
        const features = {
            rweb_video_screen_enabled: false,
            rweb_cashtags_enabled: true,
            profile_label_improvements_pcf_label_in_post_enabled: true,
            responsive_web_profile_redirect_enabled: true,
            rweb_tipjar_consumption_enabled: false,
            verified_phone_label_enabled: false,
            creator_subscriptions_tweet_preview_api_enabled: true,
            responsive_web_graphql_timeline_navigation_enabled: true,
            premium_content_api_read_enabled: false,
            communities_web_enable_tweet_community_results_fetch: true,
            c9s_tweet_anatomy_moderator_badge_enabled: true,
            responsive_web_grok_analyze_button_fetch_trends_enabled: false,
            responsive_web_grok_analyze_post_followups_enabled: true,
            rweb_cashtags_composer_attachment_enabled: true,
            responsive_web_jetfuel_frame: true,
            rweb_sports_post_context_enabled: false,
            responsive_web_grok_share_attachment_enabled: true,
            responsive_web_grok_annotations_enabled: true,
            articles_preview_enabled: true,
            responsive_web_edit_tweet_api_enabled: true,
            rweb_conversational_replies_downvote_enabled: false,
            graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
            view_counts_everywhere_api_enabled: true,
            longform_notetweets_consumption_enabled: true,
            responsive_web_twitter_article_tweet_consumption_enabled: true,
            content_disclosure_indicator_enabled: true,
            content_disclosure_ai_generated_indicator_enabled: true,
            responsive_web_grok_show_grok_translated_post: true,
            responsive_web_grok_analysis_button_from_backend: true,
            post_ctas_fetch_enabled: false,
            freedom_of_speech_not_reach_fetch_enabled: true,
            standardized_nudges_misinfo: true,
            tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
            longform_notetweets_rich_text_read_enabled: true,
            longform_notetweets_inline_media_enabled: false,
            responsive_web_nested_quote_preview_enabled: true,
            responsive_web_grok_image_annotation_enabled: true,
            responsive_web_grok_imagine_annotation_enabled: true,
            responsive_web_grok_community_note_auto_translation_is_enabled: true,
            responsive_web_enhance_cards_enabled: false
        }
        const fieldToggles = {
            withPayments: false,
            withDmBlocks: false,
            withArticleRichContentState: true,
            withArticlePlainText: false,
            withArticleSummaryText: true,
            withArticleVoiceOver: true,
            withGrokAnalyze: false,
            withDisallowedReplyControls: false
        }
        const API_URL = "/i/api/graphql/3BlMtudy4N-d78ch7zTLZQ/TweetDetail";
        const params = new URLSearchParams({
            variables: JSON.stringify(variables),
            features: JSON.stringify(features),
            fieldToggles: JSON.stringify(fieldToggles)
        });
        const headers = {
            Authorization: bearer_token,
            'x-twitter-active-user': 'yes',
            'x-twitter-auth-type': 'OAuth2Session',
            'Content-Type': 'application/json'
        };
        if (ct0) headers['x-csrf-token'] = ct0;
        if (authToken) headers.Cookie = `auth_token=${authToken}; ct0=${ct0 || ''}`;

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${location.origin}${API_URL}?${params}`,
                headers,
                responseType: 'text',
                timeout: 30000,

                // 请求完成
                onload(response) {
                    if (response.status !== 200) {
                        reject(new Error(`请求失败，HTTP 状态码：${response.status}`));
                        return;
                    }
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (error) {
                        reject(new Error(`响应数据解析失败：${error.message}`));
                    }
                },

                onerror() { reject(new Error('请求发生网络错误'));},
                ontimeout() { reject(new Error('请求超时')); },
                onabort() { reject(new Error('请求已取消')); }
            });
        });

    }

    // ================================================ 显示弹窗  ================================================
    function showTweetLoadingModal(tweetId) {
        // 删除已有弹窗
        document.querySelector('#video-download-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'video-download-modal';

        modal.innerHTML = `
        <div class="vd-overlay">
            <div class="vd-window">
                <div class="vd-header">
                    <span class="vd-title">
                        视频下载&nbsp;
                        <span class="video-quantity">(0)</span>
                    </span>
                    <button class="vd-close" title="关闭">×</button>
                </div>

                <div class="vd-list">
                    <div class="vd-loading">
                        <div class="vd-spinner"></div>
                        <div class="vd-loading-title">正在获取推文信息...</div>
                        <div class="vd-loading-desc">请稍候，正在请求推文详情</div>
                    </div>
                </div>

                <div class="vd-footer">
                    <span class="vd-status">推文ID：${tweetId}</span>
                    <button class="vd-close-btn">关闭</button>
                </div>
            </div>
        </div>
    `;

        const style = document.createElement('style');
        style.textContent = `
        #video-download-modal {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            font-family: Arial, sans-serif;
            color: #222;
        }

        #video-download-modal * {
            box-sizing: border-box;
        }

        #video-download-modal .vd-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 24px;
            background: rgba(0, 0, 0, .55);
        }

        #video-download-modal .vd-window {
           display: flex;
           flex-direction: column;
           width: 680px;
           max-width: 100%;
           height: auto;
           max-height: min(680px, 85vh);
           overflow: hidden;
           background: #fff;
           border-radius: 12px;
           box-shadow: 0 12px 40px rgba(0, 0, 0, .25);
        }

        #video-download-modal .vd-header,
        #video-download-modal .vd-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            flex-shrink: 0;
        }

        #video-download-modal .vd-header {
            border-bottom: 1px solid #eee;
        }

        #video-download-modal .vd-title {
            font-size: 18px;
            font-weight: 600;
        }

        #video-download-modal .video-quantity{
            font-size: 15px;
            font-weight: 400;
        }

        #video-download-modal .vd-close {
            border: none;
            background: transparent;
            font-size: 28px;
            cursor: pointer;
            color: #666;
        }

        #video-download-modal .vd-list {
            flex: 1 1 auto;
            min-height: 0;
            padding: 12px 20px;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: thin;
            scrollbar-color: #c5cbd3 transparent;
            scroll-behavior: smooth;
            overscroll-behavior: contain;
        }

        #video-download-modal .vd-footer {
            border-top: 1px solid #eee;
            color: #666;
            font-size: 13px;
        }

        #video-download-modal .vd-close-btn {
            padding: 8px 18px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: white;
            cursor: pointer;
        }

        /* 加载状态 */
        #video-download-modal .vd-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 230px;
            text-align: center;
        }

        #video-download-modal .vd-spinner {
            width: 36px;
            height: 36px;
            border: 3px solid #e8e8e8;
            border-top-color: #1d9bf0;
            border-radius: 50%;
            animation: vd-spin .8s linear infinite;
            margin-bottom: 18px;
        }

        #video-download-modal .vd-loading-title {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        #video-download-modal .vd-loading-desc {
            color: #888;
            font-size: 13px;
        }

        #video-download-modal .vd-error {
            padding: 32px 10px;
            text-align: center;
            color: #d93025;
            font-size: 14px;
            overflow-wrap: anywhere;
        }

        #video-download-modal .vd-detail {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            font-size: 13px;
            line-height: 1.6;
        }

        @keyframes vd-spin {
            to { transform: rotate(360deg); }
        }

        @media (max-width: 520px) {
            #video-download-modal .vd-overlay {
                padding: 10px;
            }
        }

        /* Chrome / Edge / Safari：滚动条整体宽度 */
        #video-download-modal .vd-list::-webkit-scrollbar {
            width: 6px;
        }

        /* 滚动条轨道 */
        #video-download-modal .vd-list::-webkit-scrollbar-track {
            background: transparent;
            margin: 8px 0;
        }

        /* 滚动滑块 */
        #video-download-modal .vd-list::-webkit-scrollbar-thumb {
            background: #c5cbd3;
            border-radius: 10px;
            border: 1px solid transparent;
            background-clip: content-box;
        }

        /* 鼠标悬停时 */
        #video-download-modal .vd-list::-webkit-scrollbar-thumb:hover {
            background: #929ba7;
            background-clip: content-box;
        }

        /* 标题栏和底栏固定，不参与滚动 */
        #video-download-modal .vd-header,
            #video-download-modal .vd-footer {
                flex-shrink: 0;
            }

        /* 移动端适配 */
        @media (max-width: 520px) {
            #video-download-modal .vd-window {
                max-height: 90vh;
            }

            #video-download-modal .vd-list {
                padding: 12px 14px;
            }

            #video-download-modal .vd-list::-webkit-scrollbar {
                width: 4px;
            }
        }

        /* =========================================== 渲染数据的样式 =========================================== */

        /* 视频列表项 */
        #video-download-modal .vd-item {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 14px 0;
            border-bottom: 1px solid #eee;
        }

        #video-download-modal .vd-item:last-child {
            border-bottom: none;
        }

        /* 左侧视频封面 */
        #video-download-modal .vd-thumb {
            width: 140px;
            height: 82px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            border-radius: 8px;
            background: #f3f4f6;
            color: #888;
            font-size: 12px;
        }

        #video-download-modal .vd-thumb img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        /* 中间信息区域 */
        #video-download-modal .vd-info {
            flex: 1;
            min-width: 0;
        }

        #video-download-modal .vd-name {
            margin-bottom: 12px;
            font-size: 14px;
            font-weight: 600;
            color: #222;
        }

        /* 分辨率选择 */
        #video-download-modal .vd-resolution-label {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #777;
            font-size: 12px;
        }

        #video-download-modal .vd-resolution-select {
            width: 125px;
            max-width: 100%;
            padding: 7px 28px 7px 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fff;
            color: #333;
            font-size: 13px;
            cursor: pointer;
            outline: none;
        }

        #video-download-modal .vd-resolution-select:hover {
            border-color: #1d9bf0;
        }

        #video-download-modal .vd-resolution-select:focus {
            border-color: #1d9bf0;
            box-shadow: 0 0 0 2px rgba(29, 155, 240, .12);
        }

        /* 右侧下载按钮 */
        #video-download-modal .vd-download {
            flex-shrink: 0;
            padding: 9px 18px;
            border: none;
            border-radius: 6px;
            background: #1d9bf0;
            color: #fff;
            font-size: 13px;
            cursor: pointer;
            transition: background .2s;
        }

        #video-download-modal .vd-download:hover {
            background: #1685d0;
        }

        /* 窄屏适配 */
        @media (max-width: 520px) {
            #video-download-modal .vd-item {
                gap: 10px;
            }

            #video-download-modal .vd-thumb {
                width: 100px;
                height: 66px;
            }

            #video-download-modal .vd-resolution-label {
                align-items: flex-start;
                flex-direction: column;
                gap: 5px;
            }

            #video-download-modal .vd-resolution-select {
                width: 100%;
            }

            #video-download-modal .vd-download {
                padding: 8px 12px;
            }
        }`;

        modal.appendChild(style);
        document.body.appendChild(modal);

        // 统一关闭逻辑
        const closeModal = () => modal.remove();

        modal.querySelectorAll('.vd-close, .vd-close-btn')
            .forEach(button => {
            button.addEventListener('click', closeModal);
        });

        // 点击遮罩空白处关闭
        modal.querySelector('.vd-overlay').addEventListener('click', event => {
            if (event.target === event.currentTarget) {
                closeModal();
            }
        });

        // ESC 关闭，并在弹窗销毁后清理监听
        const handleKeydown = event => {
            if (event.key === 'Escape') {
                closeModal();
            }
        };

        document.addEventListener('keydown', handleKeydown);

        const observer = new MutationObserver(() => {
            if (!document.contains(modal)) {
                document.removeEventListener('keydown', handleKeydown);
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return modal;
    }

    // ================================================ HLS / m3u8 下载 ================================================
    function requestMedia(url, responseType = 'text', headers = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers,
                responseType,
                timeout: 60000,
                onload(response) {
                    if (response.status < 200 || response.status >= 300) {
                        reject(new Error(`媒体请求失败（${response.status}）：${url}`));
                        return;
                    }
                    resolve(response.response);
                },
                onerror() { reject(new Error(`媒体网络请求失败：${url}`)); },
                ontimeout() { reject(new Error(`媒体请求超时：${url}`)); }
            });
        });
    }
    function parseHlsAttributes(value) {
        const result = {};
        const regex = /([A-Z0-9-]+)=((?:"[^"]*")|[^,]*)/g;
        let match;
        while ((match = regex.exec(value))) {
            result[match[1]] = match[2].replace(/^"|"$/g, '');
        }
        return result;
    }
    async function downloadHlsPlaylist(playlistUrl, onProgress = () => {}) {
        let playlistText = await requestMedia(playlistUrl, 'text');
        let playlistBaseUrl = playlistUrl;

        // Master playlist 可能包含多个清晰度，优先选择带宽最高的一路。
        if (/#EXT-X-STREAM-INF:/m.test(playlistText)) {
            const lines = playlistText.split(/\r?\n/).map(line => line.trim());
            const variants = [];
            for (let i = 0; i < lines.length; i++) {
                if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
                const attrs = parseHlsAttributes(lines[i].slice(lines[i].indexOf(':') + 1));
                const uri = lines.slice(i + 1).find(line => line && !line.startsWith('#'));
                if (uri) variants.push({
                    url: new URL(uri, playlistUrl).href,
                    bandwidth: Number(attrs['AVERAGE-BANDWIDTH'] || attrs.BANDWIDTH || 0)
                });
            }
            if (!variants.length) throw new Error('主播放列表中没有找到可用的视频流');
            playlistBaseUrl = variants.sort((a, b) => b.bandwidth - a.bandwidth)[0].url;
            playlistText = await requestMedia(playlistBaseUrl, 'text');
        }

        if (!playlistText.includes('#EXTINF:')) {
            throw new Error('无法识别 m3u8 媒体播放列表');
        }

        const lines = playlistText.split(/\r?\n/).map(line => line.trim());
        const segments = [];
        let keyInfo = null;
        let mapInfo = null;
        let pendingRange = null;
        let rangeEndByUrl = new Map();
        let mediaSequence = 0;

        for (const line of lines) {
            if (!line) continue;
            if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
                mediaSequence = Number(line.split(':')[1]) || 0;
            } else if (line.startsWith('#EXT-X-KEY:')) {
                const attrs = parseHlsAttributes(line.slice(line.indexOf(':') + 1));
                if (attrs.METHOD === 'NONE') keyInfo = null;
                else if (attrs.METHOD === 'AES-128' && attrs.URI) {
                    keyInfo = {
                        url: new URL(attrs.URI, playlistBaseUrl).href,
                        iv: attrs.IV || null
                    };
                } else {
                    throw new Error(`暂不支持此 m3u8 加密方式：${attrs.METHOD || '未知'}`);
                }
            } else if (line.startsWith('#EXT-X-MAP:')) {
                const attrs = parseHlsAttributes(line.slice(line.indexOf(':') + 1));
                if (!attrs.URI) throw new Error('m3u8 初始化片段缺少 URI');
                mapInfo = { url: new URL(attrs.URI, playlistBaseUrl).href, range: attrs.BYTERANGE || null };
            } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
                pendingRange = line.split(':')[1];
            } else if (!line.startsWith('#')) {
                const url = new URL(line, playlistBaseUrl).href;
                let range = null;
                if (pendingRange) {
                    const [lengthText, offsetText] = pendingRange.split('@');
                    const length = Number(lengthText);
                    const offset = offsetText === undefined
                    ? (rangeEndByUrl.get(url) || 0)
                    : Number(offsetText);
                    range = { start: offset, end: offset + length - 1 };
                    rangeEndByUrl.set(url, offset + length);
                    pendingRange = null;
                }
                segments.push({ url, range, keyInfo, sequence: mediaSequence++ });
            }
        }

        if (!segments.length) throw new Error('m3u8 播放列表中没有视频分片');
        onProgress(`正在下载视频分片（0/${segments.length}）`);

        const keyCache = new Map();
        async function getKey(url) {
            if (!keyCache.has(url)) {
                keyCache.set(url, requestMedia(url, 'arraybuffer').then(buffer => {
                    if (buffer.byteLength !== 16) throw new Error('AES-128 密钥长度不是 16 字节');
                    return crypto.subtle.importKey('raw', buffer, { name: 'AES-CBC' }, false, ['decrypt']);
                }));
            }
            return keyCache.get(url);
        }

        async function fetchPart(part, index, isMap = false) {
            const headers = part.range ? { Range: `bytes=${part.range.start}-${part.range.end}` } : {};
            let buffer = await requestMedia(part.url, 'arraybuffer', headers);
            const encryption = part.keyInfo || null;
            if (encryption) {
                const key = await getKey(encryption.url);
                let iv;
                if (encryption.iv) {
                    const hex = encryption.iv.replace(/^0x/i, '').padStart(32, '0').slice(-32);
                    iv = new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
                } else {
                    iv = new Uint8Array(16);
                    new DataView(iv.buffer).setUint32(12, isMap ? 0 : part.sequence);
                }
                buffer = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, buffer);
            }
            return buffer;
        }

        const chunks = [];
        if (mapInfo) chunks.push(await fetchPart({ ...mapInfo, keyInfo: null, sequence: 0 }, -1, true));

        // 限制并发，避免分片多时同时占用过多内存或触发限流。
        const concurrency = 4;
        let completed = 0;
        const results = new Array(segments.length);
        let nextIndex = 0;
        async function worker() {
            while (nextIndex < segments.length) {
                const index = nextIndex++;
                results[index] = await fetchPart(segments[index], index);
                completed++;
                onProgress(`正在下载视频分片（${completed}/${segments.length}）`);
            }
        }
        await Promise.all(Array.from({ length: Math.min(concurrency, segments.length) }, worker));
        chunks.push(...results);

        const isFmp4 = Boolean(mapInfo);
        const blob = new Blob(chunks, { type: isFmp4 ? 'video/mp4' : 'video/mp2t' });
        const filename = `video_${segments.length}_segments.${isFmp4 ? 'mp4' : 'ts'}`;
        const blobUrl = URL.createObjectURL(blob);
        onProgress('正在保存文件…');
        return new Promise((resolve, reject) => {
            GM_download({
                url: blobUrl,
                name: filename,
                saveAs: false,
                onload: () => {
                    URL.revokeObjectURL(blobUrl);
                    onProgress('下载完成');
                    resolve();
                },
                onerror: error => {
                    URL.revokeObjectURL(blobUrl);
                    onProgress('下载失败');
                    reject(new Error(`m3u8 文件保存失败：${error?.error || '未知错误'}`));
                },
                ontimeout: () => {
                    URL.revokeObjectURL(blobUrl);
                    onProgress('保存超时');
                    reject(new Error('m3u8 文件保存超时'));
                }
            });
        });
    }

    // ================================================ 更新弹窗  ================================================
    function renderTweetDetailModal(modal, tweetDetailInfo, tweetId) {
        if (!modal?.isConnected) return;

        const list = modal.querySelector('.vd-list');
        if (!list) {
            console.error('未找到 .vd-list，请检查弹窗 HTML');
            return;
        }

        list.replaceChildren();

        // 兼容非数组数据
        const items = Array.isArray(tweetDetailInfo) ? tweetDetailInfo : [];

        // 兼容数量元素不存在的情况
        const videoQuantity = modal.querySelector(
            '.video-quantity, .vd-count'
        );

        if (videoQuantity) {
            videoQuantity.textContent = `(${items.length})`;
        }

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'vd-error';
            empty.textContent = '未获取到视频信息，请检查接口返回数据';
            list.appendChild(empty);
            return;
        }

        let renderedCount = 0;

        items.forEach((item, index) => {
            // 兼容 item.video、item 直接包含字段、
            // 以及 item.extended_entities 等常见形式
            const video = item;

            const mediaUrl =
                  video?.media_url_https ??
                  video?.media_url ??
                  video?.poster ??
                  '';

            // 没有图片地址时仍然显示这一行，方便检查数据
            const row = document.createElement('div');
            row.className = 'vd-item';

            // 左侧封面
            const thumb = document.createElement('div');
            thumb.className = 'vd-thumb';

            if (mediaUrl) {
                const img = document.createElement('img');
                img.src = mediaUrl;
                img.alt = `视频 ${index + 1} 封面`;
                img.onerror = () => {
                    thumb.replaceChildren();
                    thumb.textContent = '图片加载失败';
                };
                thumb.appendChild(img);
            } else {
                thumb.textContent = '暂无封面';
            }

            // 中间信息
            const info = document.createElement('div');
            info.className = 'vd-info';

            const name = document.createElement('div');
            name.className = 'vd-name';
            name.textContent = `视频 ${index + 1}`;
            name.style.fontSize = "18px"

            const resolutionTitle = document.createElement('span');
            resolutionTitle.textContent = '分辨率: ';
            resolutionTitle.className = 'vd-resolution-title';
            resolutionTitle.style.fontSize = '16px';

            const select = document.createElement('select');
            select.className = 'vd-resolution-select'

            // 获取视频分辨率
            const dpiList = video.video_info.variants
            .filter(item => item.content_type === "video/mp4" || item.content_type === "application/x-mpegURL")
            .map((item, index) => {
                const match = item.url?.match(/\/vid\/[^/]+\/(\d+x\d+)\//);
                return {
                    index: index + 1,
                    content_type: item.content_type,
                    dpi: item.content_type === "application/x-mpegURL" ? "m3u8" : match ? match[1] : "",
                    video_url: item.url
                };
            });

            dpiList.forEach(res => {
                const option = document.createElement('option');
                option.value = res.index;
                option.textContent = res.dpi;
                select.appendChild(option);
            });

            info.append(name, resolutionTitle, select);

            // 右侧按钮
            const button = document.createElement('button');
            button.className = 'vd-download';
            button.type = 'button';
            button.textContent = '下载';

            button.addEventListener('click',async () => {
                const selectedIndex = Number(select.value);
                const selectedInfo = dpiList.find(item => item.index === selectedIndex)
                if(selectedInfo.content_type == "application/x-mpegURL"){
                    // console.log('流媒体下载暂未实现');
                    await downloadHlsPlaylist(selectedInfo.video_url, text => {
                        button.textContent = text;
                    });
                }
                if(selectedInfo.content_type == "video/mp4"){
                    const filename = `video_${selectedInfo.dpi}.mp4`;
                    GM_download({
                        url: selectedInfo.video_url,
                        name: filename,
                        onload: () => { console.log('视频下载完成：', filename); },
                        onerror: (error) => { console.error('视频下载失败：', error); },
                        ontimeout: () => { console.error('视频下载超时'); }
                    });
                }
            });

            row.append(thumb, info, button);
            list.appendChild(row);
            renderedCount++;
        });
    }
    function renderTweetErrorModal(modal, error) {
        if (!modal?.isConnected) return;

        const list = modal.querySelector('.vd-list');
        if (!list) return;

        list.replaceChildren();
        const errorElement = document.createElement('div');
        errorElement.className = 'vd-error';
        errorElement.textContent =
            error?.message || '发生未知错误，请稍后重试';

        list.appendChild(errorElement);
    }

    // ================================================ 视频下载弹窗  ================================================
    async function downloadVideoAlert(tweetId){
        // 1. 先显示弹窗，进入加载状态
        const modal = showTweetLoadingModal(tweetId);

        try {
            // 2. 获取 Bearer Token
            let bearerToken = GM_getValue('bearer_token');

            if (!bearerToken) {
                console.log('Bearer Token 尚未就绪，开始初始化...');
                bearerToken = await InitializationBearerToken();
            }

            if (!bearerToken) {
                throw new Error('Bearer Token 初始化失败');
            }

            // 3. 请求推文详情
            const tweetDetailInfo = await sendTweetDetailRequest(bearerToken, GM_getValue('authToken'), GM_getValue('ct0'), tweetId);
            // 梳理信息
            const tweetInfo = tweetDetailInfo.data.threaded_conversation_with_injections_v2.instructions[1].entries[0].content.itemContent.tweet_results.result.legacy.entities.media;

            // 4. 请求完成后，更新原有弹窗
            renderTweetDetailModal(modal, tweetInfo, tweetId);

        } catch (error) {
            console.error('获取推文信息失败：', error);
            renderTweetErrorModal(modal, error);
        }

    }

    // ================================================ 创建下载按钮 ================================================
    function createDownloadButton(article) {
        const buttonId = 'x-video-download-button';

        // 每个 article 内只允许存在一个下载按钮
        if (article.querySelector(`#${buttonId}`)) { return; }

        // 查找当前 article 自己的操作栏
        const actionGroup = article.querySelector('[role="group"]');

        if (!actionGroup) { return; }

        // 外层占位容器
        const wrapper = document.createElement('div');
        wrapper.id = buttonId;

        Object.assign(wrapper.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexShrink: '0',
            marginLeft: '10px'
        });

        // 内层下载按钮
        const downloadButton = document.createElement('div');

        downloadButton.setAttribute('role', 'button');
        downloadButton.setAttribute('tabindex', '0');
        downloadButton.textContent = '下载';
        downloadButton.title = '下载';
        downloadButton.setAttribute('aria-label', '下载视频');

        Object.assign(downloadButton.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '30px',
            height: '28px',
            fontSize: '13px',
            fontWeight: '600',
            padding: '0 10px',
            margin: '0',
            border: 'none',
            borderRadius: '9999px',
            background: 'transparent',
            color: 'currentColor',
            opacity: '0.7',
            cursor: 'pointer',
            transition: 'background-color 0.2s, opacity 0.2s',
            userSelect: 'none'
        });

        // 鼠标悬停
        downloadButton.addEventListener('mouseenter', () => {
            downloadButton.style.backgroundColor =
                'rgba(255, 255, 255, 0.1)';
            downloadButton.style.opacity = '1';
        });

        downloadButton.addEventListener('mouseleave', () => {
            downloadButton.style.backgroundColor = 'transparent';
            downloadButton.style.opacity = '0.7';
            downloadButton.style.transform = 'scale(1)';
        });

        // 点击反馈
        downloadButton.addEventListener('mousedown', () => {
            downloadButton.style.transform = 'scale(0.95)';
        });

        downloadButton.addEventListener('mouseup', () => {
            downloadButton.style.transform = 'scale(1)';
        });

        // 点击事件
        downloadButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 开启视频下载弹窗
            const tweetId = getTweetId(article)
            downloadVideoAlert(tweetId)
        });

        // 支持键盘操作
        downloadButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                downloadButton.click();
            }
        });

        wrapper.appendChild(downloadButton);
        actionGroup.appendChild(wrapper);
    }

    // ================================================ 添加所有下载按钮 ================================================
    function addDownloadButton() {
        function processArticles() {
            const articles = document.querySelectorAll('article');
            articles.forEach(article => {
                const videoList = article.querySelectorAll('div[data-testid="videoComponent"]');
                if (videoList.length === 0) return;
                createDownloadButton(article);
            });
        }

        // 首次处理已有文章
        processArticles();

        // 监听动态加载的文章
        const observer = new MutationObserver(() => {
            processArticles();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function main(){
        // 1. 初始化 Bearer Token
        InitializationBearerToken()

        // 2. 添加下载按钮
        addDownloadButton()
    }

    main();
})();