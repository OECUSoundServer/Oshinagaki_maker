/* ========= 状態（保存/履歴なしの軽量版） ========= */
const state = {
  paper: { size: "A4", orientation: "portrait", margin: 10 },
  header: {
    logoMode: "text",
    circle: "サークル名",
    logoSrc: "",
    space: "配置",
    title: "頒布物一覧",
    band: "#d98181",
    bandLabel: "イベント名",
    bandHeight: 6,     // mm
    bandInset: 0       // mm
  },
  sections: { music: { name: "新譜", size: "large", items: [] } },
  order: ["music"],

  note: "その他頒布物の詳細はコチラ→",
  qrUrl: "",

  typography: { family: "Noto Sans JP", basePt: 11 },

  layout: { userScale: 100, autoScale: 100 },   // %（総合 = auto × user）
  itemBorder: { on: true, width: 0.3 },         // mm
  appearance: { priceStyle: "box", tagStyle: "outline" },

  grid: { sectionGap: 8, itemsGap: 4, largeMin: 70, smallMin: 42, colsLarge: 0, colsSmall: 0, align: "start" },

  background: { mode: "color", color: "#ffffff", imageSrc: "", fit: "cover" },

  editing: null
};

/* ========= 参照 ========= */
const el = {
  paper: g("paper"),
  sectionsRoot: g("sections-root"),
  secSelect: g("sec"),
  sectionList: g("section-list"),
  content: document.querySelector(".content"),
  contentInner: document.querySelector(".content-inner"),
  editIndicator: g("edit-indicator"),
  btnAdd: g("btn-add-item"),
  btnUpdate: g("btn-update-item"),
  btnCancelEdit: g("btn-cancel-edit"),
  btnDelete: g("btn-delete-item")
};
const gf = g("gf");

/* ========= 定数/ユーティリティ ========= */
const sizeMap = {
  A3: { w: "297mm", h: "420mm" },
  A4: { w: "210mm", h: "297mm" },
  A5: { w: "148mm", h: "210mm" }
};
const gfMap = {
  "Noto Sans JP": "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap",
  "M PLUS 1p": "https://fonts.googleapis.com/css2?family=M+PLUS+1p:wght@400;700;900&display=swap",
  "Kosugi Maru": "https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap",
  "Shippori Mincho": "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700;800&display=swap"
};
const uid = () => Math.random().toString(36).slice(2, 9);
const cssVar = (k,v,target=document.documentElement)=>target.style.setProperty(k,v);

function g(id){ return document.getElementById(id); }
function qs(sel){ return document.querySelector(sel); }
function ce(tag, cls){ const n=document.createElement(tag); if(cls) n.className=cls; return n; }
function v(id){ return g(id).value.trim(); }

/* ========= 画像：圧縮読み込み（最大辺1600px, JPEG85%） ========= */
async function fileToDataURL(file, maxSide = 1600, quality = 0.85){
  const bmp = await createImageBitmap(file);
  const { width, height } = bmp;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const cvs = document.createElement("canvas");
  cvs.width = w; cvs.height = h;
  const ctx = cvs.getContext("2d");
  ctx.drawImage(bmp, 0, 0, w, h);
  const mime = /png$/i.test(file.type) ? "image/png" : "image/jpeg";
  const dataUrl = cvs.toDataURL(mime, mime==="image/jpeg" ? quality : 1);
  bmp.close();
  return dataUrl;
}

/* ========= 自動スケール（チカチカ解消版） ========= */
let _recalcTimer = null;
function recomputeAutoScale(){
  clearTimeout(_recalcTimer);
  _recalcTimer = setTimeout(()=>{
    const cs = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--content-scale")) || 1;
    (window.requestIdleCallback || window.requestAnimationFrame)(()=>{
      const inner = el.contentInner.getBoundingClientRect();
      const frame = el.content.getBoundingClientRect();
      const innerW = inner.width / cs;
      const innerH = inner.height / cs;
      const auto = Math.min(frame.width/innerW, frame.height/innerH, 1) || 1;
      state.layout.autoScale = Math.round(auto * 100);
      applyContentScale();
    });
  }, 80);
}
function applyContentScale(){
  const total = (state.layout.autoScale/100) * (state.layout.userScale/100);
  cssVar("--content-scale", String(total));
}

/* ========= 見た目適用 ========= */
function applyItemBorder(){
  const visible = state.itemBorder.on && state.itemBorder.width > 0 ? 1 : 0;
  cssVar("--item-border-visible", String(visible));
  cssVar("--item-border-width", `${Math.max(0, state.itemBorder.width)}mm`);
}
function applyAppearance(){
  cssVar("--price-style", state.appearance.priceStyle);
  cssVar("--tag-style", state.appearance.tagStyle);
}
function applyGridVars(){
  cssVar("--section-gap", `${state.grid.sectionGap}mm`);
  cssVar("--items-gap", `${state.grid.itemsGap}mm`);
  cssVar("--card-large-min", `${state.grid.largeMin}mm`);
  cssVar("--card-small-min", `${Math.min(state.grid.smallMin, Math.max(31, state.grid.largeMin-1))}mm`);
  cssVar("--cols-large", String(Math.max(0, state.grid.colsLarge|0)));
  cssVar("--cols-small", String(Math.max(0, state.grid.colsSmall|0)));
  cssVar("--grid-justify", state.grid.align);
  recomputeAutoScale();
}
function applyBandTune(){
  cssVar("--band-height", `${state.header.bandHeight}mm`);
  cssVar("--band-inset", `${state.header.bandInset}mm`);
}

/* ========= 背景適用 ========= */
function applyBackground(){
  const p = el.paper;
  const {mode, color, imageSrc, fit} = state.background;

  if(mode === "none"){
    cssVar("--paper-bg-color", "#ffffff", p);
    cssVar("--paper-bg-image", "none", p);
    cssVar("--paper-bg-size", "auto", p);
    cssVar("--paper-bg-repeat", "no-repeat", p);
  } else if(mode === "color"){
    cssVar("--paper-bg-color", color || "#ffffff", p);
    cssVar("--paper-bg-image", "none", p);
    cssVar("--paper-bg-size", "auto", p);
    cssVar("--paper-bg-repeat", "no-repeat", p);
  } else { // image
    cssVar("--paper-bg-color", "#ffffff", p); // 下地は白
    cssVar("--paper-bg-image", imageSrc ? `url("${imageSrc}")` : "none", p);
    if(fit === "tile"){
      cssVar("--paper-bg-size", "auto", p);
      cssVar("--paper-bg-repeat", "repeat", p);
    }else{
      cssVar("--paper-bg-size", fit === "contain" ? "contain" : "cover", p);
      cssVar("--paper-bg-repeat", "no-repeat", p);
    }
  }
}

/* ========= レンダリング ========= */
function renderHeader(){
  const logo = document.querySelector(".logo");
  const logoText = logo.querySelector(".logo-text");
  const logoImg = logo.querySelector(".logo-img");
  logo.classList.toggle("image", state.header.logoMode === "image");

  logoText.textContent = state.header.circle;
  if(state.header.logoSrc){ logoImg.src = state.header.logoSrc; } else { logoImg.removeAttribute("src"); }

  qs(".spaceno").textContent = state.header.space;
  qs(".title").textContent = state.header.title;
  qs(".band").style.background = state.header.band;
  qs(".band-label").textContent = state.header.bandLabel;
  cssVar("--band", state.header.band);
  applyBandTune();
  recomputeAutoScale();
}

function renderSectionList(){
  el.sectionList.innerHTML = "";
  state.order.forEach(id=>{
    const s = state.sections[id];
    const li = document.createElement("li");

    const name = document.createElement("div");
    name.className = "name";
    name.contentEditable = "true";
    name.textContent = s.name;
    name.addEventListener("input", ()=>{
      s.name = name.textContent;
      if(/新譜|新刊|新作/.test(s.name)) s.size = s.size || "large";
      renderSections(); refreshSectionSelect();
    });

    const density = document.createElement("button");
    density.textContent = s.size === "large" ? "大" : "小";
    density.style.minWidth = "2.5em";
    density.addEventListener("click", ()=>{
      s.size = (s.size === "large" ? "small" : "large");
      density.textContent = s.size === "large" ? "大" : "小";
      renderSections();
    });

    const del = document.createElement("button");
    del.className = "btn-del"; del.textContent = "🗑";
    del.addEventListener("click", ()=>{
      if(!confirm(`「${s.name}」を削除しますか？（アイテムも消えます）`)) return;
      delete state.sections[id];
      state.order = state.order.filter(x=>x!==id);
      renderSectionList(); renderSections(); refreshSectionSelect();
    });

    li.appendChild(name);
    li.appendChild(density);
    li.appendChild(del);
    el.sectionList.appendChild(li);
  });

  new Sortable(el.sectionList, {
    animation: 120,
    onEnd: (ev)=>{
      const [moved] = state.order.splice(ev.oldIndex,1);
      state.order.splice(ev.newIndex,0,moved);
      renderSections(); refreshSectionSelect();
    }
  });
}

function renderSections(){
  el.sectionsRoot.innerHTML = "";
  state.order.forEach(id=>{
    const sec = state.sections[id];
    const wrap = ce("section", "section");
    wrap.dataset.size = sec.size || (/新譜|新刊|新作/.test(sec.name) ? "large" : "small");
    wrap.dataset.cols = (wrap.dataset.size === "large" ? state.grid.colsLarge : state.grid.colsSmall) || 0;

    const h2 = ce("h2"); h2.contentEditable = "true"; h2.textContent = sec.name;
    h2.addEventListener("input", ()=>{
      sec.name = h2.textContent;
      if(!sec.size && /新譜|新刊|新作/.test(sec.name)) sec.size = "large";
      renderSectionList();
    });

    const ul = ce("ul", "items"); ul.id = `items-${id}`;
    wrap.appendChild(h2); wrap.appendChild(ul); el.sectionsRoot.appendChild(wrap);

    ul.innerHTML = "";
    sec.items.forEach((it,idx)=>{
      const li = ce("li", "item");
      if(it.layout === "right") li.classList.add("layout-right");

      li.addEventListener("click", (e)=>{ e.stopPropagation(); startEditItem(id, idx); });

      const img = ce("img", "thumb"); img.src = it.src; img.alt = it.title || "";
      li.appendChild(img);

      /* --- バッジ：NEW（左上）＋ R18/R18G（右上で縦積み） --- */

      // NEW：画像優先、なければテキスト
      if(it.badgeSrc){
        const bi = ce("img", "badge-img"); bi.src = it.badgeSrc; li.appendChild(bi);
      } else if(it.isNew){
        const b = ce("div", "badge"); b.textContent = "NEW"; li.appendChild(b);
      }

      // 右上：積み上げ表示用の位置管理
      let rightTopMm = 2;
      const pushRight = (node)=>{
        node.style.top = `${rightTopMm}mm`;
        node.style.right = `2mm`;
        rightTopMm += 14; // 12mm + 間隔2mm
      };

      // R18（画像優先）
      if(it.badgeR18Src){
        const bi = ce("img", "badge-img-r18"); bi.src = it.badgeR18Src;
        pushRight(bi); li.appendChild(bi);
      } else if(it.isR18){
        const b = ce("div", "badge-r18"); b.textContent = "R18";
        pushRight(b); li.appendChild(b);
      }

      // R18G（画像優先）
      if(it.badgeR18GSrc){
        const bi = ce("img", "badge-img-r18g"); bi.src = it.badgeR18GSrc;
        pushRight(bi); li.appendChild(bi);
      } else if(it.isR18G){
        const b = ce("div", "badge-r18g"); b.textContent = "R18G";
        pushRight(b); li.appendChild(b);
      }

      /* --- /バッジ --- */

      const textBox = ce("div");
      if(it.layout === "right") li.appendChild(textBox);

      const caption = ce("div", "caption"); caption.textContent = it.title || "";
      const desc = ce("div", "desc"); if(it.desc) desc.textContent = it.desc;

      const meta = ce("div", "meta");
      if(it.pages){ meta.appendChild(tagEl(`${it.pages}ページ`)); }
      if(it.tracks){ meta.appendChild(tagEl(`${it.tracks}曲`)); }
      if(Array.isArray(it.customTags)){
        it.customTags.filter(Boolean).forEach(t=> meta.appendChild(tagEl(t)));
      }

      if(it.layout === "right"){
        textBox.appendChild(caption);
        if(it.desc) textBox.appendChild(desc);
        if(meta.childElementCount) textBox.appendChild(meta);
      }else{
        li.appendChild(caption);
        if(it.desc) li.appendChild(desc);
        if(meta.childElementCount) li.appendChild(meta);
      }

      if (it.price && state.appearance.priceStyle!=="none") {
        const price = ce("div", "price"); price.textContent = it.price; li.appendChild(price);
      }

      ul.appendChild(li);
    });

    new Sortable(ul, {
      animation: 120,
      onEnd: (ev)=>{
        const arr = sec.items;
        const [moved] = arr.splice(ev.oldIndex,1);
        arr.splice(ev.newIndex,0,moved);
      }
    });
  });

  recomputeAutoScale();
}

function tagEl(text){
  const t = ce("span", "tag");
  t.textContent = text;
  return t;
}

function refreshSectionSelect(){
  const cur = el.secSelect.value;
  el.secSelect.innerHTML = "";
  state.order.forEach(id=>{
    const op = document.createElement("option");
    op.value = id;
    op.textContent = state.sections[id].name;
    el.secSelect.appendChild(op);
  });
  if(cur && state.sections[cur]) el.secSelect.value = cur;
}

/* ========= 再描画まとめ ========= */
function rerenderAll(){
  applyPaper(); applyTypography(); renderHeader();
  renderSectionList(); renderSections(); refreshSectionSelect();
  applyItemBorder(); applyAppearance(); applyGridVars(); applyBandTune(); applyBackground();
}

/* ========= スタイル適用 ========= */
function applyPaper() {
  cssVar("--paper-w", sizeMap[state.paper.size].w);
  cssVar("--paper-h", sizeMap[state.paper.size].h);
  cssVar("--margin", `${state.paper.margin}mm`);
  el.paper.classList.toggle("landscape", state.paper.orientation === "landscape");

  const printStyle = document.getElementById("print-style") || (() => {
    const s = document.createElement("style"); s.id="print-style"; document.head.appendChild(s); return s;
  })();
  printStyle.innerHTML = `@media print { @page { size: ${state.paper.size} ${state.paper.orientation}; margin: 0; } }`;
  recomputeAutoScale();
}
function applyTypography(){
  const fam = state.typography.family;
  gf.href = gfMap[fam] || gfMap["Noto Sans JP"];
  cssVar("--font", `"${fam}", system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN","Yu Gothic", sans-serif`);
  cssVar("--base-pt", `${state.typography.basePt}pt`);
  recomputeAutoScale();
}

/* ========= 入力・操作 ========= */
// 用紙
on("paper-size","change", e=>{ state.paper.size = e.target.value; rerenderAll(); });
on("paper-orientation","change", e=>{ state.paper.orientation = e.target.value; rerenderAll(); });
on("paper-margin","input", e=>{ state.paper.margin = +e.target.value; rerenderAll(); });
on("safe-area","change", e=>{ el.paper.classList.toggle("show-safe", e.target.checked); });
on("grid","change", e=>{ el.paper.classList.toggle("show-grid", e.target.checked); });

// フォント
on("font-family","change", e=>{ state.typography.family = e.target.value; rerenderAll(); });
on("base-pt","input", e=>{ state.typography.basePt = Math.max(8, Math.min(24, +e.target.value || 11)); rerenderAll(); });

// 背景
on("bg-mode","change", e=>{
  state.background.mode = e.target.value;
  g("bg-color-wrap").style.display      = (state.background.mode==="color") ? "" : "none";
  g("bg-image-wrap").style.display      = (state.background.mode==="image") ? "" : "none";
  applyBackground(); recomputeAutoScale();
});
on("bg-color","input", e=>{
  state.background.color = e.target.value || "#ffffff";
  applyBackground();
});
on("bg-image-source","change", e=>{
  const m = e.target.value;
  g("bg-image-file-row").style.display = (m==="file") ? "" : "none";
  g("bg-image-url-row").style.display  = (m==="url")  ? "" : "none";
});
on("bg-image-file","change", async e=>{
  const f = e.target.files[0]; if(!f) return;
  state.background.imageSrc = await fileToDataURL(f, 2000, 0.9);
  applyBackground(); recomputeAutoScale();
});
on("bg-image-url","change", e=>{
  state.background.imageSrc = e.target.value.trim();
  applyBackground(); recomputeAutoScale();
});
on("bg-fit","change", e=>{
  state.background.fit = e.target.value; applyBackground();
});

// 手動スケール
on("content-scale","input", e=>{ state.layout.userScale = +e.target.value; applyContentScale(); });

// ヘッダー（ロゴ/帯）
on("logo-mode","change", e=>{
  state.header.logoMode = e.target.value;
  g("logo-text-wrap").style.display = e.target.value === "text" ? "" : "none";
  g("logo-image-wrap").style.display = e.target.value === "image" ? "" : "none";
  renderHeader();
});
on("circle-name","input", e=>{ state.header.circle = e.target.value; renderHeader(); });
on("circle-logo","change", async e=>{
  const f = e.target.files[0]; if(!f) return;
  state.header.logoSrc = await fileToDataURL(f);
  renderHeader();
});
on("space-no","input", e=>{ state.header.space = e.target.value; renderHeader(); });
on("title","input", e=>{ state.header.title = e.target.value; renderHeader(); });
on("band-color","input", e=>{ state.header.band = e.target.value; renderHeader(); });
on("band-label","input", e=>{ state.header.bandLabel = e.target.value; renderHeader(); });
on("band-height","input", e=>{ state.header.bandHeight = +e.target.value; applyBandTune(); recomputeAutoScale(); });
on("band-inset","input", e=>{ state.header.bandInset = +e.target.value; applyBandTune(); recomputeAutoScale(); });

// contenteditable → state
[".logo-text",".spaceno",".title",".band-label","#note-view"].forEach(sel=>{
  const n = document.querySelector(sel);
  n.addEventListener("input", ()=>{
    state.header.circle    = qs(".logo-text").textContent;
    state.header.space     = qs(".spaceno").textContent;
    state.header.title     = qs(".title").textContent;
    state.header.bandLabel = qs(".band-label").textContent;
    state.note             = g("note-view").textContent;
    recomputeAutoScale();
  });
});

// セクション管理
on("btn-add-section","click", ()=>{
  const name = g("new-section-name").value.trim();
  if(!name) return;
  const idd = uid();
  const size = /新譜|新刊|新作/.test(name) ? "large" : "small";
  state.sections[idd] = { name, size, items: [] };
  state.order.push(idd);
  g("new-section-name").value = "";
  renderSectionList(); renderSections(); refreshSectionSelect();
});

// 余白やサイズ類
on("section-gap","input", e=>{ state.grid.sectionGap = +e.target.value; applyGridVars(); });
on("items-gap","input", e=>{ state.grid.itemsGap = +e.target.value; applyGridVars(); });
on("card-large-min","input", e=>{ state.grid.largeMin = +e.target.value; applyGridVars(); });
on("card-small-min","input", e=>{ state.grid.smallMin = +e.target.value; applyGridVars(); });

// 列数と横揃え
on("cols-large", "input", e=>{
  state.grid.colsLarge = Math.max(0, parseInt(e.target.value||"0",10));
  renderSections(); applyGridVars();
});
on("cols-small", "input", e=>{
  state.grid.colsSmall = Math.max(0, parseInt(e.target.value||"0",10));
  renderSections(); applyGridVars();
});
on("grid-align", "change", e=>{
  state.grid.align = e.target.value; // start | center | end
  applyGridVars();
});

// アイテム画像ソースUI
on("item-image-source","change", e=>{
  const mode = e.target.value;
  g("item-image-file-wrap").style.display = (mode === "file") ? "" : "none";
  g("item-image-url-wrap").style.display  = (mode === "url")  ? "" : "none";
});

// アイテム追加
on("btn-add-item","click", async ()=>{
  const sec = el.secSelect.value;
  const title = v("item-title");
  const price = v("item-price");
  const sourceMode = g("item-image-source").value;

  let src = "";
  if(sourceMode === "file"){
    const file = g("item-image").files[0]; if(!file){ alert("画像を選択してください"); return; }
    src = await fileToDataURL(file);
  }else{
    const url = v("item-image-url"); if(!url){ alert("画像URLを入力してください"); return; }
    src = url;
  }

  const isNew  = g("item-isnew").checked;
  const isR18  = g("item-isr18").checked;
  const isR18G = g("item-isr18g").checked;

  const badgeFileNew  = g("item-badge-image").files[0];
  const badgeFileR18  = g("item-badge-r18-image").files[0];
  const badgeFileR18G = g("item-badge-r18g-image").files[0];

  const desc   = v("item-desc");
  const layout = g("item-layout").value;
  const pages  = +v("item-pages") || 0;
  const tracks = +v("item-tracks") || 0;

  const customTags = v("item-custom-tags")
    .split(/[、,]/).map(s=>s.trim()).filter(Boolean);

  const [badgeSrc, badgeR18Src, badgeR18GSrc] = await Promise.all([
    badgeFileNew  ? fileToDataURL(badgeFileNew)  : Promise.resolve(""),
    badgeFileR18  ? fileToDataURL(badgeFileR18)  : Promise.resolve(""),
    badgeFileR18G ? fileToDataURL(badgeFileR18G) : Promise.resolve("")
  ]);

  state.sections[sec].items.push({
    title, price, src, isNew, badgeSrc,
    isR18, badgeR18Src,
    isR18G, badgeR18GSrc,
    desc, layout, pages, tracks,
    customTags
  });

  clearItemForm();
  renderSections();
});

// アイテム編集（開始/反映/削除/キャンセル）
function startEditItem(secId, index){
  const it = state.sections[secId].items[index];
  state.editing = {secId, index};
  el.editIndicator.hidden = false;
  g("sec").value = secId;

  g("item-title").value = it.title || "";
  g("item-price").value = it.price || "";

  g("item-isnew").checked  = !!it.isNew;
  g("item-isr18").checked  = !!it.isR18;
  g("item-isr18g").checked = !!it.isR18G;

  g("item-desc").value   = it.desc || "";
  g("item-layout").value = it.layout || "below";
  g("item-pages").value  = it.pages || "";
  g("item-tracks").value = it.tracks || "";

  g("item-custom-tags").value = (it.customTags || []).join(", ");

  g("item-image-source").value = it.src && /^https?:/.test(it.src) ? "url" : "file";
  g("item-image-file-wrap").style.display = g("item-image-source").value==="file" ? "" : "none";
  g("item-image-url-wrap").style.display  = g("item-image-source").value==="url"  ? "" : "none";
  g("item-image-url").value = /^https?:/.test(it.src) ? it.src : "";

  el.btnAdd.hidden = true;
  el.btnUpdate.hidden = false;
  el.btnCancelEdit.hidden = false;
  el.btnDelete.hidden = false;
}
function applyEditToItem(){
  if(!state.editing) return;
  const {secId,index} = state.editing;
  const it = state.sections[secId].items[index];

  it.title = v("item-title");
  it.price = v("item-price");

  it.isNew  = g("item-isnew").checked;
  it.isR18  = g("item-isr18").checked;
  it.isR18G = g("item-isr18g").checked;

  it.desc   = v("item-desc");
  it.layout = g("item-layout").value;
  it.pages  = +v("item-pages") || 0;
  it.tracks = +v("item-tracks") || 0;

  it.customTags = v("item-custom-tags").split(/[、,]/).map(s=>s.trim()).filter(Boolean);

  const mode = g("item-image-source").value;
  if(mode==="url"){
    const url = v("item-image-url"); if(url) it.src = url;
  }else{
    const file = g("item-image").files[0];
    if(file){ fileToDataURL(file).then(data=>{ it.src = data; renderSections(); }); }
  }

  const badgeFileNew  = g("item-badge-image").files[0];
  const badgeFileR18  = g("item-badge-r18-image").files[0];
  const badgeFileR18G = g("item-badge-r18g-image").files[0];
  Promise.all([
    badgeFileNew  ? fileToDataURL(badgeFileNew)  : Promise.resolve(null),
    badgeFileR18  ? fileToDataURL(badgeFileR18)  : Promise.resolve(null),
    badgeFileR18G ? fileToDataURL(badgeFileR18G) : Promise.resolve(null),
  ]).then(([bNew, bR18, bR18G])=>{
    if(bNew  !== null) it.badgeSrc      = bNew;
    if(bR18  !== null) it.badgeR18Src   = bR18;
    if(bR18G !== null) it.badgeR18GSrc  = bR18G;
    clearItemForm();
    renderSections();
  });
}
function deleteEditingItem(){
  if(!state.editing) return;
  const {secId,index} = state.editing;
  state.sections[secId].items.splice(index,1);
  clearItemForm();
  renderSections();
}
function cancelEdit(){
  state.editing = null;
  clearItemForm();
}
function clearItemForm(){
  el.editIndicator.hidden = true;
  g("item-title").value = "";
  g("item-price").value = "";
  g("item-image").value = "";
  g("item-image-url").value = "";
  g("item-image-source").value = "file";
  g("item-image-file-wrap").style.display = "";
  g("item-image-url-wrap").style.display = "none";

  g("item-isnew").checked = false;
  g("item-badge-image").value = "";
  g("item-isr18").checked = false;
  g("item-badge-r18-image").value = "";
  g("item-isr18g").checked = false;
  g("item-badge-r18g-image").value = "";

  g("item-desc").value = "";
  g("item-layout").value = "below";
  g("item-pages").value = "";
  g("item-tracks").value = "";

  g("item-custom-tags").value = "";

  el.btnAdd.hidden = false;
  el.btnUpdate.hidden = true;
  el.btnCancelEdit.hidden = true;
  el.btnDelete.hidden = true;
  state.editing = null;
}

// 枠線/価格/タグ 見た目
on("item-border-on","change", e=>{
  state.itemBorder.on = e.target.checked;
  if(!state.itemBorder.on){ g("item-border-width").value = 0; state.itemBorder.width = 0; }
  applyItemBorder();
});
on("item-border-width","input", e=>{
  const valn = Math.max(0, +e.target.value || 0);
  state.itemBorder.width = valn;
  state.itemBorder.on = valn > 0;
  g("item-border-on").checked = state.itemBorder.on;
  applyItemBorder();
});
on("price-style","change", e=>{
  state.appearance.priceStyle = e.target.value; applyAppearance(); renderSections();
});
on("tag-style","change", e=>{
  state.appearance.tagStyle = e.target.value; applyAppearance(); renderSections();
});

// QR / 注記
on("btn-make-qr","click", ()=>{
  const url = v("qr-url"); if(!url){ alert("URLを入力してください"); return; }
  state.qrUrl = url;
  const qr = g("qr");
  qr.innerHTML = "";
  if (typeof QRCode === "function") {
    new QRCode(qr, { text: url, width: qr.clientWidth, height: qr.clientHeight, correctLevel: QRCode.CorrectLevel.M });
  } else {
    console.warn("QRCode library not found. Skipping QR generation.");
    qr.textContent = "QR NG";
  }
});
on("note","input", e=>{
  state.note = e.target.value;
  g("note-view").textContent = state.note;
  recomputeAutoScale();
});

// 印刷/PNG
on("btn-print","click", ()=> window.print());
on("btn-export-png","click", async ()=>{
  const node = g("paper");
  const showSafe = node.classList.contains("show-safe");
  const showGrid = node.classList.contains("show-grid");
  node.classList.remove("show-safe","show-grid");
  node.classList.add("exporting");

  // CSS背景をそのまま使う（backgroundColor:null）。影はCSSで無効化済み。
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: null,
    useCORS: true
  });
  await new Promise(res=>canvas.toBlob(blob=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "oshinagaki.png";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    res();
  }, "image/png"));

  node.classList.remove("exporting");
  if(showSafe) node.classList.add("show-safe");
  if(showGrid) node.classList.add("show-grid");
});

/* ========= 初期化 ========= */
function init() {
  applyGridVars(); applyItemBorder(); applyAppearance(); applyBandTune(); applyBackground();
  rerenderAll();

  const ro = new ResizeObserver(()=> recomputeAutoScale());
  ro.observe(el.content); ro.observe(el.contentInner);

  // ← ここ重要：編集系ボタンのイベントを確実に登録
  on("btn-update-item", "click", applyEditToItem);
  on("btn-cancel-edit", "click", cancelEdit);
  on("btn-delete-item", "click", ()=>{
    if(state.editing && confirm("このアイテムを削除しますか？")) deleteEditingItem();
  });

  el.paper.classList.add("show-safe");
}
init();

/* ========= DOM ヘルパ ========= */
function on(idOrNode, ev, fn){
  const node = typeof idOrNode==="string" ? g(idOrNode) : idOrNode;
  node.addEventListener(ev, fn);
}
