// Operator builder — the trip/quote creation workspace.
function BuilderScreen() {
  const { AGENCY, TRIP, BUILDER, inr } = window;
  const catTotal = (g) => g.items.reduce((s, i) => s + i.cost, 0);

  return (
    <div className="bd">
      {/* top bar */}
      <div className="bd-top">
        <div className="bd-crumb">
          <span>Trips</span><window.ChevronRight />
          <b>Bali · Sharma</b>
        </div>
        <span className="sp"></span>
        <div className="bd-trip-facts">
          <span><b>{TRIP.days}</b> days</span>
          <span><b>{TRIP.travelers}</b> travellers</span>
          <span><b>{TRIP.dateRange}</b></span>
          <span className="badge b-info"><span className="bdot"></span>Quoted</span>
        </div>
      </div>

      <div className="bd-body">
        {/* ===== MAIN — quote builder ===== */}
        <div className="bd-main">
          <div className="bd-head">
            <div>
              <div className="eyb gold">Quotation</div>
              <div className="t">Version {TRIP.version}</div>
            </div>
            <span className="badge b-navy"><span className="bdot"></span>Sent</span>
          </div>

          {/* version tabs */}
          <div className="vtabs">
            <span className="vtab"><span className="vd" style={{ background: "var(--bad)" }}></span>v1<span className="dl" style={{ color: "var(--bad)" }}>−₹12,000</span></span>
            <span className="vtab on"><span className="vd" style={{ background: "var(--gold)" }}></span>v2</span>
            <span className="vtab add"><window.Plus /></span>
          </div>

          {/* line item groups */}
          {BUILDER.groups.map((g, gi) => (
            <div className="li-group" key={gi}>
              <div className="li-ghead">
                <span className="lft">
                  <window.ChevronDown className="cv" />
                  <span className="li-cat">{g.cat}</span>
                  <span className="li-cnt">{g.items.length}</span>
                </span>
                <span className="li-sub">{inr(catTotal(g))}</span>
              </div>
              <div className="li-rows">
                {g.items.map((it, ii) => (
                  <div className="li-row" key={ii}>
                    <span className="grip"><window.Grip /></span>
                    <span className="lbl">{it.label}</span>
                    <span className="cost">{inr(it.cost)}</span>
                    <span className="x"><window.X /></span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* actions */}
          <div className="li-actions">
            <span className="btn btn-ghost btn-sm"><window.Plus /> Add line item</span>
            <span className="btn btn-ghost btn-sm" style={{ color: "var(--sand-deep)" }}><window.Sparkles /> Common items</span>
            <span className="btn btn-ghost btn-sm" style={{ color: "var(--sand-deep)" }}><window.Wand /> Pull from itinerary</span>
          </div>

          {/* markup + discount */}
          <div className="md-row">
            <div className="fld">
              <label>Markup %</label>
              <div className="inp">{BUILDER.markupPct}</div>
            </div>
            <div className="fld">
              <label className="flex jb ac" style={{ display: "flex" }}>
                <span>Discount</span>
                <span className="seg"><b className="on">%</b><b>₹</b></span>
              </label>
              <div className="inp">{BUILDER.discountPct}</div>
            </div>
          </div>

          {/* internal notes */}
          <div style={{ marginTop: 18 }}>
            <div className="eyb" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <window.Info style={{ width: 12, height: 12 }} /> Internal notes · operator-only
            </div>
            <div className="inp" style={{ height: "auto", minHeight: 56, alignItems: "flex-start", padding: "11px 12px", fontFamily: "var(--sans)", color: "var(--muted)", lineHeight: 1.6 }}>
              Margin floor ₹52k. COMO holds the rate till 5 Jun — reconfirm Nusa Penida boat for 18th.
            </div>
          </div>
        </div>

        {/* ===== RAIL — summary + send/share + preview ===== */}
        <div className="bd-rail">
          {/* pricing summary */}
          <div className="sum">
            <div className="sum-top">
              <span className="eyb">Pricing summary</span>
              <span className="seg" style={{ borderColor: "rgba(239,234,224,.2)", background: "transparent" }}>
                <b className="on" style={{ background: "var(--paper)", color: "var(--ink)" }}>Total</b>
                <b style={{ color: "rgba(239,234,224,.6)" }}>Per person</b>
              </span>
            </div>
            <div className="sum-row"><span className="l">Subtotal</span><span className="v">{inr(BUILDER.subtotal)}</span></div>
            <div className="sum-row"><span className="l">Markup ({BUILDER.markupPct}%)</span><span className="v">+{inr(BUILDER.markupAmt)}</span></div>
            <div className="sum-row"><span className="l">Discount ({BUILDER.discountPct}%)</span><span className="v">−{inr(BUILDER.discountAmt)}</span></div>
            <div className="sum-div"></div>
            <div className="sum-sell">
              <span className="l">Selling price</span>
              <span className="v">{inr(BUILDER.selling)}</span>
            </div>
            <div className="sum-pp">{inr(BUILDER.perPerson)} × {TRIP.travelers} travellers</div>
            <div className="sum-profit">
              <span className="l"><window.Info /> Profit · operator-only</span>
              <span className="v">{inr(BUILDER.profit)} · {BUILDER.marginPct}%</span>
            </div>
          </div>

          {/* live preview thumb */}
          <div className="prev-card">
            <div className="prev-frame">
              <div style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", pointerEvents: "none" }}>
                <MiniCover />
              </div>
            </div>
            <div className="prev-foot">
              <span className="l">Live proposal · <b>updates as you edit</b></span>
              <span className="btn btn-ghost btn-sm"><window.Eye /> Open preview</span>
            </div>
          </div>

          {/* send & share */}
          <div className="share">
            <div className="share-head">
              <window.Send />
              <h4>Send &amp; share</h4>
              <span className="badge b-ok"><span className="bdot"></span>Ready</span>
            </div>
            <div className="share-body">
              <div className="link-field">
                <window.Link />
                <span className="url">wayfarer.co/p/bali-sharma-v2</span>
                <span className="btn btn-ghost btn-sm" style={{ height: 28 }}><window.Copy /> Copy</span>
              </div>
              <div className="send-grid">
                <div className="send-btn wa"><window.MessageCircle /> Send on WhatsApp</div>
                <div className="send-btn pdf"><window.Download /> Download PDF</div>
                <div className="send-btn"><window.Mail /> Email</div>
              </div>
            </div>
          </div>

          {/* delivery timeline */}
          <div>
            <div className="eyb" style={{ marginBottom: 14 }}>Delivery status</div>
            <div className="tl">
              <div className="tl-step done"><span className="ln"></span><span className="dot"></span><span className="lb">Drafted</span></div>
              <div className="tl-step done"><span className="ln"></span><span className="dot"></span><span className="lb">Sent</span></div>
              <div className="tl-step cur"><span className="ln"></span><span className="dot"></span><span className="lb">Viewed</span></div>
              <div className="tl-step"><span className="dot"></span><span className="lb">Accepted</span></div>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 14, textAlign: "center" }}>
              Opened by {TRIP.preparedFor.split(" ")[0]} · 2 hours ago
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// tiny cover used in the live-preview thumbnail
function MiniCover() {
  const { AGENCY, TRIP } = window;
  return (
    <div style={{ width: 760, height: 400, background: "var(--navy)", position: "relative", overflow: "hidden", color: "#fff", fontFamily: "var(--sans)" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 82% 12%, rgba(200,169,106,.3), transparent 55%), linear-gradient(180deg, rgba(8,16,24,.3), rgba(8,16,24,.9))" }}></div>
      <div style={{ position: "relative", padding: "32px 40px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div className="flex jb ac">
          <div className="flex ac" style={{ gap: 12 }}>
            <span className="seal" style={{ width: 34, height: 34, fontSize: 13, background: "rgba(255,255,255,.06)" }}>{AGENCY.monogram}</span>
            <span style={{ fontWeight: 700, letterSpacing: ".3em", fontSize: 12 }}>WAYFARER &amp; CO.</span>
          </div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "rgba(255,255,255,.7)" }}>v{TRIP.version}</span>
        </div>
        <div>
          <div style={{ fontSize: 12, letterSpacing: ".34em", textTransform: "uppercase", color: "var(--sand)", marginBottom: 10 }}>A journey for {TRIP.travelers}</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 72, lineHeight: .9 }}>{TRIP.destination}</div>
          <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 18, color: "rgba(255,255,255,.8)", marginTop: 12 }}>Prepared for {TRIP.preparedFor}</div>
        </div>
      </div>
    </div>
  );
}

window.BuilderScreen = BuilderScreen;
