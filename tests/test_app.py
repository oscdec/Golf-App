import json, os, sys, random
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765/index.html"
OUT = os.path.dirname(os.path.abspath(__file__))
errors = []
fails = []
def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)


def ci(pg):
    pg.wait_for_timeout(120)
    if pg.locator("[data-act=cistart],[data-act=ciend]").count():
        pg.click('[data-act=ci][data-q=fun][data-v=yes]');pg.click('[data-act=ci][data-q=life][data-v=no]');pg.click('[data-act=ci][data-q=hq][data-v="8"]')
        pg.click("[data-act=cistart],[data-act=ciend]");pg.wait_for_timeout(200)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, service_workers="block")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type == "error" and "fonts.g" not in m.text and "ERR_" not in m.text and errors.append("console: " + m.text))
    pg.on("dialog", lambda d: d.accept("3") if d.type == "prompt" else d.accept())
    pg.goto(BASE + "#practice"); pg.wait_for_timeout(400)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(400)

    # tabs
    check(pg.locator("nav.tabs .tab").count() == 5, "five tabs in the bar")
    labels = pg.locator("nav.tabs .tab").all_text_contents()
    check([l.strip() for l in labels] == ["Practice", "Rounds", "Notes", "Tempo", "Insights"], f"tab order {labels}")
    pg.screenshot(path=f"{OUT}/01-practice-home.png", full_page=True)
    check(pg.locator(".s-day").count() == 6, "week card has 6 day rows")

    # ---- Notes ----
    pg.click("nav .tab[data-tab=notes]"); pg.wait_for_timeout(200)
    check(pg.locator(".n-card").count() == 7, "seven note boxes")
    names = pg.locator(".n-top h2").all_text_contents()
    check(names == ["General", "Mental", "Driver", "Irons", "Wedges", "Chipping", "Putting"], f"note box names {names}")
    box = pg.locator('.n-box[data-a=wedges]')
    box.fill("Hands soft, chest turns through")
    pg.wait_for_timeout(500)
    stored = pg.evaluate("JSON.parse(localStorage.getItem('rg.notes')).cur.wedges")
    check(stored == "Hands soft, chest turns through", "note autosaves")
    check("Not saved yet" in pg.locator('[data-status=wedges]').text_content(), "typing shows it isn't saved until Update")
    pg.click('[data-act=update][data-a=wedges]'); pg.wait_for_timeout(150)
    check(pg.locator('.n-box[data-a=wedges]').input_value() == "Hands soft, chest turns through", "Update keeps the text in the box")
    check("Saved" in pg.locator('[data-status=wedges]').text_content() and pg.locator('.n-card[data-a=wedges] .n-undo').count() == 1, "Update saves a copy, Undo bar shows")
    pg.click('[data-act=update][data-a=wedges]'); pg.wait_for_timeout(100)
    check(len(pg.evaluate("JSON.parse(localStorage.getItem('rg.notes')).hist.wedges")) == 1, "Update again with no changes doesn't save a duplicate")
    pg.click('[data-act=undo][data-a=wedges]'); pg.wait_for_timeout(150)
    check(len(pg.evaluate("JSON.parse(localStorage.getItem('rg.notes')).hist.wedges")) == 0 and pg.locator('.n-box[data-a=wedges]').input_value() == "Hands soft, chest turns through", "Undo takes the saved copy back, text stays")
    for i in range(7):
        pg.locator('.n-box[data-a=wedges]').fill(f"Cue number {i+1}")
        pg.click('[data-act=update][data-a=wedges]'); pg.wait_for_timeout(60)
    hist = pg.evaluate("JSON.parse(localStorage.getItem('rg.notes')).hist.wedges.map(x=>x.text)")
    check(len(hist) == 5 and hist[0] == "Cue number 7" and hist[-1] == "Cue number 3", f"keeps last 5 newest first {hist}")
    pg.click('[data-act=prev][data-a=wedges]'); pg.wait_for_timeout(100)
    check(pg.locator('.n-card[data-a=wedges] .n-prev li').count() == 5, "Previous notes lists 5")
    pg.screenshot(path=f"{OUT}/02-notes.png", full_page=True)
    check(pg.locator('.n-box[data-a=wedges]').input_value() == "Cue number 7", "the latest update stays in the box")
    pg.click('.n-card[data-a=wedges] [data-act=restore][data-i="1"]'); pg.wait_for_timeout(100)
    check(pg.locator('.n-box[data-a=wedges]').input_value() == "Cue number 6", "put a previous note back")
    pg.locator('.n-box[data-a=irons]').fill("Pressure into lead heel")
    pg.click('[data-act=update][data-a=general]')  # empty box: nothing happens
    check(pg.evaluate("(JSON.parse(localStorage.getItem('rg.notes')).hist.general||[]).length") == 0, "Update on empty box does nothing")
    pg.wait_for_timeout(500)

    # ---- Week: move a session, reset ----
    pg.goto(BASE + "#practice/s/chipgame"); pg.wait_for_timeout(200)
    pg.click('[data-act=move][data-slot=wed]'); pg.wait_for_timeout(100)
    wk = pg.evaluate("JSON.parse(localStorage.getItem('rg.week')).days")
    check(wk["wed"] == ["techchip", "techputt", "chipgame"] and wk["fri"] == ["puttgame"], f"move splits a pair {wk['wed']} {wk['fri']}")
    pg.screenshot(path=f"{OUT}/03-session-move.png", full_page=True)
    pg.goto(BASE + "#practice"); pg.wait_for_timeout(200)
    check(pg.locator("[data-act=resetweek]").count() == 1, "reset/save-as-usual buttons appear after a move")
    pg.click("[data-act=resetweek]"); pg.wait_for_timeout(100)
    wk = pg.evaluate("JSON.parse(localStorage.getItem('rg.week')).days")
    check(wk["fri"] == ["chipgame", "puttgame"], "back to usual week")
    # weekend flexibility: Sat/Sun both map to the weekend slot
    slot = pg.evaluate("""(()=>{const f=d=>{const w=d.getDay();return w===0||w===6?'wknd':['','mon','tue','wed','thu','fri'][w]};return [f(new Date(2026,10,21)),f(new Date(2026,10,22))]})()""")
    check(slot == ["wknd", "wknd"], "Saturday and Sunday both count as the weekend slot")

    # ---- Run Thursday: Ball-Striking Combine then Wedge Combine ----
    pg.click('[data-act=startday][data-slot=thu]'); pg.wait_for_timeout(300);ci(pg)
    check("#practice/run" in pg.url, "starting a day opens the session")
    pg.wait_for_timeout(1300)
    el = pg.locator('.s-tot [data-clock=elapsed]').inner_text()
    pg.wait_for_timeout(1000); el = pg.locator('.s-tot [data-clock=elapsed]').inner_text()
    check(el in ("0:01", "0:02", "0:03"), f"practice clock runs ({el})")
    left = pg.locator('.s-clock [data-clock=block]').inner_text()
    check(left.startswith("29:5"), f"block countdown from 30:00 ({left})")
    check(pg.locator('.s-note').count() == 2 and "Pressure into lead heel" in pg.locator('.s-notes').inner_text(), "session shows Driver and Irons notes")
    pg.screenshot(path=f"{OUT}/04-run.png", full_page=True)
    # pause
    pg.click('[data-act=pause]'); pg.wait_for_timeout(1300)
    a = pg.locator('.s-tot [data-clock=elapsed]').inner_text(); pg.wait_for_timeout(1100)
    check(a == pg.locator('.s-tot [data-clock=elapsed]').inner_text(), "pause stops the clock")
    pg.click('[data-act=pause]'); pg.wait_for_timeout(100)

    pg.click('[data-act=launch][data-k=bsc]'); pg.wait_for_timeout(200)
    check("#practice/g/bsc" in pg.url, "launch opens Ball-Striking Combine")
    check(pg.locator(".s-runbar").count() == 1, "session clock bar shows on the game screen")
    pg.click('[data-act=drv][data-v="5"]'); pg.wait_for_timeout(50)
    pg.click('[data-act=begin]'); pg.wait_for_timeout(200)
    pg.screenshot(path=f"{OUT}/05-bsc-play.png", full_page=True)
    random.seed(3)
    for i in range(24):
        call = pg.locator(".p-call").inner_text().split("\n")[0]
        if call.startswith("Driver"):
            c = 245 + random.uniform(-40, 15); o = random.uniform(0, 30)
        else:
            t = int(call.split()[0]); c = t + random.uniform(-8, 8); o = random.uniform(0, 9)
        pg.fill("#bCarry", f"{c:.1f}")
        pg.fill("#bOff", f"{o:.1f}")
        if i % 3 == 0: pg.click('[data-act=side][data-v=L]')
        if i == 5:  # Enter-key path
            pg.press("#bOff", "Enter")
        else:
            pg.click("[data-act=shot]")
        pg.wait_for_timeout(40)
        if i == 2:  # undo once and re-enter
            pg.click("[data-act=undo]"); pg.wait_for_timeout(40)
            pg.fill("#bCarry", f"{c:.1f}"); pg.fill("#bOff", f"{o:.1f}"); pg.click("[data-act=shot]"); pg.wait_for_timeout(40)
    pg.wait_for_timeout(200)
    check("#practice/res/" in pg.url, "combine finishes after 24 shots")
    big = pg.locator(".r-big").first.inner_text()
    check("hcp" in big, f"result is a plays-like handicap ({big})")
    check(pg.locator(".p-bench").count() == 3 and "Shortest 10%" in pg.content() and "55.8%" in pg.content(), "plays-like, benchmark and Lou solid-drive tables show")
    check("of 6 solid" in pg.content(), "drives scored as solid")
    pg.screenshot(path=f"{OUT}/06-bsc-result.png", full_page=True)
    check(pg.locator("a.play", has_text="Back to session").count() == 1, "result offers Back to session")
    pg.click("a.play:has-text('Back to session')"); pg.wait_for_timeout(200)
    check(pg.locator(".s-what .r-list a").count() == 1, "played game listed in the block")
    pg.click('[data-act=next]'); pg.wait_for_timeout(200);ci(pg)
    check("Wedge Combine" in pg.locator(".s-clock").text_content(), "moves on to the Wedge Combine block")
    pg.click('[data-act=launch][data-k=wedge]'); pg.wait_for_timeout(150)
    pg.click('[data-act=begin]'); pg.wait_for_timeout(150)
    for i in range(24):
        t = int(pg.locator(".p-call").inner_text().split()[0])
        pg.fill("#bCarry", f"{t + random.uniform(-5, 5):.1f}"); pg.fill("#bOff", f"{random.uniform(0, 5):.1f}")
        pg.click("[data-act=shot]"); pg.wait_for_timeout(30)
    pg.wait_for_timeout(200)
    check("hcp" in pg.locator(".r-big").first.inner_text() and "Inside 15 ft" in pg.content(), "wedge combine result")
    pg.screenshot(path=f"{OUT}/07-wedge-result.png", full_page=True)
    pg.click("a.play:has-text('Back to session')"); pg.wait_for_timeout(150)
    check(pg.locator('[data-act=next]').text_content() == "Finish Session", "last block says Finish session")
    pg.click('[data-act=next]'); pg.wait_for_timeout(300);ci(pg)
    check("#practice/sum/" in pg.url, "summary after finishing")
    pg.screenshot(path=f"{OUT}/08-summary.png", full_page=True)
    log = pg.evaluate("JSON.parse(localStorage.getItem('rg.practiceLog'))")
    check(len(log) == 2 and all(x["done"] for x in log) and log[0]["disc"] == "Full swing", "minutes logged per block")
    pg.click("a.play:has-text('Done')"); pg.wait_for_timeout(200)
    check(pg.locator(".s-day.done").count() == 1 and "Thursday" in pg.locator(".s-day.done").text_content(), "Thursday highlighted done")
    pg.screenshot(path=f"{OUT}/09-week-done.png", full_page=True)

    # ---- Overtime display ----
    pg.click('[data-act=startday][data-slot=tue]'); pg.wait_for_timeout(200);ci(pg)
    pg.evaluate("(()=>{const r=JSON.parse(localStorage.getItem('rg.run'));r.since-=61*60000;localStorage.setItem('rg.run',JSON.stringify(r))})()")
    pg.reload(); pg.wait_for_timeout(1300)
    lbl = pg.locator('.s-big [data-clock=blocklbl]').text_content()
    check(lbl == "over" and pg.locator('.s-clock [data-clock=block].over').count() == 1, "over-time shows in red as 'over'")
    pg.screenshot(path=f"{OUT}/10-overtime.png", full_page=True)
    check(pg.locator("[data-act=pickr]").count()==2, "ball striking asks for a routine")
    pg.click('[data-act=endrun]'); pg.wait_for_timeout(300);ci(pg)
    check(pg.evaluate("JSON.parse(localStorage.getItem('rg.week')).done.striking") is not None, "end now + confirm marks it done")

    # ---- Up-and-Down 18 ----
    pg.goto(BASE + "#practice/g/updown"); pg.wait_for_timeout(150)
    pg.click('[data-act=begin]'); pg.wait_for_timeout(100)
    seq = [2, 2, 3, 1, 2, 4, 2, 3, 2, 2, 3, 2, 2, 3, 2, 2, 2, 3]
    for i, sc in enumerate(seq):
        if i == 5: pg.click('[data-act=dc]'); pg.wait_for_timeout(20)
        pg.click(f'.r-nums [data-act=ud][data-v="{sc}"]'); pg.wait_for_timeout(25)
    pg.wait_for_timeout(150)
    check(pg.locator(".r-big").first.inner_text().startswith(str(sum(seq))), "up-and-down total")
    check("1 double chip" in pg.content() and "(est.)" not in pg.content(), "double chip counted, no estimates")
    pg.screenshot(path=f"{OUT}/13-updown-result.png", full_page=True)

    # ---- SkyTrak log ----
    pg.goto(BASE + "#practice/g/skytrak"); pg.wait_for_timeout(150)
    pg.click('[data-act=begin]'); pg.wait_for_timeout(100)
    pg.fill("#skScore", "71.4"); pg.fill("#skHcp", "4.2"); pg.click("[data-act=sksave]"); pg.wait_for_timeout(150)
    check("71.4 pts" in pg.locator(".r-big").first.inner_text(), "SkyTrak score logged")

    # ---- older games still work: putting combine ----
    pg.goto(BASE + "#practice/g/combine"); pg.wait_for_timeout(150)
    pg.click('[data-act=begin]'); pg.wait_for_timeout(100)
    for i in range(20):
        pg.click('.r-nums [data-act=log][data-v="1"]' if i % 3 else '.r-nums [data-act=log][data-v="2"]'); pg.wait_for_timeout(20)
    pg.wait_for_timeout(150)
    check("Strokes gained" in pg.content(), "Putting Combine still finishes")

    # ---- other tabs render ----
    for t in ["rounds", "tempo", "insights", "practice"]:
        pg.goto(BASE + "#" + t); pg.wait_for_timeout(250)
    pg.screenshot(path=f"{OUT}/14-home-after.png", full_page=True)

    # dark mode look at home + notes
    dk = b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark", service_workers="block")
    dp = dk.new_page(); dp.on("pageerror", lambda e: errors.append("dark pageerror: " + str(e)))
    dp.goto(BASE + "#practice"); dp.wait_for_timeout(300)
    dp.evaluate("""(()=>{const w={of:'',days:{}};})()""")
    dp.screenshot(path=f"{OUT}/15-dark-home.png", full_page=True)
    b.close()

check(not errors, "no script errors: " + "; ".join(errors))
print("\n%d failures" % len(fails))
sys.exit(1 if fails else 0)
