/* ماشین‌حساب هوشمند هومکس — رابط ماشین‌حساب. محاسبه فقط در engine.js انجام می‌شود. */
(function () {
  'use strict';
  var E = window.HomexEngine, D = window.HOMEX_DATA;
  var FA = '۰۱۲۳۴۵۶۷۸۹';
  function fa(s) { return String(s).replace(/\d/g, function (d) { return FA[d]; }); }
  function faN(n) { return fa(String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '٬')); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  var lcd = $('lcd'), lower = $('lower'), plusSmall, plus = $('plus-holder');

  /* ---------- شهرها (مرتب‌شده به‌ترتیب الفبا) ---------- */
  var CITIES = D.cities.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'fa'); });

  /* ---------- سؤال‌ها ---------- */
  function opt(key, order) {
    var all = D.options[key];
    return order.map(function (v) { var o = all.filter(function (x) { return x.value === v; })[0]; return { v: v, l: o.label, s: o.sub }; });
  }
  var Q = {
    area:   { t: 'متراژ', type: 'num', q: 'متراژ اتاق چند متر مربع است؟', unit: 'متر مربع', min: 5, max: 500, len: 3, hint: 'مثلاً ۲۰' },
    len:    { t: 'طول', type: 'num', q: 'طول اتاق چند متر است؟', unit: 'متر', min: 1, max: 30, len: 2 },
    wid:    { t: 'عرض', type: 'num', q: 'عرض اتاق چند متر است؟', unit: 'متر', min: 1, max: 30, len: 2 },
    city:   { t: 'شهر', type: 'city', q: 'در کدام شهر یا استان هستید؟' },
    orientation: { t: 'پنجره', type: 'choice', q: 'پنجره‌ی اصلی رو به کدام سمت است؟', o: opt('orientation', ['south', 'west', 'east', 'north']) },
    windows:{ t: 'تعداد پنجره', type: 'num', q: 'چند پنجره‌ی آفتاب‌گیر دارد؟', unit: 'پنجره', min: 0, max: 10, len: 2, hint: 'اگر ندارد، ۰ بزنید' },
    people: { t: 'تعداد افراد', type: 'num', q: 'معمولاً چند نفر در این اتاق هستند؟', unit: 'نفر', min: 1, max: 20, len: 2 },
    floor:  { t: 'طبقه', type: 'choice', q: 'اتاق در کدام طبقه است؟', o: opt('floor', ['middle', 'top', 'ground']) },
    kitchen:{ t: 'آشپزخانه', type: 'choice', q: 'اتاق نزدیک آشپزخانه است؟', o: opt('kitchen', ['no', 'yes', 'above']) },
    insulation: { t: 'عایق', type: 'choice', q: 'وضعیت عایق‌بندی ساختمان چگونه است؟', o: opt('insulation', ['poor', 'medium', 'good']) }
  };
  var FIELD = { len: 'len', wid: 'wid' };          // len/wid فقط برای ساختن متراژ
  var HEAD = ['area', 'city', 'orientation', 'windows'];
  var CANDS = ['people', 'floor', 'kitchen', 'insulation'];

  /* ---------- وضعیت ---------- */
  var st, autoT;
  function defaults() {
    var d = D.defaults;
    return { city: d.city, height: d.height, orientation: d.orientation, windows: d.windows, people: d.people,
             floor: d.floor, kitchen: d.kitchen, insulation: d.insulation, area: null };
  }
  function reset() {
    st = { step: 'intro', flow: HEAD.slice(), i: 0, val: '', sel: null, a: defaults(), asked: {}, tape: [], all: false, skipped: [], lw: {}, autoCity: false };
    clearTimeout(autoT);
    document.body.classList.remove('mode-lower');
    render();
  }
  function curId() { return st.flow[st.i]; }
  function buzz() { try { navigator.vibrate && navigator.vibrate(10); } catch (e) {} }

  /* مقدار قبلی را وقتی کاربر به سؤال برمی‌گردد نشان می‌دهد */
  function loadPrev() {
    var id = curId(), q = Q[id];
    st.val = ''; st.sel = null;
    if (q.type === 'num') {
      if (id === 'len' || id === 'wid') { if (st.lw[id] != null) st.val = String(st.lw[id]); }
      else if (st.asked[id]) st.val = String(st.a[id]);
    } else if (q.type === 'city') {
      if (st.asked.city) st.val = String(CITIES.findIndex(function (c) { return c.key === st.a.city; }) + 1);
    } else if (st.asked[id]) {
      st.sel = q.o.findIndex(function (o) { return o.v === st.a[id]; });
    }
  }

  /* ---------- نمایش ---------- */
  function setPlus(t) { plusSmall.textContent = t || ''; }
  function lcdTop(l, r) { return '<div class="lcd-top"><span>' + l + '</span><span>' + (r || '') + '</span></div>'; }
  function tapeLine() { return '<div class="tape">' + (st.i > 0 && st.tape[st.i - 1] ? esc(st.tape[st.i - 1]) : '&nbsp;') + '</div>'; }

  function render() {
    var h;
    plus.classList.toggle('pulse', st.step === 'intro');
    if (st.step === 'intro') {
      h = lcdTop('ماشین‌حساب هوشمند', '') +
        '<p class="q hero">کولرت چند هزار است؟</p>' +
        '<div class="start-cue"><span class="arrow" aria-hidden="true">←</span><span>برای شروع، کلید نارنجی <b>+</b> را بزنید</span></div>' +
        '<div class="hintline"><span>همه‌ی محاسبه روی گوشی شما انجام می‌شود.</span></div>';
      lcd.innerHTML = h; setPlus('شروع'); return;
    }
    if (st.step === 'confirm') {
      var ar = st.a.area;
      lcd.innerHTML = lcdTop('متراژ اتاق', '') + '<div class="res"><div class="u">' + fa(st.lw.len) + ' × ' + fa(st.lw.wid) + ' =</div><div class="big">' + fa(ar) + '</div><div class="u">متر مربع</div></div>' +
        '<p class="expert">چند لحظه‌ی دیگر می‌رود. اگر اشتباه است، «قبلی» را بزنید.</p>';
      setPlus('بعدی'); clearTimeout(autoT);
      autoT = setTimeout(function () { if (st.step === 'confirm') press('+'); }, 1000);
      return;
    }
    if (st.step === 'result') { renderResult(); return; }
    if (st.step === 'lead') {
      lcd.innerHTML = lcdTop('درخواست مشاوره', '') + '<p class="q">نام و شماره‌ی موبایل خود را وارد کنید.</p><p class="sub">کارشناس هومکس برای عدد دقیق با شما تماس می‌گیرد.</p>';
      return;
    }
    if (st.step === 'thanks') {
      lcd.innerHTML = lcdTop('ممنون از شما', '✓') + '<p class="q">درخواست شما ثبت شد.</p>' +
        '<p class="sub">در نسخه‌ی نهایی، این درخواست برای کارشناس هومکس ارسال می‌شود. در این نسخه‌ی نمایشی، هیچ اطلاعاتی ذخیره یا ارسال نشد.</p>' +
        '<div class="slogan"><span>هومکس</span><strong>به اندازه</strong></div>';
      return;
    }
    var id = curId(), q = Q[id], n = st.i + 1;
    var right = q.type === 'choice' ? 'شماره را بزنید' : (q.type === 'city' ? 'فهرست را باز کنید' : 'عدد را بزنید');
    h = lcdTop('سؤال ' + fa(n), right) + (q.type === 'city' ? '' : tapeLine()) + '<p class="q">' + q.q + '</p>';
    if (q.type === 'choice') {
      h += '<ul class="opts">' + q.o.map(function (o, i) {
        return '<li data-i="' + i + '" class="' + (st.sel === i ? 'on' : '') + '"><b>' + fa(i + 1) + '</b><span class="nm">' + o.l + '</span>' + (o.s ? '<small>' + o.s + '</small>' : '') + '</li>';
      }).join('') + '</ul><div class="hintline"><span id="msg"></span></div>';
    } else if (q.type === 'city') {
      h += '<button type="button" class="citybtn" id="citybtn"><span>' + (st.asked.city ? esc(E.cityByKey(D, st.a.city).name) : 'انتخاب استان یا شهر') + '</span><span aria-hidden="true">▾</span></button>' +
        '<div class="hintline" style="margin-top:auto"><span id="msg">فهرست را باز کنید و استان یا شهر خود را بزنید.</span></div>';
    } else {
      h += '<div class="entry"><span class="unit">' + q.unit + '</span><span class="num' + (st.val ? '' : ' empty') + '">' + fa(st.val) + '</span></div>' +
        '<div class="hintline"><span id="msg">' + (id === 'wid' && st.val && st.lw.len ? fa(st.lw.len) + ' × ' + fa(st.val) + ' = ' + fa(st.lw.len * +st.val) + ' متر مربع' : (st.val && validNum(q) && canExtend(q) ? 'برای ادامه «+» را بزنید' : (q.hint || ''))) + '</span>' +
        (id === 'area' ? '<button type="button" class="lk" id="dk">متراژ را نمی‌دانم</button>' : '') + '</div>';
    }
    lcd.innerHTML = h;
    var dk = $('dk');
    if (dk) dk.onclick = function () { st.flow = ['len', 'wid'].concat(HEAD.slice(1)); st.i = 0; st.asked.area = false; loadPrev(); render(); };
    Array.prototype.forEach.call(lcd.querySelectorAll('.opts li'), function (li) {
      li.addEventListener('click', function () { pick(+li.getAttribute('data-i')); });
    });
    var cb = $('citybtn'); if (cb) cb.onclick = openSheet;
    setPlus(q.type === 'choice' ? '' : (q.type === 'city' ? 'انتخاب' : 'بعدی'));
    if (q.type === 'city' && st.autoCity) { st.autoCity = false; openSheet(); }
  }

  function err(m) {
    var e = $('msg'), n = lcd.querySelector('.num');
    if (e) { e.className = 'err'; e.textContent = m; }
    if (n) { n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake'); }
    buzz();
  }

  /* ---------- ثبت پاسخ و رفتن به سؤال بعد ---------- */
  function setTape(label) { st.tape.length = st.i; st.tape[st.i] = label; }

  function commit(id, value, label) {
    if (id === 'len' || id === 'wid') {
      st.lw[id] = value; setTape(Q[id].t + ': ' + fa(value));
      if (id === 'wid') {
        var area = st.lw.len * value;
        if (area < Q.area.min || area > Q.area.max) { st.lw.wid = null; err('متراژ باید بین ۵ تا ۵۰۰ متر مربع باشد'); return; }
        st.a.area = area; st.asked.area = true; st.tape[st.i] = 'طول × عرض = ' + fa(area) + ' متر مربع';
        st.step = 'confirm'; render(); return;
      }
    } else {
      st.a[id] = value; st.asked[id] = true; setTape(label);
    }
    if (id === 'windows' && !st.all) {                // از اینجا فقط سؤال‌هایی که روی مدل اثر دارند
      var rel = E.relevantKeys(D, calcAnswers(), CANDS);
      st.skipped = CANDS.filter(function (k) { return rel.indexOf(k) === -1; });
      st.flow = st.flow.slice(0, st.i + 1).concat(rel);
    }
    if (st.i < st.flow.length - 1) { st.i++; st.autoCity = !st.all && curId() === 'city'; loadPrev(); render(); }
    else { st.step = 'result'; st.i = st.flow.length - 1; render(); }
  }
  function calcAnswers() { var a = Object.assign({}, st.a); return a; }

  function pick(i) {
    var id = curId(), q = Q[id];
    if (q.type === 'choice') {
      if (i >= q.o.length) { buzz(); return; }
      st.sel = i; render();
      setTimeout(function () { if (st.sel === i && st.step === 'q' && curId() === id) commit(id, q.o[i].v, q.t + ': ' + q.o[i].l); }, 280);
    }
  }
  /* ---------- انتخاب شهر (برگه‌ی جست‌وجو) ---------- */
  function norm(t) { return String(t).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s]+/g, '').toLowerCase(); }
  function renderSheet(f) {
    var q = norm(f || ''), list = $('sheet-list'); list.innerHTML = '';
    var n = 0;
    CITIES.forEach(function (c) {
      if (q && norm(c.name).indexOf(q) === -1) return;
      n++;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sheet-item' + (st.asked.city && st.a.city === c.key ? ' on' : '');
      b.textContent = c.name;
      b.addEventListener('click', function () { closeSheet(); commit('city', c.key, c.name); });
      list.appendChild(b);
    });
    if (!n) { var p = document.createElement('p'); p.className = 'sub'; p.textContent = 'موردی پیدا نشد.'; list.appendChild(p); }
  }
  function openSheet() { $('sheet-q').value = ''; renderSheet(''); $('sheet').hidden = false; var on = $('sheet-list').querySelector('.on'); if (on) on.scrollIntoView({ block: 'center' }); }
  function closeSheet() { $('sheet').hidden = true; }
  $('sheet-q').addEventListener('input', function () { renderSheet(this.value); });
  $('sheet-x').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });
  function sheetOpen() { return !$('sheet').hidden; }

  function press(k) {
    clearTimeout(autoT);
    if (sheetOpen()) return;
    buzz();
    if (st.step === 'confirm') {
      if (k === '+') { st.step = 'q'; st.i++; st.autoCity = !st.all && curId() === 'city'; loadPrev(); render(); }
      else if (k === 'back' || k === 'del') { st.step = 'q'; loadPrev(); render(); }
      return;
    }
    if (st.step === 'intro') { if (k === '+') { st.step = 'q'; loadPrev(); render(); } return; }
    if (st.step === 'result') { if (k === 'back' || k === 'del') goBackFromResult(); return; }
    if (st.step !== 'q') return;
    var id = curId(), q = Q[id];
    if (k === 'back') {
      if (st.i > 0) { st.i--; loadPrev(); render(); }
      else { st.step = 'intro'; render(); }
      return;
    }
    if (q.type === 'city') {
      if (k === '+') { if (st.asked.city) commit(id, st.a.city, E.cityByKey(D, st.a.city).name); else openSheet(); }
      return;
    }
    if (q.type === 'choice') {
      if (/^[1-9]$/.test(k)) pick(+k - 1);
      else if (k === '+') { if (st.sel != null) commit(id, q.o[st.sel].v, q.t + ': ' + q.o[st.sel].l); else err('یکی از شماره‌ها را بزنید'); }
      return;
    }
    if (/^\d$/.test(k)) {
      if (st.val.length >= q.len) return;
      st.val = (st.val === '0' ? '' : st.val) + k; render(); scheduleAuto(id, q); return;
    }
    if (k === 'del') { st.val = st.val.slice(0, -1); render(); return; }
    if (k === '+') {
      if (st.val === '') { err('یک عدد وارد کنید'); return; }
      var v = +st.val;
      if (v < q.min || v > q.max) { err('عدد باید بین ' + fa(q.min) + ' تا ' + fa(q.max) + ' باشد'); return; }
      commit(id, v, q.t + ': ' + fa(v));
    }
  }
  /* عدد کامل شد: بدون زدن «+» به سؤال بعد می‌رود */
  function canExtend(q) { var v = +st.val; return st.val.length < q.len && v > 0 && v * 10 <= q.max; }
  function validNum(q) { var v = +st.val; return st.val !== '' && v >= q.min && v <= q.max; }
  function scheduleAuto(id, q) {
    clearTimeout(autoT);
    if (!validNum(q)) return;
    autoT = setTimeout(function () { if (st.step === 'q' && curId() === id && validNum(q)) press('+'); }, canExtend(q) ? 2000 : 260);
  }
  function goBackFromResult() {
    document.body.classList.remove('mode-lower');
    st.step = 'q'; loadPrev(); render();
  }

  /* ---------- نتیجه ---------- */
  function seriesName(m) { return m.form === 'stand' ? 'ایستاده' : (m.series === 'inverter' ? 'اینورتر' : 'معمولی (روتاری)'); }
  function modelCard(item, tag) {
    return '<div class="card"><div class="tag">' + tag + '</div><div class="nm">' + (item.count > 1 ? fa(item.count) + ' دستگاه ' : '') + seriesName(item.model) + ' ' + faN(item.model.capacity) + '</div><span class="code">' + esc(item.model.code) + '</span></div>';
  }
  function optLabel(key, v) { var o = D.options[key].filter(function (x) { return x.value === v; })[0]; return o ? o.label : String(v); }

  function renderResult() {
    var ev = E.evaluate(D, calcAnswers()), rec = ev.rec, calc = ev.calc, a = st.a;
    document.body.classList.add('mode-lower');
    lcd.innerHTML = lcdTop('نتیجه', 'تخمین هوشمند') +
      '<div class="res"><div class="u">' + (rec.primary.count > 1 ? 'ظرفیت پیشنهادی (مجموع ' + fa(rec.primary.count) + ' دستگاه)' : 'ظرفیت پیشنهادی') + '</div>' +
      '<div class="big">' + faN(rec.bigCapacity) + '</div><div class="u">BTU</div><span class="pill">تخمین هوشمند</span></div>' +
      '<p class="expert">برای عدد دقیق، کارشناس هومکس با شما تماس می‌گیرد.</p>';
    var notes = '';
    function note(t) { notes += '<div class="note">' + t + '</div>'; }
    if (rec.tropicalNote) note('برای مناطق گرمسیری، کولرهای گرمسیری (T3) با قابلیت کارکرد در دمای بالا پیشنهاد می‌شود. کارشناس هومکس مدل مناسب را معرفی می‌کند؛ مدل‌های زیر برای مقایسه‌ی ظرفیت آمده‌اند.');
    if (rec.humidNote) note('در اقلیم‌های گرم و مرطوب، اسپلیت معمولی با کمپرسور ثابت دوام بیشتری نسبت به اینورتر دارد.');
    if (rec.alt) note('برای این ظرفیت می‌توانید یک دستگاه ایستاده یا دو دستگاه دیواری انتخاب کنید.');
    if (!rec.inverter && D.formula.inverterClimates.indexOf(calc.cityType) !== -1) note('در این ظرفیت، مدل اینورتر دیواریِ موجود نداریم.');
    if (calc.peopleCapped) note('برای این متراژ، حداکثر ' + fa(calc.maxPeople) + ' نفر در محاسبه لحاظ شد.');
    var cards = '';
    if (rec.inverter) cards += modelCard(rec.inverter, 'اینورتر (صرفه‌جویی انرژی)');
    cards += modelCard(rec.primary, rec.primary.model.form === 'stand' ? 'دستگاه ایستاده' : 'اسپلیت معمولی');
    if (rec.alt) cards += modelCard(rec.alt, 'یا دو دستگاه دیواری');
    function dflt(k) { return st.skipped.indexOf(k) !== -1 ? ' (فرض پیش‌فرض)' : ''; }
    var dl = '<dt>بار محاسبه‌شده</dt><dd>' + faN(calc.load) + ' BTU</dd>' +
      '<dt>متراژ</dt><dd>' + fa(a.area) + ' متر مربع</dd>' +
      '<dt>شهر</dt><dd>' + esc(E.cityByKey(D, a.city).name) + '</dd>' +
      '<dt>ارتفاع سقف</dt><dd>' + fa(a.height) + ' متر (پیش‌فرض)</dd>' +
      '<dt>پنجره‌ها</dt><dd>' + optLabel('orientation', a.orientation) + '، ' + fa(a.windows) + ' پنجره</dd>' +
      '<dt>تعداد افراد</dt><dd>' + fa(a.people) + dflt('people') + '</dd>' +
      '<dt>طبقه</dt><dd>' + optLabel('floor', a.floor) + dflt('floor') + '</dd>' +
      '<dt>آشپزخانه</dt><dd>' + optLabel('kitchen', a.kitchen) + dflt('kitchen') + '</dd>' +
      '<dt>عایق</dt><dd>' + optLabel('insulation', a.insulation) + dflt('insulation') + '</dd>';
    lower.innerHTML = '<div class="panel"><h3>مدل‌های هومکس برای این ظرفیت</h3>' + notes + cards +
      '<details><summary>جزئیات محاسبه</summary><dl>' + dl + '</dl>' +
      (st.skipped.length ? '<p class="sub" style="margin-top:6px;font-size:12.5px">پاسخ مواردِ «فرض پیش‌فرض» روی مدل پیشنهادی اثری نداشت، پس نپرسیدیم. با «تغییر پاسخ‌ها» می‌توانید همه را ببینید و عوض کنید.</p>' : '') + '</details></div>' +
      '<button class="btn btn-primary" id="b-lead" type="button">درخواست مشاوره با کارشناس هومکس</button>' +
      '<button class="btn btn-ghost" id="b-edit" type="button">تغییر پاسخ‌ها</button>';
    $('b-lead').onclick = openLead;
    $('b-edit').onclick = function () {
      st.all = true; st.flow = HEAD.concat(CANDS); st.i = 0; st.step = 'q'; st.tape = [];
      document.body.classList.remove('mode-lower'); loadPrev(); render();
    };
    window.scrollTo(0, 0);
  }

  /* ---------- فرم مشاوره (نمایشی؛ هیچ چیز ارسال نمی‌شود) ---------- */
  function openLead() {
    st.step = 'lead'; render();
    lower.innerHTML = '<form class="panel form" id="lf" novalidate>' +
      '<div class="field"><label for="in-name">نام و نام خانوادگی</label><input id="in-name" type="text" autocomplete="name" placeholder="مثلاً مسعود حجازی"></div>' +
      '<div class="field"><label for="in-mobile">شماره‌ی موبایل</label><input id="in-mobile" class="ltr" type="tel" inputmode="numeric" autocomplete="tel" placeholder="09123456789" maxlength="14"></div>' +
      '<fieldset class="when"><legend>چه زمانی تماس بگیریم؟</legend>' +
      '<label class="radio"><input type="radio" name="when" value="now"><span>می‌خواهم همین حالا خرید کنم</span></label>' +
      '<label class="radio"><input type="radio" name="when" value="season"><span>در فصل خرید با من تماس بگیرید</span></label></fieldset>' +
      '<p class="fmsg" id="fmsg" role="status" aria-live="polite"></p>' +
      '<button class="btn btn-primary" type="submit">ارسال درخواست</button>' +
      '<button class="btn btn-ghost" type="button" id="lback">بازگشت به نتیجه</button></form>';
    try { history.pushState({ lead: 1 }, ''); } catch (e) {}
    $('lback').onclick = function () { st.step = 'result'; renderResult(); };
    $('lf').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var m = $('fmsg'), name = $('in-name').value.trim();
      var dg = String($('in-mobile').value).replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/\D/g, '');
      if (/^98\d{10}$/.test(dg)) dg = '0' + dg.slice(2);
      if (/^9\d{9}$/.test(dg)) dg = '0' + dg;
      if (name.length < 2) { m.textContent = 'لطفاً نام خود را وارد کنید.'; return; }
      if (!/^09\d{9}$/.test(dg)) { m.textContent = 'شماره‌ی موبایل را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.'; return; }
      if (!document.querySelector('input[name=when]:checked')) { m.textContent = 'یکی از دو گزینه‌ی زمان تماس را انتخاب کنید.'; return; }
      st.step = 'thanks'; render();
      lower.innerHTML = '<button class="btn btn-primary" id="b-again" type="button">محاسبه‌ی دوباره</button>';
      $('b-again').onclick = reset;
      window.scrollTo(0, 0);
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', function () {
    if (st.step === 'lead') { st.step = 'result'; renderResult(); }
  });

  /* ---------- کلیدها ---------- */
  var keys = $('keys');
  [['7'], ['8'], ['9'], ['del', '⌫', 'fn'], ['4'], ['5'], ['6'], ['+', '+', 'plus'], ['1'], ['2'], ['3'], ['0', '', 'zero'], ['back', 'قبلی', 'fn back']].forEach(function (L) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'k ' + (L[2] || '');
    if (L[0] === '+') { b.id = 'plus'; b.innerHTML = '+<small></small>'; plusSmall = b.querySelector('small'); plus = b; }
    else b.textContent = /^\d$/.test(L[0]) ? FA[+L[0]] : L[1];
    b.setAttribute('aria-label', L[0] === 'del' ? 'پاک کردن' : L[0] === 'back' ? 'سؤال قبلی' : L[0] === '+' ? 'تأیید و بعدی' : 'عدد ' + FA[+L[0]]);
    b.addEventListener('click', function () { press(L[0]); });
    keys.appendChild(b);
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (/^\d$/.test(k)) press(k);
    else if (k === '+' || k === 'Enter') press('+');
    else if (k === 'Backspace') press('del');
    else return;
    e.preventDefault();
  });
  $('restart').addEventListener('click', reset);
  reset();
})();
