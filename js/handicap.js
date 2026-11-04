/* Handicap Index estimate, following the World Handicap System (2024 rules) for 18-hole scores.
   - Score differential = 113 / Slope x (Adjusted gross score - Course rating - PCC), to one decimal.
   - Adjusted gross score caps each hole at net double bogey (par + 2 + strokes received);
     before an index exists the cap is par + 5.
   - Index = average of the lowest differentials among the most recent 20 (table below), to one decimal, max 54.0.
   - Exceptional score reduction, soft cap and hard cap are applied.
   GHIN is the official number; this tracks it closely when the same scores are in both. */
const Handicap=(()=>{
  const r1=x=>Math.round(x*10+1e-9)/10;
  /* scores in record -> [how many lowest to average, adjustment] */
  const TABLE={3:[1,-2],4:[1,-1],5:[1,0],6:[2,-1],7:[2,0],8:[2,0],9:[3,0],10:[3,0],11:[3,0],12:[4,0],13:[4,0],14:[4,0],
    15:[5,0],16:[5,0],17:[6,0],18:[6,0],19:[7,0],20:[8,0]};
  function indexFrom(diffs){
    const n=Math.min(diffs.length,20);if(n<3)return null;
    const [k,adj]=TABLE[n];
    const best=diffs.slice(-20).sort((a,b)=>a-b).slice(0,k);
    return Math.min(54,r1(best.reduce((s,x)=>s+x,0)/k+adj));
  }
  const used=n=>n<3?0:TABLE[Math.min(n,20)][0];
  const courseHandicap=(idx,slope,rating,par)=>Math.round(idx*slope/113+(rating-par));
  function strokesOn(ch,si){
    if(ch>=0)return Math.floor(ch/18)+(si<=ch%18?1:0);
    const n=-ch;return -(Math.floor(n/18)+(si>18-n%18?1:0)); /* plus handicaps give strokes back from index 18 down */
  }
  function adjustedGross(scores,pars,sis,ch){
    return scores.reduce((t,s,i)=>t+Math.min(s,ch==null?pars[i]+5:pars[i]+2+strokesOn(ch,sis[i])),0);
  }
  const differential=(ags,rating,slope,pcc)=>r1(113/slope*(ags-rating-(pcc||0)));
  function shiftDate(isoDate,days){const [y,m,d]=isoDate.split("-").map(Number);const t=new Date(y,m-1,d+days);
    return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}

  /* entries: {key,date,order, diff} for past GHIN scores, or {key,date,order, scores,pars,sis,rating,slope,pcc} for rounds */
  function compute(entries){
    const list=[...entries].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.order||0)-(b.order||0));
    const rec=[],history=[],per={};let idx=null;
    for(const e of list){
      const before=idx;let diff,ags=null,ch=null;
      if(e.diff!=null)diff=+e.diff;
      else{
        const par=e.pars.reduce((a,b)=>a+b,0);
        ch=before==null?null:courseHandicap(before,e.slope,e.rating,par);
        ags=adjustedGross(e.scores,e.pars,e.sis,ch);
        diff=differential(ags,e.rating,e.slope,e.pcc);
      }
      rec.push({diff,adj:0});
      if(before!=null){const drop=before-diff,esr=drop>=10?-2:drop>=7?-1:0;if(esr)rec.slice(-20).forEach(r=>r.adj+=esr)}
      let ni=indexFrom(rec.slice(-20).map(r=>r.diff+r.adj));
      if(ni!=null&&rec.length>=20){
        const from=shiftDate(e.date,-365),win=history.filter(h=>h.count>=20&&h.index!=null&&h.date>=from);
        if(win.length){const low=Math.min(...win.map(h=>h.index));
          if(ni-low>3)ni=r1(low+3+(ni-low-3)/2);
          if(ni-low>5)ni=r1(low+5);}
      }
      idx=ni;
      history.push({date:e.date,index:idx,key:e.key,count:rec.length});
      per[e.key]={diff,ags,ch,indexBefore:before,indexAfter:idx};
    }
    return {index:idx,count:rec.length,used:used(rec.length),history,per};
  }
  return {compute,courseHandicap,strokesOn,adjustedGross,differential,indexFrom};
})();
if(typeof module!=="undefined")module.exports=Handicap;
