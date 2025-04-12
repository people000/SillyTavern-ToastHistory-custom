import { saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';

export class Settings {
    /**@type {{textContent:string, level:string}[]} */
    hideList = [];


    constructor() {
        Object.assign(this, extension_settings.toastHistory ?? {});
    }

    save() {
        extension_settings.toastHistory = this;
        saveSettingsDebounced();
    }
}
