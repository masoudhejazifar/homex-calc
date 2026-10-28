/* موتور محاسبه — فقط منطق، بدون هیچ ارتباطی با ظاهر صفحه.
   همه‌ی عددها از data.json می‌آیند. فرمول عیناً از ماشین‌حساب رسمی هومکس برداشته شده
   (hommex.ir/page/btu-calculator). این فایل هم در مرورگر و هم در Node کار می‌کند. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HomexEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FA = '۰۱۲۳۴۵۶۷۸۹';
  var AR = '٠١٢٣٤٥٦٧٨٩';

  /* متن را (حتی با رقم فارسی/عربی) به عدد تبدیل می‌کند. اگر نشد NaN برمی‌گرداند. */
  function parseNumber(text) {
    var s = String(text == null ? '' : text).trim();
    s = s.replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); });
    s = s.replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); });
    s = s.replace(/[٬\s]/g, '').replace(/[٫،,]/g, '.');
    if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
    return parseFloat(s);
  }

  function cityByKey(data, key) {
    for (var i = 0; i < data.cities.length; i++) if (data.cities[i].key === key) return data.cities[i];
    return null;
  }

  /* ---- ۱) بار سرمایش (BTU) — همان ترتیب مراحل ماشین‌حساب هومکس ---- */
  function computeLoad(data, a) {
    var F = data.formula;
    var city = cityByKey(data, a.city);
    if (!city) throw new Error('unknown city: ' + a.city);

    var base = a.area * F.baseLoadPerM2[city.type];
    if (a.height > F.heightRef) base *= a.height / F.heightRef;
    base += a.windows * F.windowBTU[a.orientation];
    base *= F.insulationFactor[a.insulation];
    base *= F.floorFactor[a.floor];

    var maxPeople = Math.max(F.minPeopleCap, Math.floor(a.area / 1));
    var actualPeople = Math.min(a.people, maxPeople);
    var personLoad = actualPeople * F.personLoad;
    base += personLoad;

    var kitchenLoad = F.kitchenLoad[a.kitchen];
    base += kitchenLoad;

    var raw = Math.round(base);
    return {
      cityType: city.type,
      rawLoad: raw,
      load: Math.max(F.minLoad, raw),
      internalLoad: personLoad + kitchenLoad,
      peopleCapped: a.people > maxPeople,
      maxPeople: maxPeople
    };
  }

  /* ---- ۲) انتخاب مدل: کوچک‌ترین ظرفیتِ موجود که برابر یا بیشتر از نیاز باشد ---- */
  function pickAtLeast(list, x) {
    for (var i = 0; i < list.length; i++) if (list[i].capacity >= x) return list[i];
    return null;
  }
  function byCap(a, b) { return a.capacity - b.capacity; }

  function recommend(data, need, cityType) {
    var avail = data.models.filter(function (m) { return m.available; });
    var wallRot = avail.filter(function (m) { return m.series === 'rotary' && m.form === 'wall'; }).sort(byCap);
    var inv = avail.filter(function (m) { return m.series === 'inverter'; }).sort(byCap);
    var stands = avail.filter(function (m) { return m.form === 'stand'; }).sort(byCap);

    var primary = null, alt = null;
    var rot = pickAtLeast(wallRot, need);
    if (rot) {
      primary = { model: rot, count: 1 };
    } else {
      var st = pickAtLeast(stands, need);
      if (st) {
        primary = { model: st, count: 1 };
        var half = pickAtLeast(wallRot, need / 2);
        if (half) alt = { model: half, count: 2 };
      } else {
        var biggest = stands[stands.length - 1];
        primary = { model: biggest, count: Math.ceil(need / biggest.capacity) };
      }
    }

    var inverter = null;
    if (data.formula.inverterClimates.indexOf(cityType) !== -1) {
      var iv = pickAtLeast(inv, need);
      if (iv) inverter = { model: iv, count: 1 };
    }

    return {
      need: need,
      primary: primary,
      alt: alt,
      inverter: inverter,
      bigCapacity: primary.model.capacity * primary.count,
      tropicalNote: cityType === 'hot',
      humidNote: cityType === 'humid'
    };
  }

  function signature(rec) {
    return JSON.stringify([
      rec.primary.model.code, rec.primary.count,
      rec.alt ? rec.alt.model.code : null,
      rec.inverter ? rec.inverter.model.code : null,
      rec.tropicalNote, rec.humidNote
    ]);
  }

  function evaluate(data, a) {
    var c = computeLoad(data, a);
    var rec = recommend(data, c.load, c.cityType);
    return { calc: c, rec: rec, sig: signature(rec) };
  }

  /* ---- ۳) پرسش‌های تطبیقی: سؤالی که روی مدل پیشنهادی اثر ندارد پرسیده نمی‌شود ---- */
  function optionValues(data, key) {
    var r = data.questions.ranges[key];
    if (r) { var out = []; for (var v = r.min; v <= r.max; v++) out.push(v); return out; }
    return data.options[key].map(function (o) { return o.value; });
  }

  /* فهرست سؤال‌های باقی‌مانده که «واقعاً» روی مدل پیشنهادی اثر دارند.
     روش: همه‌ی ترکیب‌های ممکنِ پاسخ‌ها را حساب می‌کند (بدون حدس). */
  function relevantKeys(data, answers, candidates) {
    var lists = candidates.map(function (k) { return optionValues(data, k); });
    var n = candidates.length;
    var idx = new Array(n).fill(0);
    var sigOf = {};
    var done = false;
    while (!done) {
      var a = Object.assign({}, answers);
      for (var i = 0; i < n; i++) a[candidates[i]] = lists[i][idx[i]];
      sigOf[idx.join(',')] = evaluate(data, a).sig;
      var p = n - 1;
      while (p >= 0) {
        idx[p]++;
        if (idx[p] < lists[p].length) break;
        idx[p] = 0; p--;
      }
      if (p < 0) done = true;
    }
    var matters = {};
    Object.keys(sigOf).forEach(function (key) {
      var parts = key.split(',');
      for (var i = 0; i < n; i++) {
        if (matters[i]) continue;
        for (var j = 0; j < lists[i].length; j++) {
          if (j === +parts[i]) continue;
          var other = parts.slice(); other[i] = String(j);
          if (sigOf[other.join(',')] !== sigOf[key]) { matters[i] = true; break; }
        }
      }
    });
    return candidates.filter(function (k, i) { return matters[i]; });
  }

  function fmtNum(n, fractionDigits) {
    var d = fractionDigits == null ? 0 : fractionDigits;
    try { return Number(n).toLocaleString('fa-IR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
    catch (e) { return Number(n).toFixed(d); }
  }

  return {
    parseNumber: parseNumber,
    cityByKey: cityByKey,
    computeLoad: computeLoad,
    recommend: recommend,
    evaluate: evaluate,
    signature: signature,
    optionValues: optionValues,
    relevantKeys: relevantKeys,
    fmtNum: fmtNum
  };
});
