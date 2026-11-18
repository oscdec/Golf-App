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
    b=p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]);pg=b.new_page(viewport={"width":390,"height":844})
    pg.on("pageerror",lambda e:errors.append(str(e)));pg.on("dialog",lambda d:d.accept())
    # count oscillators started, to prove sound is scheduled
    pg.add_init_script("""window.__osc=0;const C=window.AudioContext;const o=C.prototype.createOscillator;C.prototype.createOscillator=function(){window.__osc++;return o.call(this)};
      window.__ramp=[];const g=AudioParam.prototype.exponentialRampToValueAtTime;AudioParam.prototype.exponentialRampToValueAtTime=function(v,t){if(v===1)window.__ramp.push(v);return g.call(this,v,t)}""")
    pg.goto(BASE+"#practice");J(pg,"localStorage.clear()");pg.reload();pg.wait_for_timeout(300)
    pg.goto(BASE+"#practice/s/techchip");pg.wait_for_timeout(150);pg.click("[data-act=startone]");pg.wait_for_timeout(200)
    pg.click('[data-act=ci][data-q=fun][data-v=yes]');pg.click('[data-act=ci][data-q=life][data-v=no]');pg.click('[data-act=ci][data-q=hq][data-v="8"]');pg.click("[data-act=cistart]")
    pg.wait_for_timeout(1500)
    check(J(pg,"window.__osc")>100 and len(J(pg,"window.__ramp"))>=1,"alarm scheduled with a rising ramp to full volume")
    check(pg.locator("#alarmBar").count()==0,"no bar before time is up")
    check(pg.locator("[data-act=altoggle]").text_content()=="Alarm On","alarm toggle shows on")
    # jump the warm-up (5 min) to 2 s from the end
    J(pg,"(()=>{const r=JSON.parse(localStorage.getItem('rg.run'));r.since-=(5*60-2)*1000;localStorage.setItem('rg.run',JSON.stringify(r))})()")
    pg.reload();pg.wait_for_timeout(3500)
    check(pg.locator("#alarmBar").count()==1 and "Warm-Up" in pg.locator("#alarmBar").text_content(),"Time's Up bar when the section ends")
    check("Next: Random Shots" in pg.locator("#alarmBar").text_content(),"bar offers the next section")
    pg.screenshot(path=f"{OUT}/t5-alarm.png",full_page=False)
    pg.click('#alarmBar [data-al=stop]');pg.wait_for_timeout(1200)
    check(pg.locator("#alarmBar").count()==0 and pg.locator(".s-stepname").text_content()=="Warm-Up","Stop Sound silences and stays on the section")
    # over again on next section: jump random shots to its end, use Next from the bar
    pg.click('[data-act=step][data-v="1"]');pg.wait_for_timeout(200)
    J(pg,"(()=>{const r=JSON.parse(localStorage.getItem('rg.run'));const b=r.blocks[0];b.stAt-= (17*60+1)*1000;localStorage.setItem('rg.run',JSON.stringify(r))})()")
    pg.reload();pg.wait_for_timeout(1500)
    check(pg.locator("#alarmBar").count()==1 and "Random Shots" in pg.locator("#alarmBar").text_content(),"alarm for the second section")
    pg.click('#alarmBar [data-al=next]');pg.wait_for_timeout(300)
    check(pg.locator(".s-stepname").text_content()=="Sand, Green, Rough, Green" and pg.locator("#alarmBar").count()==0,"Next moves on and stops the sound")
    # alarm visible on another tab too
    J(pg,"(()=>{const r=JSON.parse(localStorage.getItem('rg.run'));const b=r.blocks[0];b.stAt-=(8*60+1)*1000;localStorage.setItem('rg.run',JSON.stringify(r))})()")
    pg.goto(BASE+"#practice/run");pg.reload();pg.wait_for_timeout(300);pg.evaluate("location.hash='#notes'");pg.wait_for_timeout(1500)
    check(pg.locator("#alarmBar").count()==1 and "Finish Session" in pg.locator("#alarmBar").text_content(),"bar shows on other tabs; last section offers Finish Session")
    pg.evaluate("location.hash='#practice/run'");pg.wait_for_timeout(300)
    # turning the alarm off removes it
    pg.click("[data-act=altoggle]");pg.wait_for_timeout(1300)
    check(pg.locator("#alarmBar").count()==0 and pg.locator("[data-act=altoggle]").text_content()=="Alarm Off","alarm can be switched off")
    pg.click("[data-act=altoggle]");pg.wait_for_timeout(200)
    # pause stops it
    pg.click("[data-act=pause]");pg.wait_for_timeout(1300)
    check(pg.locator("#alarmBar").count()==0,"pausing stops the alarm")
    b.close()
check(not errors,"no script errors "+"; ".join(errors))
sys.exit(1 if fails else 0)
