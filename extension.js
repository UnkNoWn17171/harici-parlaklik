// Hızlı ayarlar menüsüne harici monitör parlaklık kaydırıcısı ekler.
// Monitörler `ddcutil detect` ile bulunur (DDC/CI destekleyen her monitör, hangi port olursa olsun).
// Monitör takılıp çıkarılınca liste yeniden kurulur; menü her açıldığında değer monitörden okunur
// (monitörün kendi tuşlarıyla yapılan değişiklikler de yansısın diye).

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {QuickSlider, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

const SET_DELAY_MS = 120;     // kaydırıcı sürüklenirken komut yağmurunu önleme
const REDETECT_DELAY_MS = 2500; // monitör takıldıktan sonra DDC'nin hazır olması için bekleme

function run(argv) {
    return new Promise((resolve, reject) => {
        const proc = Gio.Subprocess.new(argv,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                const [, out, err] = p.communicate_utf8_finish(res);
                if (p.get_successful())
                    resolve(out);
                else
                    reject(new Error(err.trim() || `${argv.join(' ')} başarısız`));
            } catch (e) {
                reject(e);
            }
        });
    });
}

// `ddcutil detect --brief` çıktısından geçerli monitörleri ayıklar: [{bus, name}]
function parseDetect(out) {
    const displays = [];
    for (const block of out.split(/\n\s*\n/)) {
        if (!/^Display \d+/m.test(block))
            continue; // "Invalid display" (ör. laptop paneli) atlanır
        const bus = block.match(/I2C bus:\s*\/dev\/i2c-(\d+)/);
        if (!bus)
            continue;
        const mon = block.match(/Monitor:\s*(.*)/);
        const parts = (mon?.[1] ?? '').split(':');
        displays.push({bus: bus[1], name: parts[1] || parts[0] || `i2c-${bus[1]}`});
    }
    return displays;
}

const DdcSlider = GObject.registerClass(
class DdcSlider extends QuickSlider {
    _init(display) {
        super._init({iconName: 'video-display-symbolic'});
        this._bus = display.bus;
        this._max = 100;
        this._busy = false;
        this._pending = null;
        this._timeoutId = 0;
        this.slider.accessible_name = `${display.name} parlaklığı`;

        this._changedId = this.slider.connect('notify::value', () => this._queueSet());
        this.refresh();
    }

    async refresh() {
        if (this._busy || this._timeoutId || this.slider._dragging)
            return;
        try {
            const out = await run(['ddcutil', 'getvcp', '10', '--bus', this._bus, '--brief']);
            const m = out.match(/VCP 10 C (\d+) (\d+)/);
            if (!m)
                return;
            this._max = Number(m[2]) || 100;
            this.slider.block_signal_handler(this._changedId);
            this.slider.value = Number(m[1]) / this._max;
            this.slider.unblock_signal_handler(this._changedId);
        } catch (e) {
            console.warn(`[harici-parlaklik] okuma hatası (i2c-${this._bus}): ${e.message}`);
        }
    }

    _queueSet() {
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SET_DELAY_MS, () => {
            this._timeoutId = 0;
            this._pending = Math.round(this.slider.value * this._max);
            this._flush();
            return GLib.SOURCE_REMOVE;
        });
    }

    // aynı anda tek ddcutil komutu; araya gelen değerlerden yalnız sonuncusu gönderilir
    async _flush() {
        if (this._busy || this._pending === null)
            return;
        this._busy = true;
        const value = this._pending;
        this._pending = null;
        try {
            await run(['ddcutil', 'setvcp', '10', String(value), '--bus', this._bus, '--noverify']);
        } catch (e) {
            console.warn(`[harici-parlaklik] yazma hatası (i2c-${this._bus}): ${e.message}`);
        }
        this._busy = false;
        this._flush();
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        super.destroy();
    }
});

const Indicator = GObject.registerClass(
class Indicator extends SystemIndicator {});

export default class HariciParlaklik extends Extension {
    enable() {
        this._qs = Main.panel.statusArea.quickSettings;
        this._indicator = new Indicator();
        this._sliders = [];
        this._detectId = 0;
        this._generation = 0;

        this._monitorsId = Main.layoutManager.connect('monitors-changed',
            () => this._scheduleDetect(REDETECT_DELAY_MS));
        this._menuId = this._qs.menu.connect('open-state-changed', (_m, open) => {
            if (open)
                this._sliders.forEach(s => s.refresh());
        });

        this._added = false;
        this._scheduleDetect(0);
    }

    disable() {
        if (this._detectId)
            GLib.source_remove(this._detectId);
        this._detectId = 0;
        this._generation++;
        Main.layoutManager.disconnect(this._monitorsId);
        this._qs.menu.disconnect(this._menuId);
        this._clearSliders();
        this._indicator.destroy();
        this._indicator = null;
        this._qs = null;
    }

    _scheduleDetect(delay) {
        if (this._detectId)
            GLib.source_remove(this._detectId);
        this._detectId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this._detectId = 0;
            this._detect();
            return GLib.SOURCE_REMOVE;
        });
    }

    async _detect() {
        const gen = ++this._generation;
        let displays = [];
        try {
            displays = parseDetect(await run(['ddcutil', 'detect', '--brief']));
        } catch (e) {
            console.warn(`[harici-parlaklik] algılama hatası: ${e.message}`);
        }
        if (gen !== this._generation)
            return; // bu arada devre dışı kaldı ya da yeni algılama başladı

        this._clearSliders();
        this._sliders = displays.map(d => new DdcSlider(d));
        this._sliders.forEach(s => this._indicator.quickSettingsItems.push(s));

        if (!this._added) {
            this._qs.addExternalIndicator(this._indicator, 2);
            this._added = true;
        } else {
            const sibling = this._qs._backgroundApps?.quickSettingsItems?.at(-1) ?? null;
            this._sliders.forEach(s => this._qs.menu.insertItemBefore(s, sibling, 2));
        }

        // laptop parlaklık kaydırıcısının hemen altına taşı
        let anchor = this._qs._brightness?.quickSettingsItems?.at(-1);
        const grid = this._qs.menu._grid;
        if (anchor && grid) {
            for (const s of this._sliders) {
                grid.set_child_above_sibling(s, anchor);
                anchor = s;
            }
        }
    }

    _clearSliders() {
        this._sliders.forEach(s => s.destroy());
        this._sliders = [];
        if (this._indicator)
            this._indicator.quickSettingsItems.length = 0;
    }
}
