import os,sys
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
BASE="http://localhost:8765/index.html";OUT=os.path.dirname(os.path.abspath(__file__))
errors=[];fails=[]
def check(c,m):
    print(("PASS " if c else "FAIL ")+m)
    if not c: fails.append(m)
J=lambda pg,e:pg.evaluate(e)

def ci(pg):
    pg.wait_for_timeout(120)
    if pg.locator("[data-act=cistart],[data-act=ciend]").count():
        pg.click('[data-act=ci][data-q=fun][data-v=yes]');pg.click('[data-act=ci][data-q=life][data-v=no]');pg.click('[data-act=ci][data-q=hq][data-v="8"]')
        pg.click("[data-act=cistart],[data-act=ciend]");pg.wait_for_timeout(200)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,has_touch=True,is_mobile=True,service_workers="block")
    pg=ctx.new_page();pg.on("pageerror",lambda e:errors.append(str(e)))
    pg.on("console",lambda m:m.type=="error" and "fonts.g" not in m.text and "ERR_" not in m.text and errors.append(m.text))
    pg.on("dialog",lambda d:d.accept())
    pg.goto(BASE+"#practice");J(pg,"localStorage.clear()");pg.reload();pg.wait_for_timeout(300)

    # headings, freestyle optional, counts
    check(pg.locator("h2.p-h2").all_text_contents()==["This Week","Games"],"This Week and Games are big headings")
    wk=pg.locator(".s-day[data-slot=wknd]").text_content()
    check("Ball Striking – Freestyle" in wk and "Optional" in wk and "20 min" in wk,"Freestyle on the weekend, optional")
    check("0 of 8 done" in pg.locator(".s-weekhd").text_content(),"optional session not counted in total")
    pg.screenshot(path=f"{OUT}/t3-home.png",full_page=True)

    # drag Wedge Combine (Thu) to Monday with mouse
    def drag(sid,slot,before=None):
        g=pg.locator(f'.s-sess[data-s={sid}] .s-grip');g.scroll_into_view_if_needed();bb=g.bounding_box()
        x,y=bb["x"]+bb["width"]/2,bb["y"]+bb["height"]/2
        pg.mouse.move(x,y);pg.mouse.down()
        def target():
            if before:
                t=pg.locator(f'.s-sess[data-s={before}]').bounding_box();return t["y"]+6
            t=pg.locator(f'.s-day[data-slot={slot}]').bounding_box();return t["y"]+t["height"]-8
        for _ in range(60):
            ty=target();step=max(-60,min(60,ty-y));y+=step;pg.mouse.move(x,y);pg.wait_for_timeout(40)
            if abs(target()-y)<4 and 90<y<760: break
        pg.wait_for_timeout(120);pg.mouse.up();pg.wait_for_timeout(250)
    drag("wedgecombine","mon")
    days=J(pg,"JSON.parse(localStorage.getItem('rg.week')).days")
    check(days["mon"]==["wedgecombine"] and days["thu"]==["bscombine"],f"drag moves a session to another day {days['mon']} {days['thu']}")
    drag("bscombine","tue",before="striking")
    days=J(pg,"JSON.parse(localStorage.getItem('rg.week')).days")
    check(days["tue"]==["bscombine","striking"],f"drag drops before another session {days['tue']}")
    pg.screenshot(path=f"{OUT}/t3-dragged.png",full_page=True)
    # touch drag
    g=pg.locator('.s-sess[data-s=wedge2] .s-grip');g.scroll_into_view_if_needed();bb=g.bounding_box()
    tgt=pg.locator('.s-day[data-slot=fri]').bounding_box()
    cdp=ctx.new_cdp_session(pg)
    def tp(t,x,y):cdp.send("Input.dispatchTouchEvent",{"type":t,"touchPoints":[] if t=="touchEnd" else [{"x":x,"y":y}]})
    x0,y0=bb["x"]+bb["width"]/2,bb["y"]+bb["height"]/2;y1=tgt["y"]+tgt["height"]-8
    tp("touchStart",x0,y0)
    for i in range(1,13): tp("touchMove",x0,y0+(y1-y0)*i/12);pg.wait_for_timeout(30)
    pg.wait_for_timeout(150);tp("touchEnd",0,0);pg.wait_for_timeout(250)
    days=J(pg,"JSON.parse(localStorage.getItem('rg.week')).days")
    check("wedge2" in days["fri"],f"touch drag works {days['fri']}")
    pg.click("[data-act=resetweek]");pg.wait_for_timeout(150)

    # discard a session: nothing logged
    pg.click('[data-act=startday][data-slot=wed]');pg.wait_for_timeout(300);ci(pg)
    check(pg.locator(".s-stepname").text_content()=="Warm-Up","Technical Chipping auto-starts its routine")
    check("Weight distribution" in pg.content() and pg.locator("[data-act=pickr]").count()==0,"chipping warm-up items, no routine picker")
    pg.screenshot(path=f"{OUT}/t3-chip-routine.png",full_page=True)
    pg.click("[data-act=discardrun]");pg.wait_for_timeout(250)
    check(J(pg,"localStorage.getItem('rg.run')")=="null" and J(pg,"JSON.parse(localStorage.getItem('rg.practiceLog')||'[]').length")==0,"Discard logs nothing")
    check(J(pg,"Object.keys(JSON.parse(localStorage.getItem('rg.week')).done).length")==0,"Discard marks nothing done")

    # putting routine: three steps, spiral finish
    pg.goto(BASE+"#practice/s/techputt");pg.wait_for_timeout(150);pg.click("[data-act=startone]");pg.wait_for_timeout(200);ci(pg)
    names=[]
    for i in range(3):
        names.append(pg.locator(".s-stepname").text_content())
        if i<2: pg.click('[data-act=step][data-v="1"]');pg.wait_for_timeout(60)
    check(names==["3' Startline Putts","Lag Putt And Finish","3' To 8' Putting Spiral"],f"putting steps {names}")
    check(pg.locator(".s-pick .r-opt").all_text_contents()==["3 Ft","4 Ft","5 Ft","6 Ft","7 Ft","8 Ft"] or pg.locator(".s-pick .r-opt").count()==6,"spiral selector 3–8")
    check(pg.locator("[data-act=tal]").count()==0 and "Farthest Spiral Distance" in pg.content(),"no spiral counter; selector labelled")
    pg.click('[data-act=pick][data-v="6"]');pg.wait_for_timeout(50)
    check(pg.locator('[data-act=pick][data-v="6"]').get_attribute("aria-pressed")=="true","pick 6 ft")
    pg.click('[data-act=pick][data-v="8"]');pg.wait_for_timeout(50)
    check("Whole spiral done" in pg.content(),"8 ft = whole spiral")
    pg.screenshot(path=f"{OUT}/t3-putt-routine.png",full_page=True)
    pg.click("[data-act=next]");pg.wait_for_timeout(250);ci(pg)
    check("8 ft" in pg.locator(".s-res").text_content() and "Farthest Spiral Distance" in pg.content(),"summary shows farthest spiral distance")
    lg=J(pg,"JSON.parse(localStorage.getItem('rg.practiceLog')).slice(-1)[0].results")
    check(lg[0]["value"]==8,"spiral distance saved")

    # last-done dates
    pg.goto(BASE+"#practice");pg.wait_for_timeout(200)
    check("Last " in pg.locator('.s-sess[data-s=techputt]').text_content(),"session shows last done date")

    # solo game: logged as extra, count for plan
    pg.goto(BASE+"#practice/g/wedge");pg.wait_for_timeout(150)
    pg.click("[data-act=begin]");pg.wait_for_timeout(100)
    calls=[]
    for i in range(24):
        t=int(pg.locator(".p-call").inner_text().split()[0]);calls.append(t)
        pg.fill("#bCarry",str(t+2));pg.fill("#bOff","3");pg.click("[data-act=shot]");pg.wait_for_timeout(25)
    pg.wait_for_timeout(150)
    check(min(calls)==30 and sorted(set(calls))==[30,40,50,60,75,90,105,120],f"wedge combine distances {sorted(set(calls))}")
    check("Plays Like, By Distance" in pg.content() and pg.locator(".p-grid tr").count()==9 and "Lou Stagner, averages from the fairway" in pg.content(),"wedge: 8 distances scored on Lou's tables")
    check(pg.locator(".p-grid tr").nth(3).locator("td").first.text_content()=="23","50 yd scratch average is Lou's 23 ft")
    pg.screenshot(path=f"{OUT}/t3-wedge-result.png",full_page=True)
    log=J(pg,"JSON.parse(localStorage.getItem('rg.practiceLog'))")
    check(any(x.get("free") and x["title"]=="Wedge Combine" for x in log),"solo game logged as extra practice")
    btn=pg.locator("[data-act=countsess]")
    check(btn.count()==1 and "Wedge Combine" in btn.text_content(),"offers to count for this week's Wedge Combine")
    btn.click();pg.wait_for_timeout(150)
    check("Counted as this week's Wedge Combine" in pg.content(),"counted note")
    check(J(pg,"!!JSON.parse(localStorage.getItem('rg.week')).done.wedgecombine"),"session marked done")
    log=J(pg,"JSON.parse(localStorage.getItem('rg.practiceLog'))")
    check(not any(x.get("free") for x in log),"minutes moved off Extra Practice")
    # ladder wedges from 30
    pg.goto(BASE+"#practice/g/ladder");pg.wait_for_timeout(150);pg.click("[data-act=begin]");pg.wait_for_timeout(100)
    check(pg.locator(".p-rungs span").first.text_content()=="30" and pg.locator(".p-rungs span").count()==8,"wedge ladder starts at 30, 8 rungs")
    pg.click("[data-act=quit]");pg.wait_for_timeout(100)
    # a freestanding chipping game shows in Extra Practice
    pg.goto(BASE+"#practice/g/chip20");pg.click("[data-act=begin]");pg.wait_for_timeout(80)
    yds=[]
    for i in range(20):
        yds.append(int(pg.locator(".p-call").inner_text().split()[0]));pg.click('.c-zones [data-v="3"]');pg.wait_for_timeout(12)
    check(sorted(yds)==sorted([10,15,20,25,30]*4),"chipping combine: 4 each at 10–30 yd")
    # every chip 8 ft: 10 yd median 8 vs Lou 8.1 at 5 hcp -> ~4.9; 30 yd 8 vs 14.8 scratch -> plus
    big=pg.locator(".r-big").first.text_content()
    check("hcp" in big and "Lou Stagner" in pg.content() and "(est.)" not in pg.content(),f"plays-like vs Lou, no estimates ({big})")
    pg.screenshot(path=f"{OUT}/t4-chip-result.png",full_page=True)
    pg.wait_for_timeout(100);pg.click("[data-act=countsess]") if False else None
    pg.goto(BASE+"#practice");pg.wait_for_timeout(200)
    ex=pg.locator(".s-extra")
    check(ex.count()==1 and "Chipping Combine" in ex.text_content(),"Extra Practice lists the solo game")
    check("Last " in pg.locator(".r-list a[href='#practice/g/chip20']").text_content(),"game row shows last played date")
    pg.screenshot(path=f"{OUT}/t3-home-after.png",full_page=True)
    # title case spot checks
    pg.goto(BASE+"#rounds");pg.wait_for_timeout(200)
    tt=J(pg,"[...document.querySelectorAll('#roundsRoot button,#roundsRoot a.play')].map(e=>getComputedStyle(e).textTransform)")
    check(all(t in("capitalize","uppercase") for t in tt),f"rounds buttons capitalized ({set(tt)})")
    b.close()
check(not errors,"no script errors "+"; ".join(errors))
sys.exit(1 if fails else 0)
