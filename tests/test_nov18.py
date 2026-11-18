"""Nov 18 changes: section clock at the top, once-a-day check-in, shortened games and routines, editing finished
sessions and games, past sessions, sticky chart details, no in-box spellcheck."""
import os,sys,json
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
BASE="http://localhost:8765/index.html";OUT=os.path.dirname(os.path.abspath(__file__))
errors=[];fails=[]
def check(c,m):
    print(("PASS " if c else "FAIL ")+m)
    if not c: fails.append(m)
J=lambda pg,e:pg.evaluate(e)
location_hash=lambda pg:pg.evaluate("location.hash")
def answer(pg,act="ci",hq="7",life="no"):
    pg.click(f'[data-act={act}][data-q=fun][data-v=yes]');pg.click(f'[data-act={act}][data-q=life][data-v={life}]');pg.click(f'[data-act={act}][data-q=hq][data-v="{hq}"]')
def shift(pg,ms):
    J(pg,f"(()=>{{const r=JSON.parse(localStorage.getItem('rg.run'));r.since-={ms};localStorage.setItem('rg.run',JSON.stringify(r))}})()")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,service_workers="block",has_touch=True)
    pg=ctx.new_page();pg.on("pageerror",lambda e:errors.append(str(e)));pg.on("dialog",lambda d:d.accept())
    pg.on("console",lambda m:m.type=="error" and "fonts.g" not in m.text and "ERR_" not in m.text and "403" not in m.text and errors.append(m.text))
    pg.goto(BASE+"#practice");J(pg,"localStorage.clear()");pg.reload();pg.wait_for_timeout(300)

    # ---- session 1 of the day: check-in first, section clock at the top ----
    pg.goto(BASE+"#practice/s/techputt");pg.wait_for_timeout(150);pg.click("[data-act=startone]");pg.wait_for_timeout(200)
    check(pg.locator("#practiceRoot h1").text_content()=="Before You Start","first session of the day asks the check-in")
    answer(pg,hq="6");pg.click("[data-act=cistart]");pg.wait_for_timeout(1300)
    big=pg.locator(".s-clock .s-big").text_content()
    check("3' Startline Putts" in big and pg.locator(".s-clock [data-clock=step]").count()==1,f"section clock is the big clock at the top ({big.strip()[:40]})")
    check(pg.locator(".s-clock [data-clock=blockhd]").text_content()=="Block Left" and pg.locator(".s-what [data-clock=step]").count()==0,"block time sits under it; no clock left in the routine box")
    pg.screenshot(path=f"{OUT}/n1-clock.png",full_page=False)
    # spiral pick, mark shortened, finish
    pg.click('[data-act=step][data-v="1"]');pg.click('[data-act=step][data-v="1"]');pg.wait_for_timeout(100)
    pg.click('[data-act=pick][data-v="5"]');pg.click("[data-act=rshort]");pg.wait_for_timeout(100)
    check(pg.locator("[data-act=rshort]").get_attribute("aria-pressed")=="true","routine can be marked shortened")
    shift(pg,3*60000);pg.reload();pg.wait_for_timeout(300)
    pg.click("[data-act=next]");pg.wait_for_timeout(250)
    check(pg.locator("#practiceRoot h1").text_content()=="Done For Today?","end of session asks: done for today?")
    pg.screenshot(path=f"{OUT}/n2-doneforday.png",full_page=True)
    pg.click("[data-act=cilater]");pg.wait_for_timeout(250)
    c=pg.content()
    check("Session done" in c and "Shortened" in c and "No check-out yet" in c,"More Practice Later: summary, shortened tag, no check-out yet")
    log=J(pg,"JSON.parse(localStorage.getItem('rg.practiceLog'))")
    check(log[0].get("short") is True and log[0]["routine"]=="putt","shortened routine saved")
    check(pg.locator("#practiceRoot h1").text_content()=="Technical Putting" and pg.locator(".s-sblk").count()==1 and "Technical Putting" not in pg.locator(".s-sblk").text_content(),"summary names the session once")
    pg.click("a.play:has-text('Done')");pg.wait_for_timeout(200)
    check(pg.locator(".s-cocard").count()==1,"Practice home offers Check Out")
    check("Coming Next" not in pg.content(),"no Coming Next card")
    check(pg.locator(".s-past").count()==1 and "Technical Putting" in pg.locator(".s-past").text_content(),"Past Sessions lists it")

    # ---- session 2 the same day: no check-in, clock starts right away ----
    pg.goto(BASE+"#practice/s/techchip");pg.wait_for_timeout(150);pg.click("[data-act=startone]");pg.wait_for_timeout(1200)
    check(pg.locator("[data-act=cistart]").count()==0 and pg.locator(".s-clock").count()==1,"second session of the day skips the check-in")
    check(pg.locator(".s-cocard").count()==0,"no check-out card while a session runs")
    shift(pg,2*60000);pg.reload();pg.wait_for_timeout(300)
    pg.click("[data-act=next]");pg.wait_for_timeout(250)
    answer(pg,hq="9",life="yes");pg.click("[data-act=ciend]");pg.wait_for_timeout(250)
    ci=J(pg,"JSON.parse(localStorage.getItem('rg.checkins'))")
    check(len(ci)==2 and [x["when"] for x in ci]==["start","end"] and ci[1]["hq"]==9,f"one check-in and one check-out for the day ({[(x['when'],x['hq']) for x in ci]})")
    check("Today's Check-In" in pg.content(),"summary shows today's check-in")
    pg.goto(BASE+"#practice");pg.wait_for_timeout(200)
    check(pg.locator(".s-cocard").count()==0,"checked out: card gone")

    # ---- check out from the home card ----
    J(pg,"localStorage.setItem('rg.checkins',JSON.stringify(JSON.parse(localStorage.getItem('rg.checkins')).filter(x=>x.when==='start')))")
    pg.reload();pg.wait_for_timeout(200)
    pg.click(".s-cocard a.play");pg.wait_for_timeout(200)
    answer(pg,"co",hq="8");pg.click("[data-act=cosave]");pg.wait_for_timeout(250)
    ci=J(pg,"JSON.parse(localStorage.getItem('rg.checkins'))")
    check(len(ci)==2 and ci[1]["when"]=="end" and ci[1]["hq"]==8 and pg.locator(".s-cocard").count()==0,"Check Out from the home card saves the day's check-out")

    # ---- Insights: one column per day ----
    pg.goto(BASE+"#insights");pg.wait_for_timeout(200)
    if pg.locator("[data-view=practice]").get_attribute("aria-pressed")!="true":pg.click("[data-view=practice]");pg.wait_for_timeout(300)
    rows=pg.locator("#insightsRoot .i-card").first.locator("tbody tr").count()
    check(rows==1,f"How Practice Feels: one row for the day ({rows})")
    check("Shortened" not in pg.locator("#insightsRoot").text_content() and "Finish a routine with scored steps" in pg.content(),"shortened routine left out of Routines")
    # sticky tooltip: touch tap, lift, still showing; tap elsewhere hides it
    box=pg.locator("#iCI svg").bounding_box()
    pg.touchscreen.tap(box["x"]+box["width"]-30,box["y"]+100);pg.wait_for_timeout(300)
    check(pg.locator("#iCI .i-tip").is_visible(),"chart details stay after lifting the finger")
    pg.touchscreen.tap(20,box["y"]-40);pg.wait_for_timeout(200)
    check(not pg.locator("#iCI .i-tip").is_visible(),"tapping elsewhere closes them")
    pg.screenshot(path=f"{OUT}/n3-insights.png",full_page=True)

    # ---- edit a past session ----
    run1=log[0]["run"]
    pg.goto(BASE+f"#practice/sum/{run1}");pg.wait_for_timeout(200)
    pg.click("a:has-text('Edit Session')");pg.wait_for_timeout(200)
    pg.fill("[data-edmin='0']","25")
    pg.click('[data-act=edpick][data-v="7"]');pg.click("[data-act=edshort]")
    pg.click('[data-act=edci][data-w=start][data-q=hq][data-v="5"]')
    pg.screenshot(path=f"{OUT}/n4-edit-session.png",full_page=True)
    pg.click("[data-act=edsave]");pg.wait_for_timeout(250)
    log=J(pg,"JSON.parse(localStorage.getItem('rg.practiceLog'))");x=[r for r in log if r["run"]==run1][0]
    spiral=[r for r in x["results"] if r.get("pick")][0]
    check(x["min"]==25 and spiral["value"]==7 and not x.get("short"),f"session edit saves minutes, spiral and un-shortens ({x['min']}, {spiral['value']})")
    ci=J(pg,"JSON.parse(localStorage.getItem('rg.checkins'))")
    check(ci[0]["hq"]==5 and len(ci)==2,"session edit changes the day's check-in in place")
    # edit a Face Control tally and seq
    pg.goto(BASE+"#practice/s/striking");pg.wait_for_timeout(150);pg.click("[data-act=startone]");pg.wait_for_timeout(200)
    pg.click('[data-act=pickr][data-r=center]');pg.wait_for_timeout(100)
    pg.click('[data-act=step][data-v="1"]');pg.click('[data-act=step][data-v="1"]');pg.wait_for_timeout(100)
    for _ in range(3):pg.click('[data-act=tal][data-j="0"][data-v="1"]')
    pg.click("[data-act=endrun]");pg.wait_for_timeout(250);pg.click("[data-act=cilater]");pg.wait_for_timeout(250)
    pg.click("a:has-text('Edit Session')");pg.wait_for_timeout(200)
    pg.click('[data-act=edtal][data-r="0"][data-j="1"][data-v="1"]');pg.click('[data-act=edtal][data-r="0"][data-j="1"][data-v="1"]')
    pg.click("[data-act=edsave]");pg.wait_for_timeout(250)
    check("5/15" in pg.locator(".s-res").first.text_content(),"routine tally edited (3 + 2 = 5 of 15)")

    # ---- shortened game: End Early ----
    pg.goto(BASE+"#practice/g/combine");pg.wait_for_timeout(150);pg.click("[data-act=begin]");pg.wait_for_timeout(150)
    for v in ["1","2","1","1","2"]:pg.click(f'[data-act=log][data-v="{v}"]');pg.wait_for_timeout(40)
    pg.click("[data-act=shorten]");pg.wait_for_timeout(250)
    c=pg.content()
    check("Shortened · 5 of 20 putts" in c and "left out of your average" in c,"End Early saves a shortened game")
    gid=J(pg,"JSON.parse(localStorage.getItem('rg.games'))[0].id")
    nfree=len([r for r in J(pg,"JSON.parse(localStorage.getItem('rg.practiceLog'))") if r.get("free")])
    pg.goto(BASE+"#practice/g/combine");pg.wait_for_timeout(150)
    check("No finished games yet" in pg.content() and "Shortened" in pg.content(),"shortened game isn't an average to beat; history tags it")
    # continue it to the end
    pg.goto(BASE+f"#practice/res/{gid}");pg.wait_for_timeout(150);pg.click("[data-act=cont]");pg.wait_for_timeout(150)
    for i in range(15):pg.click('[data-act=log][data-v="1"]');pg.wait_for_timeout(30)
    g=J(pg,"JSON.parse(localStorage.getItem('rg.games'))[0]")
    nfree2=len([r for r in J(pg,"JSON.parse(localStorage.getItem('rg.practiceLog'))") if r.get("free")])
    check(g["status"]=="done" and not g.get("short") and g["result"]==22 and nfree2==nfree,f"Continue This Game finishes it, counted once ({g['result']}, {nfree}->{nfree2})")
    pg.click("[data-act=toggleshort]");pg.wait_for_timeout(150)
    check(J(pg,"JSON.parse(localStorage.getItem('rg.games'))[0].short")==True and "Count It Normally" in pg.content(),"finished game can be marked shortened (and back)")
    pg.click("[data-act=toggleshort]");pg.wait_for_timeout(150)

    # ---- edit a finished game: fixed-length (Chipping Combine) ----
    pg.goto(BASE+"#practice/g/chip20");pg.wait_for_timeout(150);pg.click("[data-act=begin]");pg.wait_for_timeout(150)
    for i in range(18):pg.click('[data-act=log][data-v="3"]');pg.wait_for_timeout(25)
    pg.click("[data-act=shorten]");pg.wait_for_timeout(200)
    pg.click("a:has-text('Edit')");pg.wait_for_timeout(200)
    check(pg.locator(".g-row").count()==20 and pg.locator(".g-row.empty").count()==2,"edit lists all 20 chips, the 2 missing ones empty")
    pg.screenshot(path=f"{OUT}/n5-edit-game.png",full_page=True)
    pg.select_option("[data-ge='0'][data-f=v]","0");pg.select_option("[data-ge='18'][data-f=v]","1");pg.select_option("[data-ge='19'][data-f=v]","2")
    pg.click("[data-act=gesave]");pg.wait_for_timeout(250)
    g=[x for x in J(pg,"JSON.parse(localStorage.getItem('rg.games'))") if x["game"]=="chip20"][0]
    check(len(g["log"])==20 and g["log"][0]==0 and g["log"][19]==2 and g.get("short") is True,"edits saved and missing chips filled (still marked shortened until you say otherwise)")
    check("Count It Normally" in pg.content(),"filled-in game can now be counted normally")
    # gap in the middle is refused
    pg.click("a:has-text('Edit')");pg.wait_for_timeout(200)
    pg.select_option("[data-ge='5'][data-f=v]","");pg.click("[data-act=gesave]");pg.wait_for_timeout(200)
    check(pg.locator(".g-edit").count()==1,"an empty entry in the middle isn't saved")
    # ---- open-ended game: ladder, remove and add ----
    pg.goto(BASE+"#practice/g/ladder");pg.wait_for_timeout(150);pg.click("[data-act=begin]");pg.wait_for_timeout(150)
    for v in ["1","0"]+["1"]*8:pg.click(f'[data-act=log][data-v="{v}"]');pg.wait_for_timeout(25)
    g=[x for x in J(pg,"JSON.parse(localStorage.getItem('rg.games'))") if x["game"]=="ladder"][0]
    check(g["status"]=="done" and g["result"]==10,"ladder done in 10 balls")
    pg.click("a:has-text('Edit')");pg.wait_for_timeout(200)
    pg.click('[data-act=gedel][data-i="1"]');pg.wait_for_timeout(100)
    check(pg.locator(".g-row").count()==9,"remove an entry")
    pg.click("[data-act=gesave]");pg.wait_for_timeout(200)
    g=[x for x in J(pg,"JSON.parse(localStorage.getItem('rg.games'))") if x["game"]=="ladder"][0]
    check(g["result"]==9 and g["status"]=="done" and not g.get("short"),"ladder re-scored after the edit (9 balls)")

    # ---- Past Sessions: bigger, and Delete ----
    pg.goto(BASE+"#practice");pg.wait_for_timeout(200)
    pg.click(".s-pasthd");pg.wait_for_timeout(150)
    fs=J(pg,"parseFloat(getComputedStyle(document.querySelector('.s-pasthd')).fontSize)")
    check(fs>=24,f"Past Sessions heading is big ({fs}px)")
    n=pg.locator(".s-pastrow").count()
    pg.locator(".s-pastrow").first.screenshot(path=f"{OUT}/n7-past-row.png")
    pg.screenshot(path=f"{OUT}/n7-past.png",full_page=True)
    newest=pg.locator(".s-pastrow [data-act=delrun]").first.get_attribute("data-run")
    pg.locator(".s-pastrow [data-act=delrun]").first.click();pg.wait_for_timeout(250)
    log=J(pg,"JSON.parse(localStorage.getItem('rg.practiceLog'))")
    check(pg.locator(".s-pastrow").count()==n-1 and not any(r.get("run")==newest for r in log),"Delete removes the session and its minutes")
    check(pg.locator(".s-past").get_attribute("open") is not None,"the list stays open after deleting")
    check(len(J(pg,"JSON.parse(localStorage.getItem('rg.checkins'))"))==2,"other sessions that day keep the day's check-in")
    pg.goto(BASE+f"#practice/sum/{run1}");pg.wait_for_timeout(200)
    pg.click("[data-act=delrun]");pg.wait_for_timeout(250)
    check(location_hash(pg)=="#practice" and not any(r.get("run")==run1 for r in J(pg,"JSON.parse(localStorage.getItem('rg.practiceLog'))")),"Delete Session on a summary works and goes home")

    # ---- Previous Notes always answers ----
    pg.goto(BASE+"#notes");pg.wait_for_timeout(200)
    pg.click('.n-card[data-a=mental] [data-act=prev]');pg.wait_for_timeout(150)
    check("No previous notes yet" in pg.locator('.n-card[data-a=mental]').text_content(),"Previous Notes on an empty box explains Update")
    pg.locator('.n-box[data-a=mental]').fill("Breathe");pg.click('.n-card[data-a=mental] [data-act=update]');pg.wait_for_timeout(150)
    check(pg.locator('.n-card[data-a=mental] .n-prev li').count()==1 and pg.locator('.n-box[data-a=mental]').input_value()=="Breathe","after Update, Previous Notes lists it and the box keeps it")
    # an old box that Update had cleared gets its last update back
    J(pg,"localStorage.setItem('rg.notes',JSON.stringify({cur:{putting:''},edited:{},hist:{putting:[{text:'Eyes over the ball',at:Date.now()}]}}))")
    pg.reload();pg.goto(BASE+"#notes");pg.wait_for_timeout(250)
    check(pg.locator('.n-box[data-a=putting]').input_value()=="Eyes over the ball","boxes cleared by the old Update get their last update back")

    # ---- spellcheck off in the Notes boxes ----
    pg.goto(BASE+"#notes");pg.wait_for_timeout(200)
    check(pg.locator(".n-box").first.get_attribute("spellcheck")=="false","Notes boxes leave spelling to the keyboard")
    # ---- dark mode look at the new screens ----
    pg.emulate_media(color_scheme="dark");pg.goto(BASE+f"#practice/sum/{run1}");pg.wait_for_timeout(200)
    pg.screenshot(path=f"{OUT}/n6-dark-summary.png",full_page=True)
    b.close()
check(not errors,"no script errors "+"; ".join(errors))
sys.exit(1 if fails else 0)
