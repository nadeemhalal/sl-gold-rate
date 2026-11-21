(function () {
  const history = Array.isArray(window.GOLD_HISTORY) ? window.GOLD_HISTORY : [];
  const app = document.getElementById("app");

  const COLORS = {
    "CBSL (official reference)": "#4c6ef5",
    "IdeaBeam (market reference)": "#12b886",
    "Devi Jewellers": "#f59f00",
    "Bullion Lanka Jewellers": "#e8590c",
    "Ran Lanka Gem & Jewellery": "#ae3ec9",
  };

  function fmtLKR(n) {
    if (!Number.isFinite(n)) return "—";
    return "Rs. " + n.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function fmtDate(iso) {
    if (!iso || iso === "n/a") return "—";
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else node.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  if (history.length === 0) {
    app.innerHTML = "";
    app.appendChild(
      el("div", { class: "hero empty" }, [
        el("div", { class: "label" }, ["No data yet"]),
        el("div", {}, ["Run the scraper (npm run scrape) at least once to populate the dashboard."]),
      ])
    );
    return;
  }

  const latest = history[history.length - 1];
  const sellers = latest.records.filter((r) => r.kind === "seller");
  const benchmarks = latest.records.filter((r) => r.kind === "benchmark");
  const validSellers = sellers.filter((r) => !r.error && !r.flagged);
  const cheapest = validSellers.reduce((min, r) => (!min || r.pricePerGram24K < min.pricePerGram24K ? r : min), null);
  const mostExpensive = validSellers.reduce((max, r) => (!max || r.pricePerGram24K > max.pricePerGram24K ? r : max), null);

  app.innerHTML = "";

  // Header
  app.appendChild(
    el("header", { class: "page-header" }, [
      el("h1", {}, ["🪙 Sri Lanka Gold Rate — 24K"]),
      el("div", { class: "meta" }, [`Data for ${fmtDate(latest.date)} · generated ${new Date(latest.generatedAt).toLocaleString("en-GB")}`]),
    ])
  );

  // Hero: cheapest seller
  if (cheapest) {
    const savingsVsMax =
      mostExpensive && mostExpensive.source !== cheapest.source
        ? mostExpensive.pricePerGram24K - cheapest.pricePerGram24K
        : 0;
    app.appendChild(
      el("div", { class: "hero" }, [
        el("div", { class: "label" }, ["Cheapest seller today"]),
        el("div", { class: "seller-name" }, [cheapest.source]),
        el("div", { class: "price" }, [fmtLKR(cheapest.pricePerGram24K) + " /g"]),
        el("div", { class: "subtext" }, [
          savingsVsMax > 0
            ? `Rs. ${Math.round(savingsVsMax).toLocaleString("en-LK")} cheaper per gram than the priciest tracked seller (${mostExpensive.source}). Rate published ${fmtDate(cheapest.publishedDate)}.`
            : `Rate published ${fmtDate(cheapest.publishedDate)}.`,
        ]),
      ])
    );
  } else {
    app.appendChild(
      el("div", { class: "hero empty" }, [
        el("div", { class: "label" }, ["No reliable seller price today"]),
        el("div", {}, ["All tracked sellers errored or looked suspicious (flagged) — check the cards below."]),
      ])
    );
  }

  function badgesFor(r) {
    const badges = [];
    if (cheapest && r.source === cheapest.source) badges.push(el("span", { class: "badge crown" }, ["CHEAPEST"]));
    if (r.error) badges.push(el("span", { class: "badge error" }, ["SCRAPE FAILED"]));
    else if (r.flagged) badges.push(el("span", { class: "badge flagged" }, ["FLAGGED"]));
    else if (r.stale) badges.push(el("span", { class: "badge stale" }, [`STALE (${r.staleDays}d)`]));
    else badges.push(el("span", { class: "badge fresh" }, ["FRESH"]));
    return badges;
  }

  function renderCard(r, referencePrice) {
    const delta =
      referencePrice && !r.error && Number.isFinite(r.pricePerGram24K) ? r.pricePerGram24K - referencePrice : null;
    const card = el("div", { class: "rate-card" + (cheapest && r.source === cheapest.source ? " cheapest" : "") }, [
      el("div", { class: "name" }, [r.source]),
      el("div", { class: "price" }, [r.error ? "—" : fmtLKR(r.pricePerGram24K) + " /g"]),
      delta !== null
        ? el("div", { class: "delta" }, [
            delta === 0 ? "at reference price" : (delta > 0 ? "+" : "") + fmtLKR(delta) + " vs cheapest",
          ])
        : null,
      r.error ? el("div", { class: "error-text" }, [r.error]) : null,
      r.flagged && r.flagReason ? el("div", { class: "error-text" }, [r.flagReason]) : null,
      el("div", { class: "footer-row" }, badgesFor(r)),
      el("div", { class: "footer-row" }, [
        el("a", { class: "src-link", href: r.sourceUrl, target: "_blank", rel: "noopener" }, [
          r.error ? "source" : `published ${fmtDate(r.publishedDate)} · source`,
        ]),
      ]),
    ]);
    return card;
  }

  app.appendChild(
    el("section", {}, [
      el("h2", {}, ["Sellers"]),
      el(
        "div",
        { class: "card-grid" },
        sellers.map((r) => renderCard(r, cheapest ? cheapest.pricePerGram24K : null))
      ),
    ])
  );

  app.appendChild(
    el("section", {}, [
      el("h2", {}, ["Benchmarks (reference rates, not sellers)"]),
      el(
        "div",
        { class: "card-grid" },
        benchmarks.map((r) => renderCard(r, null))
      ),
    ])
  );

  // Trend chart
  const allDates = history.map((d) => d.date);
  const seriesNames = Object.keys(COLORS);
  const series = seriesNames.map((name) => ({
    name,
    color: COLORS[name],
    points: history
      .map((day) => {
        const rec = day.records.find((r) => r.source === name);
        if (!rec || rec.error) return null;
        return { date: day.date, value: rec.pricePerGram24K };
      })
      .filter(Boolean),
  }));

  const chartSection = el("section", {}, [el("h2", {}, ["Trend (per gram, 24K)"])]);
  const chartWrap = el("div", { class: "chart-wrap" });

  if (allDates.length < 2) {
    chartWrap.appendChild(
      el("div", { class: "subtext" }, ["Only one day of history so far — check back daily and a trend line will build up here."])
    );
  } else {
    chartWrap.appendChild(buildChartSvg(series, allDates));
  }

  const legend = el(
    "div",
    { class: "legend" },
    seriesNames.map((name) =>
      el("span", {}, [el("span", { class: "swatch", style: `background:${COLORS[name]}` }), name])
    )
  );
  chartWrap.appendChild(legend);
  chartSection.appendChild(chartWrap);
  app.appendChild(chartSection);

  // Footer
  app.appendChild(
    el("footer", {}, [
      el("div", {}, [
        "Sellers (Devi Jewellers, Bullion Lanka Jewellers, Ran Lanka Gem & Jewellery) publish their own daily selling rate. ",
        "CBSL and IdeaBeam are market benchmarks derived from the international gold price, not a seller you can buy from — shown for context only.",
      ]),
      el("div", {}, [
        "FRESH/STALE reflects how many days old the source's own published rate is. FLAGGED means a seller's price deviated more than 20% from the benchmark average, which usually means a broken or stale scrape rather than a real price — verify manually before trusting it.",
      ]),
    ])
  );

  function buildChartSvg(series, allDatesSorted) {
    const W = 860,
      H = 300,
      PAD_L = 70,
      PAD_R = 20,
      PAD_T = 16,
      PAD_B = 32;
    const dates = allDatesSorted;
    const xFor = (date) => {
      const idx = dates.indexOf(date);
      return PAD_L + (idx / Math.max(1, dates.length - 1)) * (W - PAD_L - PAD_R);
    };

    const allValues = series.flatMap((s) => s.points.map((p) => p.value));
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const span = max - min || 1;
    const yMin = min - span * 0.08;
    const yMax = max + span * 0.08;
    const yFor = (v) => PAD_T + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    // Y gridlines + labels
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const v = yMin + ((yMax - yMin) * i) / yTicks;
      const y = yFor(v);
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", PAD_L);
      line.setAttribute("x2", W - PAD_R);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "currentColor");
      line.setAttribute("stroke-opacity", "0.12");
      svg.appendChild(line);

      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", PAD_L - 8);
      label.setAttribute("y", y + 4);
      label.setAttribute("text-anchor", "end");
      label.setAttribute("font-size", "10");
      label.setAttribute("fill", "currentColor");
      label.setAttribute("opacity", "0.6");
      label.textContent = Math.round(v).toLocaleString("en-LK");
      svg.appendChild(label);
    }

    // X labels (up to 6, evenly spaced)
    const xLabelCount = Math.min(6, dates.length);
    for (let i = 0; i < xLabelCount; i++) {
      const idx = Math.round((i / Math.max(1, xLabelCount - 1)) * (dates.length - 1));
      const date = dates[idx];
      const x = xFor(date);
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", x);
      label.setAttribute("y", H - PAD_B + 16);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "10");
      label.setAttribute("fill", "currentColor");
      label.setAttribute("opacity", "0.6");
      label.textContent = fmtDate(date);
      svg.appendChild(label);
    }

    // Series lines (break path on gaps)
    for (const s of series) {
      if (s.points.length === 0) continue;
      let d = "";
      let prevDate = null;
      for (const p of s.points) {
        const x = xFor(p.date);
        const y = yFor(p.value);
        const idx = dates.indexOf(p.date);
        const prevIdx = prevDate ? dates.indexOf(prevDate) : null;
        const isGap = prevIdx !== null && idx - prevIdx > 1;
        d += (d === "" || isGap ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " ";
        prevDate = p.date;
      }
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", d.trim());
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", s.color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);

      for (const p of s.points) {
        const c = document.createElementNS(svgNS, "circle");
        c.setAttribute("cx", xFor(p.date));
        c.setAttribute("cy", yFor(p.value));
        c.setAttribute("r", "2.5");
        c.setAttribute("fill", s.color);
        svg.appendChild(c);
      }
    }

    return svg;
  }
})();
