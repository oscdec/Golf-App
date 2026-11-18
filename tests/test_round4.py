import os,sys
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
BASE="http://localhost:8765/index.html";OUT=os.path.dirname(os.path.abspath(__file__))
errors=[];fails=[]
def check(c,m):
    print(("PASS " if c else "FAIL ")+m)
    if not c: fails.append(m)
J=lambda pg,e:pg.evaluate(e)
with sync_playwright() as p:
    b=p.chromium.launch();ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,service_workers="block")
    pg=ctx.new_page();pg.on("pageerror",lambda e:errors.append(str(e)))
    pg.on("console",lambda m:m.type=="error" and "fonts.g" not in m.text and "ERR_" not in m.text and errors.append(m.text))
    pg.on("dialog",lambda d:d.accept())
    pg.goto(BASE+"#practice");J(pg,"localStorage.clear()")
    # opens on Practice even from another tab's address
    pg.goto("about:blank");pg.goto(BASE+"#rounds");pg.wait_for_timeout(300)
    check(pg.url.endswith("#practice") and not pg.locator("#v-practice").is_hidden(),f"fresh open lands on Practice ({pg.url[-12:]})")
    # weekly total between Practice and This Week; no minutes in the plan header
    order=J(pg,"[...document.querySelectorAll('#practiceRoot > *')].slice(0,3).map(e=>e.className||e.tagName)")
    check("s-total" in order[1],f"weekly total right under the Practice heading {order}")
    check(pg.locator(".s-tbig").text_content()=="0 min" and "practiced" not in pg.locator(".s-weekhd").text_content(),"total shows; minutes removed from the plan header")
    # colors: blue accent, amber done
    accent=J(pg,"getComputedStyle(document.documentElement).getPropertyValue('--back').trim()")
    check(accent=="#255f9e",f"blue accent {accent}")
    # start Tuesday: check-in first, clock waits
    pg.click('[data-act=startday][data-slot=tue]');pg.wait_for_timeout(300)
    check(pg.locator("#practiceRoot h1").text_content()=="Before You Start","start check-in shown")
    check(pg.locator("[data-act=cistart]").is_disabled(),"Start Practice disabled until answered")
    qs=pg.locator(".s-ciq").all_text_contents()
    check(qs==["Are You Having Fun?","Is Golf Getting In The Way Of Real Life?","What's Your Happiness Quotient?"],f"three questions {qs}")
    check(pg.locator(".s-hq .r-num").count()==10,"happiness 1–10")
    pg.wait_for_timeout(1200);check(J(pg,"JSON.parse(localStorage.getItem('rg.run')).since")is None,"clock not started during check-in")
    pg.click('[data-act=ci][data-q=fun][data-v=yes]');pg.click('[data-act=ci][data-q=life][data-v=no]');pg.click('[data-act=ci][data-q=hq][data-v="7"]')
    pg.screenshot(path=f"{OUT}/t4-checkin.png",full_page=True)
    pg.click("[data-act=cistart]");pg.wait_for_timeout(1300)
    check(pg.locator("[data-act=pickr]").count()==2,"session opens after check-in")
    # Face Control: technique items, graded tempo shots
    pg.click('[data-act=pickr][data-r=face]');pg.wait_for_timeout(100)
    pg.click('[data-act=step][data-v="1"]');pg.wait_for_timeout(80)
    items=pg.locator(".s-items li").all_text_contents()
    check(items==["5× Easy hands, patient at the top","5× Wide in the downswing","10× Split grip drill","10× Center strike"],f"face technique {items}")
    pg.click('[data-act=step][data-v="1"]');pg.wait_for_timeout(80)
    check(pg.locator(".s-stepname").text_content()=="Startline & Tempo","startline & tempo step")
    seq=J(pg,"JSON.parse(localStorage.getItem('rg.run')).blocks[0].seq[2].shots")
    clubs=["PW","9-iron","8-iron","7-iron","6-iron","5-iron","4-iron","5-wood"]
    sp=[x["sp"] for x in seq]
    check(len(seq)==30 and sp[:10]==["33%"]*10 and sp[10:20]==["66%"]*10 and sp[20:]==["100%"]*10,"30 shots: 10 at each speed in order")
    check(all(set(x["club"] for x in seq if x["sp"]==s)==set(clubs) for s in ["33%","66%","100%"]),"every club at least once per speed")
    check(pg.locator(".p-call").text_content().startswith(seq[0]["club"]),"app calls the club")
    pat=[("1","1"),("1","0"),("0","1"),("0","0")]
    for k in range(30):
        l,w=pat[k%4];pg.click(f'[data-act=seqhit][data-l="{l}"][data-w="{w}"]');pg.wait_for_timeout(15)
        if k==2: pg.click("[data-act=sequndo]");pg.wait_for_timeout(15);pg.click(f'[data-act=seqhit][data-l="{l}"][data-w="{w}"]');pg.wait_for_timeout(15)
    check("All 30 shots graded" in pg.content(),"all graded")
    tot=pg.locator(".p-bench tr").last.text_content()
    check("16/30" in tot and "15/30" in tot,f"line and window totals {tot}")
    pg.screenshot(path=f"{OUT}/t4-tempo.png",full_page=True)
    pg.click('[data-act=step][data-v="1"]');pg.wait_for_timeout(80)
    check(pg.locator(".s-stepname").text_content()=="Driver Challenge" and "14 min" in pg.locator(".s-steps").text_content(),"driver challenge 14 min")
    # finish: the end-of-session screen offers today's check-out, then the summary shows the day's check-in
    pg.click("[data-act=next]");pg.wait_for_timeout(250)
    check(pg.locator("#practiceRoot h1").text_content()=="Done For Today?" and pg.locator("[data-act=cilater]").count()==1,"end screen offers check-out or later")
    pg.click('[data-act=ci][data-q=fun][data-v=yes]');pg.click('[data-act=ci][data-q=life][data-v=yes]');pg.click('[data-act=ci][data-q=hq][data-v="9"]')
    pg.click("[data-act=ciend]");pg.wait_for_timeout(250)
    c=pg.content()
    check("Check-In" in c and "Line 16/30" in c,"summary shows check-in and tempo grading")
    ci=J(pg,"JSON.parse(localStorage.getItem('rg.checkins'))")
    check(len(ci)==2 and ci[0]["hq"]==7 and ci[1]["hq"]==9 and ci[1]["life"]=="yes","check-ins saved")
    pg.screenshot(path=f"{OUT}/t4-summary.png",full_page=True)
    pg.click("a.play:has-text('Done')");pg.wait_for_timeout(200)
    bg=J(pg,"getComputedStyle(document.querySelector('.s-sess.done')).backgroundColor")
    check(bg=="rgb(242, 162, 60)",f"done session is amber ({bg})")
    check(pg.locator(".s-tbig").text_content() in ("0 min","1 min"),"weekly total counts the session")
    pg.screenshot(path=f"{OUT}/t4-home.png",full_page=True)
    # center strike: warm-up 5, technique items, performance 6
    pg.goto(BASE+"#practice/s/striking");pg.wait_for_timeout(150)
    c=pg.content()
    check("Warm-Up</b> · 5 min" in c and "10× Wide in the downswing" in c and "at least 6 of 10" in c,"center strike updated")
    # discard during check-in
    pg.click("[data-act=startone]");pg.wait_for_timeout(200);pg.click("[data-act=discardrun]");pg.wait_for_timeout(200)
    check(J(pg,"localStorage.getItem('rg.run')")=="null","discard from check-in")
    # dark mode look
    dk=b.new_context(viewport={"width":390,"height":844},color_scheme="dark",service_workers="block");dp=dk.new_page()
    dp.goto(BASE+"#practice");dp.wait_for_timeout(300);dp.screenshot(path=f"{OUT}/t4-dark.png",full_page=True)
    b.close()
check(not errors,"no script errors "+"; ".join(errors))
sys.exit(1 if fails else 0)
