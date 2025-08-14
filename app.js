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
  // size: "large" | "small" | "two"（←2段組み）
  // cols: 固定列数（0=自動）。two のときは無視して常に2列。
  sections: { music: { name: "新譜", size: "large", cols: 0, items: [] } },
  order: ["music"],

  note: "その他頒布物の詳細はコチラ→",
  qrUrl: "",

  // ★ 追加: QR 見た目設定
  qrStyle: {
    sizeMm: 32,
    padMm: 2,
    borderOn: false,
    borderWidthMm: 0.4,
    borderColor: "#222222",
    radiusMm: 1.5
  },

  typography: { family: "Noto Sans JP", basePt: 11 },

  layout: { userScale: 100, autoScale: 100 },   // %（総合 = auto × user）
  itemBorder: { on: true, width: 0.3 },         // mm
  appearance: { priceStyle: "box", tagStyle: "outline" },

  // largeMin / smallMin は min 幅の基準（小は大より大きくならない制御はCSS側で維持）
  grid: { sectionGap: 8, itemsGap: 4, largeMin: 70, smallMin: 42, align: "start" },

  background: { mode: "color", color: "#ffffff", imageSrc: "", fit: "cover" },

  editing: null // {secId, itemId}
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
  "M PLUS 1p": "https://fonts.googleapis.com/css2?family=M+PLUS+1p&wght@400;700;900&display=swap",
  "Kosugi Maru": "https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap",
  "Shippori Mincho": "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700;800&display=swap"
};
const uid = () => Math.random().toString(36).slice(2, 9);
const cssVar = (k,v,target=document.documentElement)=>target.style.setProperty(k,v);

function g(id){ return document.getElementById(id); }
function qs(sel){ return document.querySelector(sel); }
function ce(tag, cls){ const n=document.createElement(tag); if(cls) n.className=cls; return n; }
function v(id){ return g(id).value.trim(); }

/* 単位変換（中央寄せ対応の列幅算出で使用） */
let __mmPx = null;
function mmToPx(mm){
  if(__mmPx == null){
    const d = document.createElement("div");
    d.style.position = "absolute";
    d.style.width = "1mm";
    d.style.height = 0;
    document.body.appendChild(d);
    __mmPx = d.getBoundingClientRect().width;
    d.remove();
  }
  return mm * __mmPx;
}
function cssLengthToPx(lenStr){
  const s = String(lenStr || "").trim();
  if(!s) return 0;
  if(s.endsWith("mm")) return mmToPx(parseFloat(s));
  if(s.endsWith("px")) return parseFloat(s);
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

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
  cssVar("--grid-justify", state.grid.align);
  recomputeAutoScale();
  applyAutoColWidth();
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
    cssVar("--paper-bg-color", "#ffffff", p);
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

/* ========= QR スタイル適用 & 生成 ========= */
// キャンバス側(#paper 内の #qr)に見た目を反映（CSS未改修でも動くよう inline でも設定）
function applyQrStyle(){
  const t = el.paper;
  const q = state.qrStyle;
  // CSSカスタムプロパティ（CSSで参照する場合）
  cssVar("--qr-size",   `${Math.max(10, q.sizeMm)}mm`, t);
  cssVar("--qr-pad",    `${Math.max(0, q.padMm)}mm`, t);
  cssVar("--qr-border-w", `${(q.borderOn ? Math.max(0, q.borderWidthMm) : 0)}mm`, t);
  cssVar("--qr-border-color", q.borderColor || "#000000", t);
  cssVar("--qr-radius", `${Math.max(0, q.radiusMm)}mm`, t);

  // inline style（CSS未導入でも効く）
  const qr = g("qr");
  if(qr){
    qr.style.width = `${Math.max(10, q.sizeMm)}mm`;
    qr.style.height = `${Math.max(10, q.sizeMm)}mm`;
    qr.style.padding = `${Math.max(0, q.padMm)}mm`;
    qr.style.boxSizing = "border-box";
    qr.style.background = "#ffffff";
    qr.style.border = q.borderOn ? `${Math.max(0, q.borderWidthMm)}mm solid ${q.borderColor || "#000"}` : "none";
    qr.style.borderRadius = `${Math.max(0, q.radiusMm)}mm`;
    qr.style.display = "grid";
    qr.style.placeItems = "center";
    qr.style.overflow = "hidden";
  }
}
// パディングを除いた内側の正味サイズ(px)を算出
function qrInnerPx(){
  const qr = g("qr"); if(!qr) return 64;
  const cs = getComputedStyle(qr);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop)  + parseFloat(cs.paddingBottom);
  const w = Math.max(40, Math.floor(qr.clientWidth  - padX));
  const h = Math.max(40, Math.floor(qr.clientHeight - padY));
  return Math.floor(Math.min(w, h));
}
// URLが設定されていれば現在のスタイルで再生成
function remakeQRIfNeeded(){
  if(!state.qrUrl) return;
  const qr = g("qr"); if(!qr) return;
  qr.innerHTML = "";
  if (typeof QRCode === "function") {
    const sz = qrInnerPx();
    new QRCode(qr, {
      text: state.qrUrl,
      width: sz,
      height: sz,
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    console.warn("QRCode library not found.");
    qr.textContent = "QR NG";
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

function sizeLabel(sz){
  return sz === "large" ? "大" : sz === "small" ? "小" : "2段";
}
function nextSize(sz){
  return sz === "large" ? "small" : sz === "small" ? "two" : "large";
}

function renderSectionList(){
  el.sectionList.innerHTML = "";
  state.order.forEach(id=>{
    const s = state.sections[id];
    // 後方互換: 既存セクションに cols が無ければ 0 を入れておく
    if(typeof s.cols !== "number") s.cols = 0;

    const li = document.createElement("li");

    // セクション名（編集可能）
    const name = document.createElement("div");
    name.className = "name";
    name.contentEditable = "true";
    name.textContent = s.name;
    name.addEventListener("input", ()=>{
      s.name = name.textContent;
      renderSections(); refreshSectionSelect();
    });

    // モード（大/小/2段）サイクル
    const modeBtn = document.createElement("button");
    modeBtn.textContent = sizeLabel(s.size || "small");
    modeBtn.style.minWidth = "3.2em";
    modeBtn.addEventListener("click", ()=>{
      s.size = nextSize(s.size || "small");
      modeBtn.textContent = sizeLabel(s.size);
      // 2段のときは列数入力は無効化（ビジュアル上は動作するが意味が無い）
      colsInput.disabled = (s.size === "two");
      renderSections();
      applyAutoColWidth();
    });

    // 列数（0=自動）
    const colsInput = document.createElement("input");
    colsInput.type = "number";
    colsInput.className = "cols-input";
    colsInput.min = 0;
    colsInput.value = s.cols || 0;
    colsInput.title = "列数（0=自動）";
    colsInput.style.width = "4.2em";
    colsInput.style.marginLeft = "6px";
    colsInput.disabled = (s.size === "two");
    colsInput.addEventListener("input", ()=>{
      const n = Math.max(0, parseInt(colsInput.value || "0", 10));
      s.cols = n;
      renderSections();
      applyAutoColWidth();
    });

    // 削除
    const del = document.createElement("button");
    del.className = "btn-del"; del.textContent = "🗑";
    del.addEventListener("click", ()=>{
      if(!confirm(`「${s.name}」を削除しますか？（アイテムも消えます）`)) return;
      delete state.sections[id];
      state.order = state.order.filter(x=>x!==id);
      renderSectionList(); renderSections(); refreshSectionSelect();
    });

    li.appendChild(name);
    li.appendChild(modeBtn);
    li.appendChild(colsInput);
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
  state.order.forEach(secId=>{
    const sec = state.sections[secId];
    if(typeof sec.cols !== "number") sec.cols = 0;

    const wrap = ce("section", "section");
    wrap.dataset.size = sec.size || "small"; // "large" | "small" | "two"
    wrap.dataset.cols = sec.cols || 0;

    const h2 = ce("h2"); h2.contentEditable = "true"; h2.textContent = sec.name;
    h2.addEventListener("input", ()=>{
      sec.name = h2.textContent;
      renderSectionList();
    });

    const ul = ce("ul", "items"); ul.id = `items-${secId}`;
    wrap.appendChild(h2); wrap.appendChild(ul); el.sectionsRoot.appendChild(wrap);

    ul.innerHTML = "";
    sec.items.forEach((it)=>{
      if(!it.id) it.id = uid();

      const li = ce("li", "item");
      li.dataset.itemId = it.id;
      if(it.layout === "right") li.classList.add("layout-right");

      li.addEventListener("click", (e)=>{
        e.stopPropagation();
        startEditItemById(secId, li.dataset.itemId);
      });

      const img = ce("img", "thumb"); img.src = it.src; img.alt = it.title || "";
      li.appendChild(img);

      // NEW / R18 / R18G バッジ
      if(it.badgeSrc){
        const bi = ce("img", "badge-img"); bi.src = it.badgeSrc; li.appendChild(bi);
      } else if(it.isNew){
        const b = ce("div", "badge"); b.textContent = "NEW"; li.appendChild(b);
      }
      let rightTopMm = 2;
      const pushRight = (node)=>{ node.style.top = `${rightTopMm}mm`; node.style.right = `2mm`; rightTopMm += 14; };
      if(it.badgeR18Src){ const bi = ce("img","badge-img-r18"); bi.src = it.badgeR18Src; pushRight(bi); li.appendChild(bi); }
      else if(it.isR18){ const b = ce("div","badge-r18"); b.textContent="R18"; pushRight(b); li.appendChild(b); }
      if(it.badgeR18GSrc){ const bi = ce("img","badge-img-r18g"); bi.src = it.badgeR18GSrc; pushRight(bi); li.appendChild(bi); }
      else if(it.isR18G){ const b = ce("div","badge-r18g"); b.textContent="R18G"; pushRight(b); li.appendChild(b); }

      const textBox = ce("div");
      if(it.layout === "right") li.appendChild(textBox);

      const caption = ce("div", "caption"); caption.textContent = it.title || "";
      const desc    = ce("div", "desc");    if(it.desc) desc.textContent = it.desc;

      const meta = ce("div", "meta");
      if(it.pages){  meta.appendChild(tagEl(`${it.pages}ページ`)); }
      if(it.tracks){ meta.appendChild(tagEl(`${it.tracks}曲`)); }
      if(Array.isArray(it.customTags)){ it.customTags.filter(Boolean).forEach(t=> meta.appendChild(tagEl(t))); }

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

    // 並べ替え：DOMの順序から items を並び替える（ID基準）
    new Sortable(ul, {
      animation: 120,
      onEnd: ()=>{
        const ids = Array.from(ul.children).map(ch => ch.dataset.itemId);
        sec.items.sort((a,b)=> ids.indexOf(a.id) - ids.indexOf(b.id));
        applyAutoColWidth();
        recomputeAutoScale();
      }
    });
  });

  recomputeAutoScale();
  applyAutoColWidth();
}

/* 列幅の自動計算（セクションごと）
   - size==="two" なら 2段固定（親幅を2分割）
   - cols>0 なら 固定列。列幅 = min(等分幅, 最小幅) → 余白が残れば中央/右寄せが効く
   - cols=0 なら CSSのauto-fill/minmaxに任せる（--colwは未設定） */
function applyAutoColWidth(){
  state.order.forEach(secId=>{
    const sec = state.sections[secId];
    const ul = document.getElementById(`items-${secId}`);
    if(!ul) return;

    const size = sec.size || "small";
    const cols = (size === "two") ? 2 : (sec.cols|0);

    // 2段組み
    if(size === "two"){
      ul.style.removeProperty("--colw");
      ul.style.gridTemplateColumns = `repeat(2, minmax(0, 1fr))`;
      return;
    }

    // 自動列
    if(!cols){
      ul.style.removeProperty("--colw");
      ul.style.removeProperty("grid-template-columns");
      return;
    }

    // 固定列：等分幅と最小幅の小さい方を採用
    const st  = getComputedStyle(ul);
    const gap = parseFloat(st.gap) || 0;     // px
    const w   = ul.clientWidth;              // px
    const exact = Math.max(1, (w - gap * (cols - 1)) / cols);

    const minVar = size === "large" ? "--card-large-min" : "--card-small-min";
    const minLen = getComputedStyle(document.documentElement).getPropertyValue(minVar);
    const minPx  = cssLengthToPx(minLen);

    const col = Math.max(60, Math.min(exact, minPx)); // 下限60pxは保険
    ul.style.setProperty("--colw", `${col}px`);
    ul.style.gridTemplateColumns = `repeat(${cols}, minmax(var(--colw), var(--colw)))`;
  });
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
  // キャンバス(.paper)にだけ適用（UIは固定）
  cssVar("--font", `"${fam}", system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN","Yu Gothic", sans-serif`, el.paper);
  cssVar("--base-pt", `${state.typography.basePt}pt`, el.paper);
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

// セクション管理（追加）
on("btn-add-section","click", ()=>{
  const name = g("new-section-name").value.trim();
  if(!name) return;
  const idd = uid();
  // デフォルトは：新譜/新刊/新作 → large、それ以外 small
  const defSize = /新譜|新刊|新作/.test(name) ? "large" : "small";
  state.sections[idd] = { name, size: defSize, cols: 0, items: [] };
  state.order.push(idd);
  g("new-section-name").value = "";
  renderSectionList(); renderSections(); refreshSectionSelect();
});

// 余白やサイズ類（全体の最小幅はCSS変数に）
on("section-gap","input", e=>{ state.grid.sectionGap = +e.target.value; applyGridVars(); });
on("items-gap","input", e=>{ state.grid.itemsGap = +e.target.value; applyGridVars(); applyAutoColWidth(); });
on("card-large-min","input", e=>{ state.grid.largeMin = +e.target.value; applyGridVars(); });
on("card-small-min","input", e=>{ state.grid.smallMin = +e.target.value; applyGridVars(); });

// 横揃え（全体）
on("grid-align","change", e=>{
  state.grid.align = e.target.value; // start | center | end
  applyGridVars(); renderSections();
});

// アイテム画像ソースUI
on("item-image-source","change", e=>{
  const mode = e.target.value;
  g("item-image-file-wrap").style.display = (mode === "file") ? "" : "none";
  g("item-image-url-wrap").style.display  = (mode === "url")  ? "" : "none";
});

// アイテム追加（※ 一意IDを付与）
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
    id: uid(),
    title, price, src, isNew, badgeSrc,
    isR18, badgeR18Src,
    isR18G, badgeR18GSrc,
    desc, layout, pages, tracks,
    customTags
  });

  clearItemForm();
  renderSections();
});

/* ========= アイテム編集（ID基準） ========= */
function startEditItemById(secId, itemId){
  const arr = state.sections[secId].items;
  const index = arr.findIndex(x=>x.id === itemId);
  if(index < 0) return;
  const it = arr[index];

  state.editing = {secId, itemId};
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
  const {secId, itemId} = state.editing;
  const arr = state.sections[secId].items;
  const index = arr.findIndex(x=>x.id === itemId);
  if(index < 0) return;

  const it = arr[index];
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
  const {secId, itemId} = state.editing;
  const arr = state.sections[secId].items;
  const index = arr.findIndex(x=>x.id === itemId);
  if(index < 0) return;
  arr.splice(index,1);
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

/* ========= 枠線/価格/タグ ========= */
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

/* ========= QR / 注記 ========= */
// 生成ボタン：URLを反映し、現在の見た目で生成
on("btn-make-qr","click", ()=>{
  const url = v("qr-url"); if(!url){ alert("URLを入力してください"); return; }
  state.qrUrl = url;
  applyQrStyle();
  remakeQRIfNeeded();
});
on("note","input", e=>{
  state.note = e.target.value;
  g("note-view").textContent = state.note;
  recomputeAutoScale();
});

/* ========= 印刷/PNG ========= */
on("btn-print","click", ()=> window.print());
on("btn-export-png","click", async ()=>{
  const node = g("paper");
  const showSafe = node.classList.contains("show-safe");
  const showGrid = node.classList.contains("show-grid");
  node.classList.remove("show-safe","show-grid");
  node.classList.add("exporting");

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
  applyQrStyle(); // ★ 追加: 初期反映
  rerenderAll();

  const ro = new ResizeObserver(()=> { recomputeAutoScale(); applyAutoColWidth(); });
  ro.observe(el.content); ro.observe(el.contentInner);
  window.addEventListener("resize", applyAutoColWidth);

  on("btn-update-item", "click", applyEditToItem);
  on("btn-cancel-edit", "click", cancelEdit);
  on("btn-delete-item", "click", ()=>{
    if(state.editing && confirm("このアイテムを削除しますか？")) deleteEditingItem();
  });

  // ★ 追加: QR 関連のUIイベント（存在する場合のみ登録）
  const qs = g("qr-size"); if(qs) qs.addEventListener("input", e=>{
    state.qrStyle.sizeMm = +e.target.value || 32; applyQrStyle(); remakeQRIfNeeded(); recomputeAutoScale();
  });
  const qp = g("qr-padding"); if(qp) qp.addEventListener("input", e=>{
    state.qrStyle.padMm = +e.target.value || 0; applyQrStyle(); remakeQRIfNeeded(); recomputeAutoScale();
  });
  const qbo = g("qr-border-on"); if(qbo) qbo.addEventListener("change", e=>{
    state.qrStyle.borderOn = e.target.checked; applyQrStyle(); remakeQRIfNeeded();
  });
  const qbw = g("qr-border-width"); if(qbw) qbw.addEventListener("input", e=>{
    state.qrStyle.borderWidthMm = +e.target.value || 0; applyQrStyle(); remakeQRIfNeeded();
  });
  const qbc = g("qr-border-color"); if(qbc) qbc.addEventListener("input", e=>{
    state.qrStyle.borderColor = e.target.value || "#000000"; applyQrStyle(); remakeQRIfNeeded();
  });
  const qbr = g("qr-border-radius"); if(qbr) qbr.addEventListener("input", e=>{
    state.qrStyle.radiusMm = +e.target.value || 0; applyQrStyle(); remakeQRIfNeeded();
  });

  el.paper.classList.add("show-safe");
}
init();

/* ========= DOM ヘルパ ========= */
function on(idOrNode, ev, fn){
  const node = typeof idOrNode==="string" ? g(idOrNode) : idOrNode;
  node.addEventListener(ev, fn);
}
