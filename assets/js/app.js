/* Kriminalita v Česku — interaktivní přehled (Apache ECharts)
   Data: Policie ČR (parsováno do data/crime-data.json). */
(function () {
  "use strict";

  // ---- Population (ČSÚ, tis. obyvatel; orientační) ----
  const NAT_POP = {2008:10430,2009:10491,2010:10533,2011:10505,2012:10516,2013:10512,
    2014:10538,2015:10554,2016:10579,2017:10610,2018:10650,2019:10694,2020:10702,
    2021:10516,2022:10828,2023:10828,2024:10883,2025:10900};
  const KRAJ_POP = {PHA:1384,STC:1465,JHC:657,PLK:614,KVK:279,ULK:791,LBK:448,HKK:559,
    PAK:531,VYS:513,JHM:1244,OLK:626,MSK:1160,ZLK:572};

  // curated composite metrics (sums of TSK codes)
  const GROUPS = {
    vrazdy:   {label:"Vraždy (celkem)", codes:[101,102,103,104,105,106]},
    loupeze:  {label:"Loupeže (celkem)", codes:[131,132]},
  };

  const PALETTE = ["#0091ff","#12a594","#e5484d","#f5a623","#8e4ec6","#d6409f","#0ea5e9","#64748b"];

  let D, YEARS, NAME2CODE = {}, CODE2NAME = {}, CAT_LABEL = {}, CAT_COLOR = {};
  const charts = {};

  // ---------- helpers ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const fmt = (n) => (n == null ? "–" : Math.round(n).toLocaleString("cs-CZ"));
  const fmt1 = (n) => (n == null ? "–" : n.toLocaleString("cs-CZ",{maximumFractionDigits:1}));

  function pctChange(a, b) {
    if (a == null || b == null || a === 0) return null;
    return ((b - a) / a) * 100;
  }

  function node(scope) { return scope === "CZ" ? D.national : D.regional[scope]; }

  // returns {reg:[..], sol:[..]} aligned to YEARS for a selection key & scope
  function getSeries(selKey, scope) {
    const nd = node(scope);
    const out = {reg: [], sol: []};
    const readMap = (m) => YEARS.map((y) => {
      const v = m && m[String(y)];
      return v ? v : null;
    });
    let src = null;
    if (selKey === "total") src = nd.total;
    else if (selKey.startsWith("cat:")) src = nd.byCategory[selKey.slice(4)];
    else if (selKey.startsWith("tsk:")) src = nd.byTsk[selKey.slice(4)];
    else if (selKey.startsWith("grp:")) {
      const codes = GROUPS[selKey.slice(4)].codes;
      return {
        reg: YEARS.map((y) => sumCodes(nd, codes, y, "reg")),
        sol: YEARS.map((y) => sumCodes(nd, codes, y, "sol")),
      };
    }
    const cells = readMap(src);
    out.reg = cells.map((c) => (c ? c.reg : null));
    out.sol = cells.map((c) => (c ? (c.sol == null ? null : c.sol) : null));
    return out;
  }

  function sumCodes(nd, codes, y, field) {
    let s = 0, ok = false;
    for (const c of codes) {
      const v = nd.byTsk[String(c)] && nd.byTsk[String(c)][String(y)];
      if (v && v[field] != null) { s += v[field]; ok = true; }
    }
    return ok ? s : null;
  }

  function perCapitaNat(regArr) {
    return regArr.map((v, i) => (v == null ? null : v / NAT_POP[YEARS[i]] * 100));
  }

  function selLabel(selKey) {
    if (selKey === "total") return "Celková kriminalita";
    if (selKey.startsWith("cat:")) return CAT_LABEL[selKey.slice(4)];
    if (selKey.startsWith("grp:")) return GROUPS[selKey.slice(4)].label;
    if (selKey.startsWith("tsk:")) return CODE2NAME[selKey.slice(4)] || selKey;
    return selKey;
  }

  // vertical markers for breaks that limit year-to-year comparability
  const BREAKS = [
    {year:2010, label:"nový TZ '10", pos:"insideEndTop"},
    {year:2013, label:"amnestie '13", pos:"insideEndBottom"},
    {year:2016, label:"metodika '16", pos:"insideEndTop"},
  ];
  function eraMark() {
    return {
      silent: true,
      symbol: "none",
      lineStyle: {color:"#cbd5e1", type:"dashed", width:1},
      label: {color:"#94a3b8", fontSize:9.5},
      data: BREAKS.map((b) => ({
        xAxis: String(b.year),
        label: {formatter: b.label, position: b.pos},
      })),
    };
  }

  const baseGrid = {left: 8, right: 14, top: 24, bottom: 6, containLabel: true};
  const axisLabelStyle = {color:"#64748b", fontSize:11};
  const splitLine = {lineStyle:{color:"#eef1f6"}};

  // ---------- KPI cards ----------
  function buildKpis() {
    const t = getSeries("total","CZ").reg;
    const first = t[0], last = t[t.length-1];
    const vr = getSeries("grp:vrazdy","CZ").reg;
    const lp = getSeries("grp:loupeze","CZ").reg;
    const totChg = pctChange(first, last);
    const clr = getSeries("total","CZ");
    const clrLast = clr.sol[clr.sol.length-1] / clr.reg[clr.reg.length-1] * 100;

    const cards = [
      {num: fmt(last), lbl: `evidovaných trestných činů (${YEARS[YEARS.length-1]})`, chg: totChg, invert:false},
      {num: (totChg>0?"+":"") + fmt1(totChg) + " %", lbl: `oproti roku ${YEARS[0]}`, raw:true, chg: totChg},
      {num: fmt(vr[vr.length-1]), lbl: `vražd za rok (${YEARS[YEARS.length-1]})`, chg: pctChange(vr[0], vr[vr.length-1])},
      {num: fmt1(clrLast)+" %", lbl: "objasněnost případů", noChg:true},
    ];
    $("#heroKpis").innerHTML = cards.map((c) => {
      let chgHtml = "";
      if (!c.noChg && c.chg != null) {
        const dir = c.chg < 0 ? "down" : "up";
        const arrow = c.chg < 0 ? "▼" : "▲";
        chgHtml = `<div class="chg ${dir}">${arrow} ${(c.chg>0?"+":"")}${fmt1(c.chg)} %</div>`;
      }
      return `<div class="kpi"><div class="num">${c.num}</div>
        <div class="lbl">${c.lbl}</div>${c.raw?"":chgHtml}</div>`;
    }).join("");
  }

  // ---------- Hlavní trend ----------
  let trendMetric = "abs";
  function renderTrend() {
    const s = getSeries("total","CZ");
    const abs = s.reg;
    const data = trendMetric === "abs" ? abs : perCapitaNat(abs);
    const unit = trendMetric === "abs" ? "případů" : "na 100 tis. obyv.";
    charts.trend.setOption({
      grid: baseGrid,
      tooltip: {trigger:"axis", valueFormatter:(v)=>fmt1(v)+" "+unit},
      xAxis: {type:"category", data:YEARS.map(String), axisLabel:axisLabelStyle,
        axisLine:{lineStyle:{color:"#e6e9ef"}}, axisTick:{show:false}},
      yAxis: {type:"value", axisLabel:{...axisLabelStyle, formatter:(v)=>fmt(v)},
        splitLine, axisLine:{show:false}},
      series: [{
        name:"Celková kriminalita", type:"line", smooth:true, symbol:"circle", symbolSize:6,
        data, lineStyle:{width:3, color:PALETTE[0]}, itemStyle:{color:PALETTE[0]},
        areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[
          {offset:0,color:"rgba(0,145,255,.22)"},{offset:1,color:"rgba(0,145,255,0)"}])},
        markLine: eraMark(),
      }],
    }, true);
  }

  // ---------- Explorer (line, driven by shared select) ----------
  function renderExplorer(selKey) {
    const s = getSeries(selKey,"CZ");
    const label = selLabel(selKey);
    const chg = pctChange(s.reg.find(v=>v!=null), [...s.reg].reverse().find(v=>v!=null));
    const showSolved = s.sol.some(v=>v!=null);
    const series = [{
      name:"Evidováno", type:"line", smooth:true, symbol:"circle", symbolSize:6,
      data:s.reg, lineStyle:{width:3, color:PALETTE[0]}, itemStyle:{color:PALETTE[0]},
      areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[
        {offset:0,color:"rgba(0,145,255,.20)"},{offset:1,color:"rgba(0,145,255,0)"}])},
      markLine: eraMark(),
    }];
    if (showSolved) series.push({
      name:"Objasněno", type:"line", smooth:true, symbol:"none",
      data:s.sol, lineStyle:{width:2, color:PALETTE[1], type:"dashed"}, itemStyle:{color:PALETTE[1]},
    });
    charts.explorer.setOption({
      grid: baseGrid,
      legend: showSolved ? {top:0, right:0, icon:"roundRect", textStyle:{fontSize:11,color:"#64748b"}} : {show:false},
      tooltip:{trigger:"axis", valueFormatter:(v)=>fmt(v)},
      xAxis:{type:"category", data:YEARS.map(String), axisLabel:axisLabelStyle,
        axisLine:{lineStyle:{color:"#e6e9ef"}}, axisTick:{show:false}},
      yAxis:{type:"value", axisLabel:{...axisLabelStyle, formatter:(v)=>fmt(v)}, splitLine, axisLine:{show:false}},
      series,
    }, true);

    // badge
    const badge = $("#explorerBadge");
    if (chg != null) {
      const dir = chg < 0 ? "down":"up";
      badge.innerHTML = `<span class="badge-chg ${dir}">${chg<0?"▼":"▲"} ${(chg>0?"+":"")}${fmt1(chg)} %</span>
        <span class="badge-txt">${label}: ${YEARS[0]} → ${YEARS[YEARS.length-1]}</span>`;
    } else badge.innerHTML = "";

    $("#explorerSource").innerHTML =
      `Zdroj: <a href="https://policie.gov.cz/statistiky-kriminalita.aspx" target="_blank" rel="noopener">Policie ČR</a>` +
      ` · vybráno: <strong>${label}</strong>. „Evidováno“ = policií zjištěné trestné činy.`;
  }

  // ---------- Map ----------
  let mapMetric = "abs", mapYearIdx = 0, mapSel = "total";
  function mapValues(selKey, yIdx, metric) {
    const y = YEARS[yIdx];
    return D.regionsMeta.map((rm) => {
      const s = getSeries(selKey, rm.code);
      let v = s.reg[yIdx];
      if (v != null && metric === "per") v = v / KRAJ_POP[rm.code] * 100;
      return {name: rm.name, value: v == null ? null : Math.round(v*10)/10, code: rm.code};
    });
  }
  function renderMap() {
    const vals = mapValues(mapSel, mapYearIdx, mapMetric);
    const nums = vals.map(v=>v.value).filter(v=>v!=null);
    const max = Math.max(...nums), min = Math.min(...nums);
    const unit = mapMetric === "abs" ? "případů" : "na 100 tis. obyv.";
    $("#mapYearLabel").textContent = YEARS[mapYearIdx];
    charts.map.setOption({
      tooltip:{trigger:"item", formatter:(p)=>{
        if (p.value==null||isNaN(p.value)) return `${p.name}: bez dat`;
        return `<strong>${p.name}</strong><br/>${selLabel(mapSel)}<br/>${fmt1(p.value)} ${unit} (${YEARS[mapYearIdx]})`;
      }},
      visualMap:{
        type:"continuous", min:min, max:max, left:"left", bottom:6, calculable:true,
        itemWidth:12, itemHeight:120, precision:0,
        text:["více","méně"], textStyle:{color:"#64748b", fontSize:11},
        inRange:{color:["#e6f4ff","#7cc0ff","#0091ff","#0069c0","#08306b"]},
      },
      series:[{
        type:"map", map:"cz", roam:false, data:vals,
        label:{show:false},
        emphasis:{label:{show:true, color:"#0f172a", fontWeight:600},
          itemStyle:{areaColor:"#f5a623"}},
        select:{itemStyle:{areaColor:"#f5a623"}, label:{show:true}},
        itemStyle:{borderColor:"#ffffff", borderWidth:1},
      }],
    }, true);
  }
  function renderRegion(code) {
    const rm = D.regionsMeta.find(r=>r.code===code) || D.regionsMeta[0];
    const s = getSeries(mapSel, rm.code);
    charts.region.setOption({
      title:{text:`${rm.name} — ${selLabel(mapSel)}`, left:"center", top:2,
        textStyle:{fontSize:12.5, color:"#475569", fontWeight:600}},
      grid:{left:8,right:14,top:34,bottom:4,containLabel:true},
      tooltip:{trigger:"axis", valueFormatter:(v)=>fmt(v)},
      xAxis:{type:"category", data:YEARS.map(String), axisLabel:{...axisLabelStyle,fontSize:10},
        axisTick:{show:false}, axisLine:{lineStyle:{color:"#e6e9ef"}}},
      yAxis:{type:"value", axisLabel:{...axisLabelStyle, formatter:(v)=>fmt(v)}, splitLine, axisLine:{show:false}},
      series:[{type:"bar", data:s.reg, itemStyle:{color:PALETTE[0], borderRadius:[3,3,0,0]},
        markLine: eraMark()}],
    }, true);
  }

  // ---------- Kategorie v čase (stacked area) ----------
  function renderStack() {
    const cats = D.categoriesMeta.filter(c=>c.key!=="obecna");
    const series = cats.map((c,i)=>{
      const s = getSeries("cat:"+c.key,"CZ").reg;
      return {name:c.label, type:"line", stack:"all", smooth:false, symbol:"none",
        areaStyle:{opacity:.82}, lineStyle:{width:0}, emphasis:{focus:"series"},
        itemStyle:{color:c.color}, data:s};
    });
    charts.stack.setOption({
      grid:{left:8,right:12,top:8,bottom:44,containLabel:true},
      color: cats.map(c=>c.color),
      tooltip:{trigger:"axis", valueFormatter:(v)=>fmt(v)},
      legend:{bottom:0, type:"scroll", textStyle:{fontSize:10.5,color:"#64748b"}, itemWidth:12, itemHeight:8},
      xAxis:{type:"category", data:YEARS.map(String), boundaryGap:false,
        axisLabel:{...axisLabelStyle,fontSize:10}, axisTick:{show:false}, axisLine:{lineStyle:{color:"#e6e9ef"}}},
      yAxis:{type:"value", axisLabel:{...axisLabelStyle, formatter:(v)=>fmt(v)}, splitLine, axisLine:{show:false}},
      series,
    }, true);
  }

  // ---------- Změna 2008→2025 (diverging bar) ----------
  function renderChange() {
    const items = D.categoriesMeta.filter(c=>c.key!=="obecna").map((c)=>{
      const s = getSeries("cat:"+c.key,"CZ").reg;
      const a = s.find(v=>v!=null), b = [...s].reverse().find(v=>v!=null);
      return {name:c.label, chg: pctChange(a,b)};
    }).filter(x=>x.chg!=null).sort((a,b)=>a.chg-b.chg);
    charts.change.setOption({
      grid:{left:8,right:24,top:8,bottom:6,containLabel:true},
      tooltip:{trigger:"axis", axisPointer:{type:"shadow"}, valueFormatter:(v)=>fmt1(v)+" %"},
      xAxis:{type:"value", axisLabel:{...axisLabelStyle, formatter:(v)=>v+" %"}, splitLine},
      yAxis:{type:"category", data:items.map(i=>i.name), axisLabel:{...axisLabelStyle,fontSize:10.5},
        axisTick:{show:false}, axisLine:{show:false}},
      series:[{type:"bar", data:items.map(i=>({value:Math.round(i.chg*10)/10,
        itemStyle:{color: i.chg<0? "#12a594":"#e5484d", borderRadius:4}})),
        label:{show:true, position:"right", formatter:(p)=>(p.value>0?"+":"")+p.value+" %",
          fontSize:10.5, color:"#475569"}}],
    }, true);
  }

  // ---------- Nejčastější trestné činy (poslední rok) ----------
  function renderTop() {
    const yi = YEARS.length-1;
    const rows = D.tskMeta.filter(m=>m.cat).map((m)=>{
      const v = D.national.byTsk[String(m.code)] && D.national.byTsk[String(m.code)][String(YEARS[yi])];
      return {name:m.name.replace(/\s*\(§.*/,"").trim(), reg: v?v.reg:0, color: CAT_COLOR[m.cat]||"#64748b"};
    }).filter(r=>r.reg>0).sort((a,b)=>b.reg-a.reg).slice(0,12).reverse();
    charts.top.setOption({
      grid:{left:8,right:26,top:8,bottom:6,containLabel:true},
      tooltip:{trigger:"axis", axisPointer:{type:"shadow"}, valueFormatter:(v)=>fmt(v)},
      xAxis:{type:"value", axisLabel:{...axisLabelStyle, formatter:(v)=>fmt(v)}, splitLine},
      yAxis:{type:"category", data:rows.map(r=>r.name), axisLabel:{...axisLabelStyle,fontSize:10,
        width:140, overflow:"truncate"}, axisTick:{show:false}, axisLine:{show:false}},
      series:[{type:"bar", data:rows.map(r=>({value:r.reg, itemStyle:{color:r.color, borderRadius:4}})),
        label:{show:true, position:"right", formatter:(p)=>fmt(p.value), fontSize:10, color:"#475569"}}],
    }, true);
  }

  // ---------- Objasněnost v čase ----------
  function renderClear() {
    const s = getSeries("total","CZ");
    const rate = s.reg.map((r,i)=> r && s.sol[i]!=null ? Math.round(s.sol[i]/r*1000)/10 : null);
    charts.clear.setOption({
      grid: baseGrid,
      tooltip:{trigger:"axis", valueFormatter:(v)=>fmt1(v)+" %"},
      xAxis:{type:"category", data:YEARS.map(String), axisLabel:{...axisLabelStyle,fontSize:10},
        axisTick:{show:false}, axisLine:{lineStyle:{color:"#e6e9ef"}}},
      yAxis:{type:"value", min:30, max:60, axisLabel:{...axisLabelStyle, formatter:(v)=>v+" %"}, splitLine, axisLine:{show:false}},
      series:[{type:"line", smooth:true, data:rate, symbol:"circle", symbolSize:5,
        lineStyle:{width:3, color:PALETTE[1]}, itemStyle:{color:PALETTE[1]},
        areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[
          {offset:0,color:"rgba(18,165,148,.20)"},{offset:1,color:"rgba(18,165,148,0)"}])},
        markLine: eraMark()}],
    }, true);
  }

  // ---------- Sources list ----------
  function buildSources() {
    const items = [
      {t:"Statistické přehledy kriminality (Policie ČR)", d:"Roční a měsíční tabulky evidované kriminality podle TSK i podle krajů — hlavní zdroj tohoto přehledu.",
       u:"https://policie.gov.cz/statistiky-kriminalita.aspx"},
      {t:"Mapa kriminality (Policie ČR)", d:"Oficiální interaktivní mapa s daty na úrovni obcí a oddělení.",
       u:"https://kriminalita.policie.gov.cz/"},
      {t:"Kriminalita (ČSÚ)", d:"Statistiky kriminality a soudnictví Českého statistického úřadu.",
       u:"https://csu.gov.cz/kriminalita"},
      {t:"Počet obyvatel (ČSÚ)", d:"Použito pro orientační přepočty na 100 000 obyvatel.",
       u:"https://csu.gov.cz/obyvatelstvo"},
    ];
    $("#sourcesList").innerHTML = items.map(i=>
      `<a class="src-item" href="${i.u}" target="_blank" rel="noopener">
        <h4>${i.t} ↗</h4><p>${i.d}</p></a>`).join("");
  }

  // ---------- Select population ----------
  function buildSelect() {
    const sel = $("#crimeSelect");
    const opt = (v,l)=>`<option value="${v}">${l}</option>`;
    let html = "";
    html += `<optgroup label="Souhrny">`;
    html += opt("total","Celková kriminalita");
    D.categoriesMeta.forEach(c=> html += opt("cat:"+c.key, c.label));
    html += `</optgroup>`;
    html += `<optgroup label="Vybrané trestné činy">`;
    html += opt("grp:vrazdy", GROUPS.vrazdy.label);
    html += opt("grp:loupeze", GROUPS.loupeze.label);
    html += `</optgroup>`;
    // all TSK codes grouped by category
    const byCat = {};
    D.tskMeta.filter(m=>m.cat).forEach(m=>{ (byCat[m.cat]=byCat[m.cat]||[]).push(m); });
    D.categoriesMeta.forEach(c=>{
      const arr = byCat[c.key]; if(!arr) return;
      html += `<optgroup label="${c.label} — jednotlivé činy">`;
      arr.sort((a,b)=>a.code-b.code).forEach(m=>{
        const nm = m.name.replace(/\s+/g," ").trim();
        html += opt("tsk:"+m.code, `${nm}`);
      });
      html += `</optgroup>`;
    });
    sel.innerHTML = html;
    sel.value = "total";
  }

  // ---------- init ----------
  function initCharts() {
    ["trend","explorer","map","region","stack","change","top","clear"].forEach((k)=>{
      charts[k] = echarts.init($("#chart"+k.charAt(0).toUpperCase()+k.slice(1)), null, {renderer:"canvas"});
    });
  }

  function wire() {
    // trend metric
    $("#trendMetric").addEventListener("click",(e)=>{
      const b = e.target.closest("button"); if(!b) return;
      trendMetric = b.dataset.v;
      [...e.currentTarget.children].forEach(x=>x.classList.toggle("on",x===b));
      renderTrend();
    });
    // crime select drives explorer + map + region
    $("#crimeSelect").addEventListener("change",(e)=>{
      const v = e.target.value; mapSel = v;
      renderExplorer(v); renderMap(); renderRegion(selectedRegion);
    });
    // map metric
    $("#mapMetric").addEventListener("click",(e)=>{
      const b = e.target.closest("button"); if(!b) return;
      mapMetric = b.dataset.v;
      [...e.currentTarget.children].forEach(x=>x.classList.toggle("on",x===b));
      renderMap();
    });
    // map year
    const yr = $("#mapYear");
    yr.max = String(YEARS.length-1); yr.value = String(YEARS.length-1);
    mapYearIdx = YEARS.length-1;
    yr.addEventListener("input",(e)=>{ mapYearIdx = +e.target.value; renderMap(); });
    // map click -> region detail
    charts.map.on("click",(p)=>{
      const code = NAME2CODE[p.name]; if(!code) return;
      selectedRegion = code; renderRegion(code);
    });
    window.addEventListener("resize",()=>{ Object.values(charts).forEach(c=>c && c.resize()); });
  }

  let selectedRegion = "PHA";

  Promise.all([
    fetch("data/crime-data.json").then(r=>r.json()),
    fetch("assets/geo/kraje.json").then(r=>r.json()),
  ]).then(([data, geo])=>{
    D = data; YEARS = D.years;
    mapYearIdx = YEARS.length - 1;
    D.regionsMeta.forEach(r=>{ NAME2CODE[r.name]=r.code; CODE2NAME[r.code]=r.name; });
    D.tskMeta.forEach(m=>{ CODE2NAME[String(m.code)] = m.name; });
    D.categoriesMeta.forEach(c=>{ CAT_LABEL[c.key]=c.label; CAT_COLOR[c.key]=c.color; });
    echarts.registerMap("cz", geo);

    initCharts();
    buildKpis();
    buildSelect();
    buildSources();
    renderTrend();
    renderExplorer("total");
    renderMap();
    renderRegion(selectedRegion);
    renderStack();
    renderChange();
    renderTop();
    renderClear();
    wire();
  }).catch((err)=>{
    console.error(err);
    document.body.insertAdjacentHTML("afterbegin",
      `<div style="padding:16px;background:#fee;color:#900;font:14px sans-serif">
       Nepodařilo se načíst data (${err}). Spusťte přes lokální server: <code>python3 -m http.server</code>.</div>`);
  });
})();
