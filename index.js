import { extension_settings } from '../../../extensions.js';
import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../popup.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { Settings } from './src/Settings.js';
import { renderExtensionTemplateAsync } from '../../../extensions.js';

// 이 이름은 실제 확장 프로그램의 폴더 이름과 일치해야 합니다.
const extensionName = "SillyTavern-ToastHistory-custom";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const settings = new Settings();

const init = ()=>{
    /**@type {{level:string, message:string|JQuery, title:string, options:ToastrOptions, toast:HTMLElement, timestamp:Date}[]} */
    const history = [];

    const updateHideButtonAppearance = (button, isSuppressed) => {
        if (isSuppressed) {
            button.classList.remove('fa-ban');
            button.classList.add('fa-eye');
            button.title = 'Click to allow this toast\nLong-press to delete permanently';
        } else {
            button.classList.remove('fa-eye');
            button.classList.add('fa-ban');
            button.title = 'Click to suppress this toast\nLong-press to delete permanently';
        }
    };

    const createBlockListElement = () => {
        const dom = document.createElement('div');
        dom.classList.add('stth--hideListDlg');
        const tbl = document.createElement('table');
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        for (const col of ['Severity', 'Message', '']) {
            const th = document.createElement('th');
            th.textContent = col;
            tr.append(th);
        }
        thead.append(tr);
        tbl.append(thead);

        const tbody = document.createElement('tbody');
        for (const item of settings.hideList) {
            const tr = document.createElement('tr');
            const sev = document.createElement('td');
            sev.textContent = item.level;
            tr.append(sev);
            const mes = document.createElement('td');
            const wrap = document.createElement('div');
            wrap.classList.add('toast-message');
            wrap.innerHTML = item.textContent;
            mes.append(wrap);
            tr.append(mes);

            const actions = document.createElement('td');
            const del = document.createElement('div');
            del.classList.add('menu_button', 'fa-solid', 'fa-fw', 'fa-trash-can');
            del.title = 'Remove item from block list';
            del.addEventListener('click', () => {
                const idx = settings.hideList.indexOf(item);
                if (idx > -1) {
                    settings.hideList.splice(idx, 1);
                    settings.save();
                }
                tr.remove();
            });
            actions.append(del);
            tr.append(actions);
            tbody.append(tr);
        }
        tbl.append(tbody);
        dom.append(tbl);
        return dom;
    };


    const openToastHistoryPopup = async () => {
        try {
            const template = $(await renderExtensionTemplateAsync(`third-party/${extensionName}`, 'template'));
            const dom = template;

            const historyList = dom.find('.stth-history-list');
            historyList.addClass('stth--history');

            const showEmptyMessage = () => {
                historyList.empty();
                const noHistoryMessage = document.createElement('div');
                noHistoryMessage.textContent = 'No recent notifications.';
                noHistoryMessage.style.textAlign = 'center';
                noHistoryMessage.style.padding = '20px';
                historyList.append(noHistoryMessage);
            };

            if (history.length === 0) {
                showEmptyMessage();
            } else {
                 for (const item of history.toReversed()) {
                    const wrap = document.createElement('div'); {
                        wrap.classList.add('stth--item');
                        wrap.dataset.level = item.level;
                        const toast = /**@type {HTMLElement}*/(item.toast.cloneNode(true)); {
                            toast.style.opacity = 1;
                            wrap.dataset.textContent = toast.querySelector('.toast-message').innerHTML;
                            
                            const ts = document.createElement('div'); {
                                ts.classList.add('stth--timestamp');
                                ts.textContent = item.timestamp.toLocaleString();
                                toast.append(ts);
                            }
                            wrap.append(toast);
                        }
                        
                        const isSuppressed = !!settings.hideList.find(it=>it.level == wrap.dataset.level && it.textContent == wrap.dataset.textContent);
                        if (isSuppressed) {
                            wrap.classList.add('stth--isSuppressed');
                        }

                        const actions = document.createElement('div'); {
                            actions.classList.add('stth--actions');
                            const hide = document.createElement('div'); {
                                hide.classList.add('stth--action', 'stth--hide', 'menu_button', 'fa-solid', 'fa-fw');
                                updateHideButtonAppearance(hide, isSuppressed);

                                let pressTimer = null;
                                let isLongPress = false;

                                const onPointerDown = (event) => {
                                    // 터치 이벤트의 경우, 뒤따라오는 마우스 이벤트를 막습니다.
                                    if (event.type === 'touchstart') {
                                        event.preventDefault();
                                    }
                                    isLongPress = false;
                                    pressTimer = setTimeout(() => {
                                        isLongPress = true;
                                        const idx = history.indexOf(item);
                                        if (idx > -1) {
                                            history.splice(idx, 1);
                                        }
                                        wrap.remove();
                                        if (history.length === 0) {
                                            showEmptyMessage();
                                        }
                                    }, 500);
                                };

                                const onPointerUp = (event) => {
                                    if (event.type === 'touchend') {
                                        event.preventDefault();
                                    }
                                    clearTimeout(pressTimer);
                                    if (!isLongPress) {
                                        // 짧게 누르기 액션
                                        const isNowSuppressed = wrap.classList.toggle('stth--isSuppressed');
                                        updateHideButtonAppearance(hide, isNowSuppressed);

                                        const same = /**@type {HTMLElement[]}*/([...historyList.children()]).filter(it=>it.dataset.level == item.level && it.dataset.textContent == item.toast.textContent);
                                        for (const el of same) { 
                                            el.classList[isNowSuppressed ? 'add' : 'remove']('stth--isSuppressed');
                                            const otherHideButton = el.querySelector('.stth--hide');
                                            if (otherHideButton) {
                                                updateHideButtonAppearance(otherHideButton, isNowSuppressed);
                                            }
                                        }

                                        if (isNowSuppressed) {
                                            settings.hideList.push({ textContent:item.toast.querySelector('.toast-message').innerHTML, level:item.level });
                                        } else {
                                            const idx = settings.hideList.findIndex(it=>it.textContent == item.toast.querySelector('.toast-message').innerHTML && it.level == item.level);
                                            if (idx > -1) { settings.hideList.splice(idx, 1); }
                                        }
                                        settings.save();
                                    }
                                };
                                
                                hide.addEventListener('mousedown', onPointerDown);
                                hide.addEventListener('touchstart', onPointerDown);
                                hide.addEventListener('mouseup', onPointerUp);
                                hide.addEventListener('touchend', onPointerUp);
                                hide.addEventListener('mouseleave', () => clearTimeout(pressTimer));

                                actions.append(hide);
                            }

                            if (item.options?.onclick) {
                                toast.classList.add('stth--hasListener');
                                toast.addEventListener('click', item.options.onclick);
                            }
                            wrap.append(actions);
                        }
                        historyList.append(wrap);
                    }
                }
            }
            
            const mainTabs = dom.find('.stth-main-tabs button');
            const viewContainers = dom.find('.stth-view-container');
            const blockedListContainer = dom.find('.stth-blocked-list');

            mainTabs.on('click', function() {
                const viewName = $(this).data('view');
                mainTabs.removeClass('active');
                $(this).addClass('active');
                viewContainers.hide();

                const targetView = viewContainers.filter(`[data-view-name="${viewName}"]`);
                targetView.show();
                
                if (viewName === 'blocked') {
                    blockedListContainer.empty().append(createBlockListElement());
                }
            });

            const subTabs = dom.find('.stth-tabs button');
            const items = historyList.find('.stth--item');
            subTabs.on('click', function() {
                const level = $(this).data('level');
                subTabs.removeClass('active');
                $(this).addClass('active');
                items.each(function() {
                    if (level === 'all' || $(this).data('level') === level) {
                        $(this).css('display', 'flex');
                    } else {
                        $(this).css('display', 'none');
                    }
                });
            });

            const dlg = new Popup(template, POPUP_TYPE.TEXT, 'Toast History', {
                okButton: 'Clear',
                cancelButton: 'Close',
                allowVerticalScrolling: true,
                wider: true,
            });
            
            const result = await dlg.show();
            if (result === POPUP_RESULT.AFFIRMATIVE) {
                history.length = 0;
            }

        } catch (error) {
            console.error("Toast History: Error opening popup", error);
            alert("Failed to open Toast History panel. Check console (F12) for details.");
        }
    }; 

    const addToWandMenu = async () => {
        try {
            const buttonHtml = await $.get(`${extensionFolderPath}/button.html`);
            const extensionsMenu = $("#extensionsMenu");
            if (extensionsMenu.length > 0) {
                extensionsMenu.append(buttonHtml);
                $("#toast_history_button").on("click", openToastHistoryPopup);
            } else {
                setTimeout(addToWandMenu, 1000);
            }
        } catch (error) {
            console.error("Toast History: Failed to load button template.", error);
        }
    };

    const levels = {
        'info': { count: 0, dom: undefined },
        'success': { count: 0, dom: undefined },
        'warning': { count: 0, dom: undefined },
        'error': { count: 0, dom: undefined },
    };
    for (const level of Object.keys(levels)) {
        const original = toastr[level].bind(toastr);
        toastr[level] = (message, title, options)=>{
            const toast = original(message, title, options);
            if (toast && toast[0] && !settings.hideList.find(it=>it.level == level && it.textContent == toast[0].querySelector('.toast-message').innerHTML)) {
                history.push({ level, message, title, options, toast:/**@type {HTMLElement}*/(toast[0]?.cloneNode(true)), timestamp:new Date() });
            }
            return toast;
        };
    }

    addToWandMenu();

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'toasthistory-blocks',
        callback: (args, value)=>{
            const blockListElement = createBlockListElement();
            const dlg = new Popup(blockListElement, POPUP_TYPE.TEXT, "Blocked Toasts", { wider: true, cancelButton: 'Close' });
            dlg.show();
            return '';
        },
        helpString: 'Manage toasts excluded from Toast History.',
    }));
};
if (!extension_settings.disabledExtensions.includes('third-party/SillyTavern-ToastHistory-custom')) init();