# OnGlazz – živý náhled produktů

Widget, který na produktové stránce onglazz.cz vykresluje živý náhled personalizovaného
produktu: fotku zákazníka a jeho texty přímo v produktové fotce.

## Co je v balíčku

| Soubor | K čemu |
| --- | --- |
| `widget.js` | Jádro: hledá pole formuláře, kreslí náhled, posun a přiblížení fotky, export k objednávce. Mění se zřídka. |
| `templates.js` | Šablony produktů. Sem přibývá nová šablona s každým novým produktem. |
| `images/` | Produktové fotky pro šablony, jméno souboru = adresa produktu (`vinylova-deska-skladba.webp`). |
| `test.js` | Test na živém webu přes záložku, bez zásahu IT. |
| `index.html` | Ukázková stránka – po nasazení se otevře na adrese hostingu. |
| `_headers` | Nastavení pro Cloudflare Pages (povolí načítání obrázků z onglazz.cz, krátká cache). |
| `nastroje/` | Záložky do prohlížeče a skript, který je vytvoří. |

## 1. Repozitář na GitHubu

Nepotřebujete nic instalovat, vše jde v prohlížeči.

1. Přihlaste se na [github.com](https://github.com) (nebo si zdarma založte účet).
2. Vpravo nahoře **+** → **New repository**.
3. Název `onglazz-preview`, zvolte **Private**, nic dalšího nezaškrtávejte a dejte **Create repository**.
4. Na stránce nového repozitáře klikněte na **uploading an existing file**.
5. Přetáhněte do okna **obsah** této složky (soubory a složky `images` a `nastroje`, ne složku samotnou).
6. Dole klikněte **Commit changes**.

## 2. Hosting na Cloudflare Pages

1. Přihlaste se na [dash.cloudflare.com](https://dash.cloudflare.com) (účet zdarma stačí).
2. V menu **Workers & Pages** → **Create** → záložka **Pages** → **Connect to Git**.
3. Propojte GitHub účet a vyberte repozitář `onglazz-preview`.
4. Nastavení sestavení:
   - **Framework preset:** None
   - **Build command:** nechte prázdné
   - **Build output directory:** `/`
5. **Save and Deploy**. Za minutu je web na adrese `https://onglazz-preview.pages.dev`
   (pokud byl název obsazený, Cloudflare ukáže jinou adresu – tu si poznamenejte).
6. Zkontrolujte, že se na té adrese otevře ukázková stránka s vinylem.

**Vlastní adresa `preview.onglazz.cz` (volitelné):** v projektu na Cloudflare
**Custom domains** → **Set up a custom domain** → `preview.onglazz.cz`. Pokud doména
onglazz.cz není spravovaná v Cloudflare, Cloudflare ukáže záznam CNAME, který je potřeba
přidat u správce domény (`preview` → `onglazz-preview.pages.dev`).

**Alternativa GitHub Pages:** v repozitáři **Settings** → **Pages** → Source **Deploy from a branch**,
větev `main`, složka `/ (root)`. Repozitář pak musí být veřejný (u bezplatného účtu).
Soubor `_headers` GitHub Pages ignoruje, ale potřebné hlavičky posílá sám.

## 3. Záložka pro test na živém webu

V `nastroje/` jsou dvě záložky:

- `zalozka-hosting.txt` – krátká, při každém kliknutí načte nejnovější soubory z hostingu.
  Je připravená pro `https://mullerlukas15.github.io/onglazz-preview/` (GitHub Pages). Pokud máte jinou adresu,
  stačí ji v textu přepsat.
- `zalozka-bez-hostingu.txt` – celý kód v záložce, funguje i bez hostingu. Po každé
  změně šablon je potřeba ji vytvořit znovu.

Jak záložku přidat v Safari: lišta oblíbených (**Zobrazení → Zobrazit lištu oblíbených**),
**Záložky → Přidat záložku** do Oblíbených, pak na ní pravým tlačítkem **Upravit adresu…**
a vložit celý obsah souboru. V Chrome: pravým tlačítkem na lištu záložek → **Přidat stránku…**
a obsah vložit do pole URL.

Pak otevřete produkt na onglazz.cz a klikněte na záložku. Náhled nahradí hlavní fotku,
žlutý štítek „Test náhledu · skrýt“ ho schová. Produkt bez šablony ukáže
„Tento produkt zatím nemá šablonu“.

## 4. Jak se mění šablony

1. Novou nebo upravenou šablonu připravíme v Claude.
2. Na GitHubu otevřete `templates.js` → ikona tužky → vložte novou verzi → **Commit changes**.
   Novou fotku produktu nahrajte do složky `images/` (**Add file → Upload files**).
3. Cloudflare web do minuty sám přenasadí. Záložka `zalozka-hosting.txt` načte novou
   verzi hned, zákazníci na webu ji uvidí nejpozději do 5 minut (cache).

Pokud se změna nepovede, na Cloudflare v **Deployments** jde jedním kliknutím vrátit
předchozí verzi.

## 5. Co udělá IT (jednou)

1. Načíst widget na celém webu (např. `head.script` v `nuxt.config.js`):
   `<script src="https://preview.onglazz.cz/widget.js" defer></script>`
2. Do galerie produktu, přes hlavní fotku, vložit prázdný kontejner
   `<div data-onglazz-preview></div>` a zobrazit ho jen u první fotky galerie.
   Produkt bez šablony nechá widget skrytý.
3. K inputům konfigurace vypsat klíč pole: `data-config-key="vinylova-deska-skladba-text-1-CZ"`.
4. Před přidáním do košíku zavolat export a uložit ho k objednávce (stejně jako obrázky
   u skleněných desek):

```js
const p = window.OnglazzPreview && OnglazzPreview.instances[0];
if (p) {
  const { preview, photo, crop, texts } = await p.exportForOrder();
  // preview = náhled celého produktu (JPG), photo = oříznutá fotka (JPG)
  // crop a texts = JSON s ořezem a texty
}
```
