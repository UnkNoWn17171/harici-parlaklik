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

## Kullanım
- Kaydırıcı laptop parlaklığının hemen altında, monitör ikonuyla görünür; her DDC/CI monitör için ayrı kaydırıcı çıkar.
- Sağdaki ok menüsü monitörün adını ve durumunu gösterir; "Değeri monitörden yeniden oku" ile monitör tuşlarıyla yapılan değişiklik çekilir.
- Menü her açıldığında değer monitörden okunur.

## Sorun giderme
Kontrol için terminalde (`<N>` = `ddcutil detect --brief` çıktısındaki I2C bus numarası):
```bash
ddcutil detect --brief
ddcutil getvcp 10 --bus <N>
ddcutil setvcp 10 50 --bus <N>
```
- **Monitör listede yok:** Monitör menüsünden DDC/CI'yı açın; `/dev/i2c-*` erişimini kontrol edin.
- **`setvcp` "Verification failed" diyor / kaydırıcı geri zıplıyor:** Monitör komutu kabul edip uygulamıyor.
  Eklenti bunu fark edip bildirim gösterir. Genelde monitör menüsünde parlaklığı kilitleyen bir mod açıktır:
  renk/görüntü modu (MSI'da *Pro Mode*) **User** olmalı; dinamik kontrast (*HDCR*/DCR), *Eye Saver*,
  *Anti Motion Blur/MPRT*, HDR gibi özellikler kapalı olmalı.
- **Kod güncellendiyse:** X11'de `Alt+F2` → `r`; Wayland'de oturumu kapatıp açın.
