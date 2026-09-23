// ==UserScript==
// @name         	黄果去广告
// @namespace    	ad-removal
// @version      	2026-09-08
// @description  	去除播放页面的广告
// @author       	JesFelix
// @match        	https://huangguoai.com/video/**
// @match        	https://vt7s.juatinpqz.com/video/**
// @match        	https://d5gpb.juatinpqz.com/video/**
// @match        	https://tois.juatinpqz.com/video/**
// @match        	https://rq3f.zlgncitla.cc/video/**
// @icon        	https://a.favicon.im/huangguoai.com
// @grant        	none
// ==/UserScript==

(function() {
    'use strict';

    const xpath = '/html/body/div[1]/div/main/section/aside/div/div';

    function removeByXPath() {
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