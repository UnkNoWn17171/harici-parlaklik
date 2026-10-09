# Harici Monitör Parlaklığı (GNOME 46)

GNOME hızlı ayarlar menüsüne, laptop parlaklık kaydırıcısının altına harici monitör parlaklık kaydırıcısı ekler.
Parlaklık DDC/CI üzerinden `ddcutil` ile ayarlanır; takılan her DDC/CI monitör otomatik algılanır.

## Gereksinimler
- GNOME Shell 46
- `ddcutil` (`sudo apt install ddcutil`) ve `/dev/i2c-*` erişimi (`i2c` grubu ya da udev ACL)

## Kurulum
```bash
git clone <repo-url> ~/.local/share/gnome-shell/extensions/harici-parlaklik@mustafa
gnome-extensions enable harici-parlaklik@mustafa
```
X11'de `Alt+F2` → `r` ile kabuğu yeniden başlatın; Wayland'de oturumu kapatıp açın.
