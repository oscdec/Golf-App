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
    # The alarm is baked into a playing audio clip (so it rings with the screen locked). Keep each clip made and track play/pause.
    pg.add_init_script("""window.__clips=[];const cu=URL.createObjectURL;URL.createObjectURL=function(b){const u=cu.call(this,b);if(b&&b.type==="audio/wav")window.__clips.push(b);return u};
      window.__plays=0;window.__paused=0;const pl=HTMLMediaElement.prototype.play,pa=HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.play=function(){window.__plays++;return pl.call(this)};HTMLMediaElement.prototype.pause=function(){window.__paused++;return pa.call(this)};
      /* first sample louder than the hum, in seconds, and the loudness 1 s and 25 s after it */
      window.__chime=async()=>{const b=window.__clips[window.__clips.length-1];const a=new Int16Array((await b.arrayBuffer()).slice(44));const SR=8000;
        let i=a.findIndex(v=>Math.abs(v)>600);if(i<0)return {at:null,len:a.length/SR};
        const pk=(s,n)=>{let m=0;for(let k=s;k<s+n&&k<a.length;k++)m=Math.max(m,Math.abs(a[k]));return m};
        return {at:i/SR,len:a.length/SR,early:pk(i,SR),late:pk(i+25*SR,SR)}};""")
    pg.goto(BASE+"#practice");J(pg,"localStorage.clear()");pg.reload();pg.wait_for_timeout(300)
    pg.goto(BASE+"#practice/s/techchip");pg.wait_for_timeout(150);pg.click("[data-act=startone]");pg.wait_for_timeout(200)
    pg.click('[data-act=ci][data-q=fun][data-v=yes]');pg.click('[data-act=ci][data-q=life][data-v=no]');pg.click('[data-act=ci][data-q=hq][data-v="8"]');pg.click("[data-act=cistart]")
    pg.wait_for_timeout(1500)
    ch=J(pg,"window.__chime()")
    check(J(pg,"window.__plays")>=1 and ch["at"] is not None and 296<=ch["at"]<=301,f"lock-screen clip playing, alarm baked in at the end of the 5-min warm-up ({ch})")
    check(ch["early"]<ch["late"],"alarm rises from quiet to full volume")
    md=J(pg,"({t:navigator.mediaSession.metadata.title,a:navigator.mediaSession.metadata.artist,s:navigator.mediaSession.playbackState})")
    check(md["t"].startswith("Warm-Up · 4:5") and "Technical Chipping" in md["a"] and "Practiced 0:0" in md["a"] and md["s"]=="playing",f"lock screen shows section, block and practiced ({md})")
    check(pg.locator("#alarmBar").count()==0,"no bar before time is up")
    check(pg.locator("[data-act=altoggle]").text_content()=="Alarm On","alarm toggle shows on")
    # jump the warm-up (5 min) to 2 s from the end
    J(pg,"(()=>{const r=JSON.parse(localStorage.getItem('rg.run'));r.since-=(5*60-2)*1000;localStorage.setItem('rg.run',JSON.stringify(r))})()")
    pg.reload();pg.wait_for_timeout(3500)
    check(pg.locator("#alarmBar").count()==1 and "Warm-Up" in pg.locator("#alarmBar").text_content(),"Time's Up bar when the section ends")
    check("Next: Random Shots" in pg.locator("#alarmBar").text_content(),"bar offers the next section")
    pg.screenshot(path=f"{OUT}/t5-alarm.png",full_page=False)
    check(J(pg,"navigator.mediaSession.metadata.title")=="Time's Up · Warm-Up","lock screen says Time's Up")
    pg.click('#alarmBar [data-al=stop]');pg.wait_for_timeout(1200)
    check(J(pg,"window.__chime()")["at"] is None,"Stop Sound swaps in a clip with no alarm (the hum keeps the lock screen)")
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
    n=J(pg,"window.__paused");pg.click("[data-act=pause]");pg.wait_for_timeout(1300)
    check(pg.locator("#alarmBar").count()==0 and J(pg,"window.__paused")>n,"pausing stops the alarm and the sound")
    check(J(pg,"navigator.mediaSession.metadata.title").startswith("Paused"),"lock screen shows paused")
    # a long block with no routine: the first clip is a 5-minute piece of hum, no alarm yet
    pg.click("[data-act=pause]");pg.wait_for_timeout(200)
    pg.click("[data-act=discardrun]");pg.wait_for_timeout(300)
    check(J(pg,"navigator.mediaSession.playbackState")=="none","discarding clears the lock screen")
    pg.goto(BASE+"#practice/s/puttgame");pg.wait_for_timeout(150);pg.click("[data-act=startone]");pg.wait_for_timeout(200)
    check(pg.locator("[data-act=cistart]").count()==1,"a discarded session's check-in doesn't count, so the next one asks")
    pg.click('[data-act=ci][data-q=fun][data-v=yes]');pg.click('[data-act=ci][data-q=life][data-v=no]');pg.click('[data-act=ci][data-q=hq][data-v="8"]');pg.click("[data-act=cistart]");pg.wait_for_timeout(1500)
    ch=J(pg,"window.__chime()")
    check(ch["at"] is None and 299<=ch["len"]<=301,f"30-min game block: hum in 5-minute pieces until the alarm is near ({ch})")
    check(J(pg,"navigator.mediaSession.metadata.title").startswith("Putting Game · 29:5"),"game block shows its own time on the lock screen")
    b.close()
check(not errors,"no script errors "+"; ".join(errors))
sys.exit(1 if fails else 0)
