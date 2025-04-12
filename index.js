import { extension_settings } from '../../../extensions.js';
import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../popup.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { Settings } from './src/Settings.js';

//TODO settings: select levels to capture
//x ignore toast (by message and level?)
//x history: onclick indicator (hey, you can click me!)
//x history: make toasts wider?
//TODO history: panel instead of popup?

const settings = new Settings();

const init = ()=>{
    /**@type {{level:string, message:string|JQuery, title:string, options:ToastrOptions, toast:HTMLElement, timestamp:Date}[]} */
    const history = [];
    const levels = {
        'info': { count: 0, dom: undefined },
        'success': { count: 0, dom: undefined },
        'warning': { count: 0, dom: undefined },
        'error': { count: 0, dom: undefined },
    };
    const trigger = document.createElement('div'); {
        trigger.classList.add('stth--trigger');
        trigger.title = 'no toasts';
        trigger.addEventListener('click', async()=>{
            const dom = document.createElement('div'); {
                dom.classList.add('stth--history');
                for (const item of history.toReversed()) {
                    const wrap = document.createElement('div'); {
                        wrap.classList.add('stth--item');
                        wrap.dataset.level = item.level;
                        const toast = /**@type {HTMLElement}*/(item.toast.cloneNode(true)); {
                            wrap.dataset.textContent = toast.querySelector('.toast-message').innerHTML;
                            if (item.options?.onclick) {
                                toast.classList.add('stth--hasListener');
                                $(toast).on('click', item.options.onclick);
                            }
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
                                hide.classList.add('stth--action');
                                hide.classList.add('stth--hide');
                                hide.classList.add('menu_button');
                                hide.classList.add('fa-solid', 'fa-fw', 'fa-ban');
                                hide.title = 'Suppress this toast\n---\nToasts with the same severity and message will no longer show up in the Toast History';
                                hide.addEventListener('click', ()=>{
                                    const is = wrap.classList.toggle('stth--isSuppressed');
                                    const same = /**@type {HTMLElement[]}*/([...dom.children]).filter(it=>it.dataset.level == item.level && it.dataset.textContent == item.toast.textContent);
                                    for (const el of same) {
                                        el.classList[is ? 'add' : 'remove']('stth--isSuppressed');
                                    }
                                    if (is) {
                                        settings.hideList.push({ textContent:item.toast.querySelector('.toast-message').innerHTML, level:item.level });
                                    } else {
                                        const idx = settings.hideList.findIndex(it=>it.textContent == item.toast.querySelector('.toast-message').innerHTML && it.level == item.level);
                                        if (idx > -1) {
                                            settings.hideList.splice(idx, 1);
                                        }
                                    }
                                    settings.save();
                                });
                                actions.append(hide);
                            }
                            if (item.options?.onclick) {
                                const click = document.createElement('div'); {
                                    click.classList.add('stth--action');
                                    click.classList.add('stth--click');
                                    click.classList.add('menu_button');
                                    click.classList.add('fa-solid', 'fa-fw', 'fa-shake', 'fa-hand-pointer');
                                    click.title = 'This toast will do something if you click it!';
                                    click.addEventListener('click', ()=>$(toast).trigger('click'));
                                    actions.append(click);
                                }
                            }
                            wrap.append(actions);
                        }
                        dom.append(wrap);
                    }
                }
            }
            const dlg = new Popup(dom, POPUP_TYPE.TEXT, null, {
                okButton: 'Clear',
                cancelButton: 'Close',
                allowVerticalScrolling: true,
                wider: true,
            });
            const result = await dlg.show();
            if (result == POPUP_RESULT.AFFIRMATIVE) {
                trigger.title = 'no toasts';
                while (history.pop());
                for (const icon of Object.values(levels)) {
                    icon.dom.classList.remove('stth--isActive');
                    icon.count = 0;
                    icon.dom.dataset.count = icon.count;
                }
            }
        });
        for (const level of Object.keys(levels)) {
            /**@type {(message:string|JQuery, title?:string, overrides?:ToastrOptions)=>JQuery<HTMLElement>} */
            const original = toastr[level].bind(toastr);
            toastr[level] = (message, title, options)=>{
                const toast = original(message, title, options);
                if (!settings.hideList.find(it=>it.level == level && it.textContent == toast[0].querySelector('.toast-message').innerHTML)) {
                    const icon = levels[level];
                    if (icon) {
                        icon.count++;
                        if (icon.dom) {
                            icon.dom.classList.add('stth--isActive');
                            icon.dom.dataset.count = icon.count;
                        }
                    }
                    trigger.title = Object.entries(levels)
                        .filter(([level,data])=>data.count)
                        .map(([level,data])=>`${data.count} ${level}${data.count != 1 ? 's' : ''}`)
                        .join('\n')
                    ;
                    history.push({ level, message, title, options, toast:/**@type {HTMLElement}*/(toast[0]?.cloneNode(true)), timestamp:new Date() });
                }
                return toast;
            };
            const icon = document.createElement('div'); {
                levels[level].dom = icon;
                icon.classList.add('stth--icon');
                icon.classList.add(level);
                icon.dataset.level = level;
                trigger.append(icon);
            }
        }
    }
    document.querySelector('#top-settings-holder').prepend(trigger);

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'toasthistory-blocks',
        callback: (args, value)=>{
            const dom = document.createElement('div'); {
                dom.classList.add('stth--hideListDlg');
                const tbl = document.createElement('table'); {
                    const thead = document.createElement('thead'); {
                        const tr = document.createElement('tr'); {
                            for (const col of ['Severity', 'Message', '']) {
                                const th = document.createElement('th'); {
                                    th.textContent = col;
                                    tr.append(th);
                                }
                            }
                            thead.append(tr);
                        }
                        tbl.append(thead);
                    }
                    const tbody = document.createElement('tbody'); {
                        for (const item of settings.hideList) {
                            const tr = document.createElement('tr'); {
                                const sev = document.createElement('td'); {
                                    sev.textContent = item.level;
                                    tr.append(sev);
                                }
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
                                        del.classList.add('menu_button');
                                        del.classList.add('fa-solid', 'fa-fw', 'fa-trash-can');
                                        del.title = 'Remove item from block list';
                                        del.addEventListener('click', ()=>{
                                            const idx = settings.hideList.indexOf(item);
                                            if (idx > -1) {
                                                settings.hideList.splice(idx, 1);
                                                settings.save();
                                            }
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
            const dlg = new Popup(dom, POPUP_TYPE.TEXT, null, {
                wider: true,
            });
            dlg.show();
            return '';
        },
        helpString: 'Manage toasts excluded from Toast History.',
    }));
};
if (!extension_settings.disabledExtensions.includes('third-party/SillyTavern-ToastHistory')) init();
