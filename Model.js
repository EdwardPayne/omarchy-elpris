// elprisetjustnu.se serves one JSON array per day and zone. Entries are
// quarter-hour slots since the 2025 market change, but older days and DST
// switches vary, so nothing here assumes a fixed count.

function parseDay(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    if (!Array.isArray(data)) return []
    var out = []
    for (var i = 0; i < data.length; i++) {
      var e = data[i]
      if (!e || e.SEK_per_kWh === undefined || !e.time_start) continue
      var startMs = Date.parse(e.time_start)
      var endMs = Date.parse(e.time_end || "")
      if (isNaN(startMs)) continue
      out.push({
        sek: parseFloat(e.SEK_per_kWh),
        startMs: startMs,
        endMs: isNaN(endMs) ? startMs + 15 * 60 * 1000 : endMs
      })
    }
    return out
  } catch (err) {
    return []
  }
}

function currentEntry(entries, nowMs) {
  for (var i = 0; i < entries.length; i++) {
    if (nowMs >= entries[i].startMs && nowMs < entries[i].endMs) return entries[i]
  }
  return null
}

// Quarter slots averaged into local hours for a readable 24-bar chart.
function hourly(entries) {
  var buckets = {}
  var order = []
  for (var i = 0; i < entries.length; i++) {
    var d = new Date(entries[i].startMs)
    var key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate() + "-" + d.getHours()
    if (!buckets[key]) {
      buckets[key] = { hour: d.getHours(), startMs: entries[i].startMs, endMs: entries[i].endMs, sum: 0, n: 0 }
      order.push(key)
    }
    buckets[key].sum += entries[i].sek
    buckets[key].n += 1
    if (entries[i].endMs > buckets[key].endMs) buckets[key].endMs = entries[i].endMs
  }
  var out = []
  for (var j = 0; j < order.length; j++) {
    var b = buckets[order[j]]
    out.push({ hour: b.hour, startMs: b.startMs, endMs: b.endMs, sek: b.sum / b.n })
  }
  return out
}

function stats(entries) {
  if (!entries || entries.length === 0) return null
  var min = entries[0].sek, max = entries[0].sek, sum = 0
  for (var i = 0; i < entries.length; i++) {
    var v = entries[i].sek
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  return { min: min, max: max, avg: sum / entries.length }
}

// 0 = cheap, 1 = mid, 2 = expensive, judged against the day's own range.
// A flat day (max == min) is all "mid".
function levelFor(sek, dayStats) {
  if (!dayStats || dayStats.max - dayStats.min < 0.0001) return 1
  var t = (sek - dayStats.min) / (dayStats.max - dayStats.min)
  if (t <= 1 / 3) return 0
  if (t <= 2 / 3) return 1
  return 2
}

function normalizedZone(value) {
  var z = String(value || "").trim().toUpperCase()
  return /^SE[1-4]$/.test(z) ? z : "SE3"
}

function useOre(unitSetting) {
  return String(unitSetting || "").trim().toLowerCase().indexOf("re") !== -1
}

function fmt(sek, ore) {
  if (sek === null || sek === undefined || isNaN(sek)) return "—"
  if (ore) return Math.round(sek * 100) + " öre"
  return sek.toFixed(2).replace(".", ",") + " kr"
}

// Bar label stays compact: no unit suffix in öre mode reads fine ("134"),
// but kr needs the suffix to not look like a version number.
function fmtShort(sek, ore) {
  if (sek === null || sek === undefined || isNaN(sek)) return ""
  if (ore) return String(Math.round(sek * 100))
  return sek.toFixed(2).replace(".", ",")
}

function apiUrl(zone, date) {
  var y = date.getFullYear()
  var m = String(date.getMonth() + 1)
  var d = String(date.getDate())
  if (m.length < 2) m = "0" + m
  if (d.length < 2) d = "0" + d
  return "https://www.elprisetjustnu.se/api/v1/prices/" + y + "/" + m + "-" + d + "_" + zone + ".json"
}

if (typeof module !== "undefined") {
  module.exports = {
    parseDay: parseDay,
    currentEntry: currentEntry,
    hourly: hourly,
    stats: stats,
    levelFor: levelFor,
    normalizedZone: normalizedZone,
    useOre: useOre,
    fmt: fmt,
    fmtShort: fmtShort,
    apiUrl: apiUrl
  }
}
