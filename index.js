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

       const openToastHistoryPopup = async () => {
        try {
            const template = $(await renderExtensionTemplateAsync(`third-party/${extensionName}`, 'template'));
            const dom = template;
            
            // [수정] 이제 알림 목록은 '.stth-history-list' 안에 채워집니다.
            const historyList = dom.find('.stth-history-list');
            historyList.addClass('stth--history');

            if (history.length === 0) {
                const noHistoryMessage = document.createElement('div');
                noHistoryMessage.textContent = 'No recent notifications.';
                noHistoryMessage.style.textAlign = 'center';
                noHistoryMessage.style.padding = '20px';
                historyList.append(noHistoryMessage);
            } else {
                for (const item of history.toReversed()) {
                    const wrap = document.createElement('div'); {
                        wrap.classList.add('stth--item');
                        wrap.dataset.level = item.level; // <-- 필터링을 위해 종류를 저장해 둡니다.
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
                        if (settings.hideList.find(it=>it.level == wrap.dataset.level && it.textContent == wrap.dataset.textContent)) {
                            wrap.classList.add('stth--isSuppressed');
                        }
                        const actions = document.createElement('div'); {
                            actions.classList.add('stth--actions');
                            const hide = document.createElement('div'); {
                                hide.classList.add('stth--action', 'stth--hide', 'menu_button', 'fa-solid', 'fa-fw', 'fa-ban');
                                hide.title = 'Suppress this toast\n---\nToasts with the same severity and message will no longer show up in the Toast History';
                                hide.addEventListener('click', ()=>{
                                    const is = wrap.classList.toggle('stth--isSuppressed');
                                    const same = /**@type {HTMLElement[]}*/([...historyList.children()]).filter(it=>it.dataset.level == item.level && it.dataset.textContent == item.toast.textContent);
                                    for (const el of same) { el.classList[is ? 'add' : 'remove']('stth--isSuppressed'); }
                                    if (is) {
                                        settings.hideList.push({ textContent:item.toast.querySelector('.toast-message').innerHTML, level:item.level });
                                    } else {
                                        const idx = settings.hideList.findIndex(it=>it.textContent == item.toast.querySelector('.toast-message').innerHTML && it.level == item.level);
                                        if (idx > -1) { settings.hideList.splice(idx, 1); }
                                    }
                                    settings.save();
                                });
                                actions.append(hide);
                            }
                            if (item.options?.onclick) {
                                const click = document.createElement('div'); {
                                    click.classList.add('stth--action', 'stth--click', 'menu_button', 'fa-solid', 'fa-fw', 'fa-shake', 'fa-hand-pointer');
                                    click.title = 'This toast will do something if you click it!';
                                    click.addEventListener('click', ()=>$(toast).trigger('click'));
                                    actions.append(click);
                                }
                            }
                            wrap.append(actions);
                        }
                        historyList.append(wrap);
                    }
                }
            }

            // [추가!] 탭 버튼에 클릭 이벤트를 추가하는 로직입니다.
            const tabs = dom.find('.stth-tabs button');
            const items = historyList.find('.stth--item');
            tabs.on('click', function() {
                const level = $(this).data('level');

                // 모든 탭의 'active' 스타일을 제거하고, 클릭된 탭에만 추가합니다.
                tabs.removeClass('active');
                $(this).addClass('active');

                // 모든 알림 목록을 순회하면서 필터링합니다.
                items.each(function() {
                    if (level === 'all' || $(this).data('level') === level) {
                        $(this).css('display', 'flex'); // 보이기
                    } else {
                        $(this).css('display', 'none');  // 숨기기
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
            if (result == POPUP_RESULT.AFFIRMATIVE) {
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

    // 원래 코드의 '알림 가로채기' 로직
    const levels = {
        'info': { count: 0, dom: undefined },
        'success': { count: 0, dom: undefined },
        'warning': { count: 0, dom: undefined },
        'error': { count: 0, dom: undefined },
    };
    for (const level of Object.keys(levels)) {
        /**@type {(message:string|JQuery, title?:string, overrides?:ToastrOptions)=>JQuery<HTMLElement>} */
        const original = toastr[level].bind(toastr);
        toastr[level] = (message, title, options)=>{
            const toast = original(message, title, options);
            if (toast && toast[0] && !settings.hideList.find(it=>it.level == level && it.textContent == toast[0].querySelector('.toast-message').innerHTML)) {
                history.push({ level, message, title, options, toast:/**@type {HTMLElement}*/(toast[0]?.cloneNode(true)), timestamp:new Date() });
            }
            return toast;
        };
    }

    // 마술봉 메뉴에 버튼 추가
    addToWandMenu();

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'toasthistory-blocks',
        callback: (args, value)=>{
            const dom = document.createElement('div'); {
                dom.classList.add('stth--hideListDlg');
                const tbl = document.createElement('table'); {
                    const thead = document.createElement('thead'); {
                        const tr = document.createElement('tr'); {
                            for (const col of ['Severity', 'Message', '']) {
                                const th = document.createElement('th'); { th.textContent = col; tr.append(th); }
                            }
                            thead.append(tr);
                        }
                        tbl.append(thead);
                    }
                    const tbody = document.createElement('tbody'); {
                        for (const item of settings.hideList) {
                            const tr = document.createElement('tr'); {
                                const sev = document.createElement('td'); { sev.textContent = item.level; tr.append(sev); }
                                const mes = document.createElement('td'); {
                                    const wrap = document.createElement('div'); {
                                        wrap.classList.add('toast-message');
                                        wrap.innerHTML = item.textContent;
                                        mes.append(wrap);
                                    }
                                    tr.append(mes);
                                }
                                const actions = document.createElement('td'); {
                                    const del = document.createElement('div'); {
                                        del.classList.add('menu_button', 'fa-solid', 'fa-fw', 'fa-trash-can');
                                        del.title = 'Remove item from block list';
                                        del.addEventListener('click', ()=>{
                                            const idx = settings.hideList.indexOf(item);
                                            if (idx > -1) { settings.hideList.splice(idx, 1); settings.save(); }
                                            tr.remove();
                                        });
                                        actions.append(del);
                                    }
                                    tr.append(actions);
                                }
                                tbody.append(tr);
                            }
                        }
                        tbl.append(tbody);
                    }
                    dom.append(tbl);
                }
            }
            const dlg = new Popup(dom, POPUP_TYPE.TEXT, null, { wider: true });
            dlg.show();
            return '';
        },
        helpString: 'Manage toasts excluded from Toast History.',
    }));
};
if (!extension_settings.disabledExtensions.includes('third-party/SillyTavern-ToastHistory-custom')) init();
