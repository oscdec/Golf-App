import json, random, datetime, sys
from playwright.sync_api import sync_playwright
import tempfile,os;SP=tempfile.gettempdir()+"/"
random.seed(4)
today=datetime.date.today()
ci=[];plog=[];games=[]
discs=["Full swing","Wedges","Chipping","Putting"]
for i in range(70,-1,-1):
    d=today-datetime.timedelta(days=i)
    if random.random()<0.45: continue
    iso=d.isoformat();run="r"+str(i)
    t=int(datetime.datetime(d.year,d.month,d.day,17,0).timestamp()*1000)
    hb=random.randint(4,9);ha=max(1,min(10,hb+random.choice([-2,-1,0,1,1,2])))
    ci.append({"run":run,"date":iso,"when":"start","fun":random.choice(["yes","yes","no"]),"life":random.choice(["no","no","yes"]),"hq":hb,"at":t})
    if random.random()<0.85: ci.append({"run":run,"date":iso,"when":"end","fun":random.choice(["yes","yes","no"]),"life":random.choice(["no","no","yes"]),"hq":ha,"at":t+3600000})
    dsc=random.choice(discs)
    e={"run":run,"date":iso,"s":"striking","title":"x","disc":dsc,"min":random.randint(20,60),"done":True,"games":[]}
    if random.random()<0.3:
        e["routine"]="center";e["results"]=[{"step":"Strike","rows":[],"total":random.randint(5,15),"of":15,"pass":None},{"step":"Startline","rows":[],"total":random.randint(4,15),"of":15,"pass":None},{"step":"Performance","rows":[],"total":random.randint(3,10),"of":10,"pass":True}]
    elif random.random()<0.3:
        e["routine"]="putt";e["results"]=[{"step":"3' To 8' Putting Spiral","pick":"Farthest Spiral Distance","value":random.randint(3,8),"unit":"ft"}]
    plog.append(e)
    if random.random()<0.4:
        games.append({"id":"g"+str(i),"game":"combine","variant":"combine","setup":{},"log":[],"status":"done","date":iso,"startedAt":t,"finishedAt":t+1000,"result":random.randint(28,40)})
    if random.random()<0.3:
        games.append({"id":"h"+str(i),"game":"chip20","variant":"chip20","setup":{},"log":[],"status":"done","date":iso,"startedAt":t,"finishedAt":t+2000,"result":round(random.uniform(-2,18),1)})
data={"rg.checkins":ci,"rg.practiceLog":plog,"rg.games":games}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for scheme in ["light","dark"]:
        pg=b.new_page(viewport={"width":390,"height":844},color_scheme=scheme,device_scale_factor=1)
        pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.on("console",lambda m:errs.append(m.text) if m.type=="error" else None)
        pg.goto("http://localhost:8765/")
        pg.evaluate("d=>{localStorage.clear();for(const k in d)localStorage.setItem(k,JSON.stringify(d[k]))}",data)
        pg.goto("http://localhost:8765/#insights");pg.reload();pg.goto("http://localhost:8765/#insights");pg.wait_for_timeout(400)
        assert pg.locator("#insightsRoot [data-view=course]").count()==1
        pg.click("#insightsRoot [data-view=practice]");pg.wait_for_timeout(300)
        assert pg.locator("#iCI svg").count()==1, "ci chart"
        assert pg.locator("#iTime svg").count()==1
        assert pg.locator("#iGame svg").count()==1
        assert pg.locator("#iRoutine svg").count()==1 or pg.locator("#iRoutineFt svg").count()==1
        box=pg.locator("#iCI svg").bounding_box()
        pg.mouse.move(box["x"]+box["width"]*0.7,box["y"]+80);pg.wait_for_timeout(100)
        print(scheme,"tip:",pg.locator("#iCI .i-tip").text_content())
        pg.screenshot(path=SP+f"ins_{scheme}.png",full_page=True)
        pg.click("[data-gpick=chip20]");pg.wait_for_timeout(200)
        pg.click("[data-rpick=putt]");pg.wait_for_timeout(200)
        assert pg.locator("#iRoutineFt svg").count()==1
        pg.locator("#insightsRoot section").nth(2).screenshot(path=SP+f"ins_games_{scheme}.png")
        # persisted view
        pg.reload();pg.goto("http://localhost:8765/#insights");pg.wait_for_timeout(300)
        assert pg.locator("#iCI").count()==1,"view persisted"
        pg.click("#insightsRoot [data-view=course]");pg.wait_for_timeout(200)
        assert pg.locator("#iCI").count()==0
        pg.close()
    # empty state
    pg=b.new_page(viewport={"width":390,"height":844})
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto("http://localhost:8765/");pg.evaluate("localStorage.clear();localStorage.setItem('rg.insightsView',JSON.stringify('practice'))")
    pg.goto("http://localhost:8765/#insights");pg.reload();pg.goto("http://localhost:8765/#insights");pg.wait_for_timeout(300)
    print(pg.locator("#insightsRoot").text_content()[:400])
    b.close()
print("errors:",errs)
