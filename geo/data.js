/* ============================================================
   Lune Geolocation Analytics — synthetic data layer
   Deterministic (seeded) so the leaderboard is stable on reload.
   ============================================================ */
(function(){
/* --- seeded RNG (mulberry32) --- */
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* --- 30 distinct annotation colors (designed categorical palette) --- */
const CURATED_COLORS=[
 "#E23B3B","#F4663B","#F58F1E","#E0A21E","#B59A12","#8BB91F","#4CAF50","#1FA97A",
 "#15A0A0","#1EB5C9","#2A8FE0","#2F6BE0","#4254C5","#6A4DD1","#8E44E0","#B23CD1",
 "#D43DAE","#E83C82","#EC5A6F","#B5651D","#8C6239","#5E7A86","#7A8B2B","#3D8361",
 "#2D6A8E","#6D5BD0","#C77DBB","#D98A2B","#4B9B6E","#9A4C95"
];
function hslToHex(h,s,l){
  s/=100;l/=100;const k=n=>(n+h/30)%12;const a=s*Math.min(l,1-l);
  const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  const t=x=>Math.round(255*x).toString(16).padStart(2,'0');
  return"#"+t(f(0))+t(f(8))+t(f(4));
}
function buildPalette(n){
  const out=CURATED_COLORS.slice();
  let i=0;
  while(out.length<n){
    const h=(i*137.508+23)%360, s=54+(i%3)*8, l=44+(i%2)*7;
    out.push(hslToHex(h,s,l)); i++;
  }
  return out;
}

/* --- consumer, card-present brands across spending categories ---
   4th value = "ubiquity": physical outlets per unit of city weight. */
const CATEGORY_ORDER=["Shopping","Dining","Services","Groceries","Travel","Wellness","Entertainment","Transportation","Savings & Investments"];
const BRAND_DEFS=[
 // Shopping
 ["Nike","Shopping","NK",0.9],["Adidas","Shopping","AD",0.85],["Zara","Shopping","ZA",0.9],
 ["H&M","Shopping","HM",0.95],["Uniqlo","Shopping","UQ",0.65],["Gap","Shopping","GP",0.6],
 ["Levi's","Shopping","LV",0.65],["Mango","Shopping","MN",0.6],["Marks & Spencer","Shopping","MS",0.65],
 ["Foot Locker","Shopping","FL",0.65],["Lacoste","Shopping","LC",0.5],["Tommy Hilfiger","Shopping","TM",0.5],
 ["Calvin Klein","Shopping","CK",0.45],["Gucci","Shopping","GU",0.25],["Louis Vuitton","Shopping","LU",0.24],
 ["Apple Store","Shopping","AP",0.4],["Samsung","Shopping","SM",0.6],["Sharaf DG","Shopping","SD",0.5],
 ["Noon","Shopping","NO",0.4],["Decathlon","Shopping","DC",0.5],["Centrepoint","Shopping","CP",0.6],
 ["Max Fashion","Shopping","MX",0.7],["Splash","Shopping","SL",0.6],["IKEA","Shopping","IK",0.3],
 ["Home Centre","Shopping","HO",0.6],["Pottery Barn","Shopping","PB",0.28],["Ace Hardware","Shopping","AH",0.5],
 // Dining
 ["Starbucks","Dining","SB",3.6],["McDonald's","Dining","MC",3.0],["KFC","Dining","KF",2.2],
 ["Subway","Dining","SW",2.4],["Burger King","Dining","BK",1.9],["Costa Coffee","Dining","CO",1.9],
 ["Tim Hortons","Dining","TH",1.5],["Dunkin'","Dining","DK",1.6],["Pizza Hut","Dining","PH",1.4],
 ["Domino's","Dining","DM",1.5],["Shake Shack","Dining","SS",0.8],["Five Guys","Dining","FG",0.6],
 ["Pret A Manger","Dining","PR",0.7],["Nando's","Dining","ND",0.8],["Baskin Robbins","Dining","BR",1.1],
 ["Krispy Kreme","Dining","KK",0.7],["Texas Roadhouse","Dining","TR",0.45],["Wagamama","Dining","WG",0.5],
 // Services
 ["Etisalat","Services","ET",0.7],["du","Services","DU",0.6],["DEWA","Services","DW",0.3],
 ["Emirates Post","Services","EP",0.4],["Salik","Services","SK",0.2],
 // Groceries
 ["Carrefour","Groceries","CF",1.3],["Lulu Hypermarket","Groceries","LH",1.0],["Spinneys","Groceries","SN",0.7],
 ["Waitrose","Groceries","WR",0.55],["Tesco","Groceries","TS",1.1],["Whole Foods","Groceries","WF",0.45],
 ["Choithrams","Groceries","CT",0.7],["Union Coop","Groceries","UC",0.6],
 // Travel
 ["Emirates","Travel","EM",0.18],["Etihad","Travel","EH",0.14],["Qatar Airways","Travel","QA",0.13],
 ["flydubai","Travel","FD",0.16],["Booking.com","Travel","BC",0.12],["Airbnb","Travel","AB",0.12],
 ["Expedia","Travel","EX",0.1],["Marriott","Travel","MR",0.3],["Hilton","Travel","HL",0.3],["Accor","Travel","AR",0.28],
 // Wellness
 ["Sephora","Wellness","SE",0.7],["Lush","Wellness","LS",0.45],["The Body Shop","Wellness","BS",0.55],
 ["MAC","Wellness","MA",0.55],["Bath & Body Works","Wellness","BB",0.65],["Boots","Wellness","BO",0.8],
 ["Watsons","Wellness","WT",0.9],["GNC","Wellness","GN",0.6],["Fitness First","Wellness","FF",0.45],
 ["Life Pharmacy","Wellness","LP",0.8],["Aster Pharmacy","Wellness","AS",0.9],
 // Entertainment
 ["VOX Cinemas","Entertainment","VX",0.5],["Reel Cinemas","Entertainment","RC",0.35],["Virgin Megastore","Entertainment","VM",0.35],
 ["PlayStation","Entertainment","PS",0.18],["Ticketmaster","Entertainment","TK",0.14],["IMG Worlds","Entertainment","IM",0.06],
 // Transportation
 ["Uber","Transportation","UB",0.7],["Careem","Transportation","CR",0.7],["ENOC","Transportation","EN",0.7],
 ["ADNOC","Transportation","AN",0.7],["Emarat","Transportation","ER",0.5],["Hertz","Transportation","HZ",0.3],["Avis","Transportation","AV",0.3],
 // Savings & Investments
 ["Emirates NBD","Savings & Investments","NB",0.5],["FAB","Savings & Investments","FB",0.5],["ADCB","Savings & Investments","AC",0.45],
 ["Mashreq","Savings & Investments","MQ",0.45],["Sarwa","Savings & Investments","SA",0.12],["Wio","Savings & Investments","WO",0.2],["eToro","Savings & Investments","EO",0.1]
];

const BRAND_COLORS=buildPalette(BRAND_DEFS.length);
const BRANDS=BRAND_DEFS.map((b,i)=>({
  id:i, name:b[0], category:b[1], abbr:b[2], color:BRAND_COLORS[i], ubiquity:b[3]
}));

const CATEGORIES=CATEGORY_ORDER.filter(c=>BRANDS.some(b=>b.category===c));

/* --- world cities: [name, country(matches world-atlas names), lat, lng, weight] --- */
const CITIES=[
 ["Dubai","United Arab Emirates",25.20,55.27,9],
 ["Abu Dhabi","United Arab Emirates",24.45,54.37,6],
 ["Sharjah","United Arab Emirates",25.35,55.40,3],
 ["Riyadh","Saudi Arabia",24.71,46.68,5],
 ["Jeddah","Saudi Arabia",21.49,39.19,3],
 ["Doha","Qatar",25.29,51.53,3],
 ["Kuwait City","Kuwait",29.38,47.99,2],
 ["Cairo","Egypt",30.04,31.24,4],
 ["Istanbul","Turkey",41.01,28.98,4],
 ["London","United Kingdom",51.51,-0.13,8],
 ["Manchester","United Kingdom",53.48,-2.24,2],
 ["Paris","France",48.86,2.35,6],
 ["Berlin","Germany",52.52,13.40,4],
 ["Munich","Germany",48.14,11.58,2],
 ["Madrid","Spain",40.42,-3.70,3],
 ["Barcelona","Spain",41.39,2.17,3],
 ["Milan","Italy",45.46,9.19,3],
 ["Rome","Italy",41.90,12.50,2],
 ["Amsterdam","Netherlands",52.37,4.90,3],
 ["Zurich","Switzerland",47.38,8.54,2],
 ["Stockholm","Sweden",59.33,18.06,2],
 ["New York","United States of America",40.71,-74.01,9],
 ["Los Angeles","United States of America",34.05,-118.24,6],
 ["Chicago","United States of America",41.88,-87.63,4],
 ["Miami","United States of America",25.76,-80.19,3],
 ["San Francisco","United States of America",37.77,-122.42,4],
 ["Toronto","Canada",43.65,-79.38,4],
 ["Mexico City","Mexico",19.43,-99.13,3],
 ["Sao Paulo","Brazil",-23.55,-46.63,3],
 ["Buenos Aires","Argentina",-34.60,-58.38,2],
 ["Mumbai","India",19.08,72.88,5],
 ["Delhi","India",28.61,77.21,4],
 ["Singapore","Singapore",1.35,103.82,5],
 ["Bangkok","Thailand",13.76,100.50,3],
 ["Jakarta","Indonesia",-6.21,106.85,3],
 ["Tokyo","Japan",35.68,139.69,7],
 ["Shanghai","China",31.23,121.47,6],
 ["Hong Kong","China",22.32,114.17,4],
 ["Seoul","South Korea",37.57,126.98,4],
 ["Sydney","Australia",-33.87,151.21,4],
 ["Melbourne","Australia",-37.81,144.96,3],
 ["Johannesburg","South Africa",-26.20,28.05,2],
 ["Moscow","Russia",55.76,37.62,3]
];

const SEGMENTS=["Mass market","Affluent","High-net-worth","New to bank","Youth (18-25)"];
const TXN_TYPES=["Card present","Online","Contactless","Recurring"];
const AGE_BANDS=["18-24","25-34","35-44","45-54","55+"];

const STREETS=["Mall of the Emirates","City Centre","Marina Walk","Downtown Blvd","Grand Plaza",
 "Festival Avenue","High Street","Central Station","Riverside Quay","The Galleria",
 "Boulevard One","Souk District","Airport Terminal 3","Waterfront","Park Lane",
 "Business Bay","Sunset Mall","Harbour View","Old Town Square","Tech Park",
 "Garden City","Crescent Mall","Metro Plaza","Lakeside","Uptown Court",
 "Pearl Quarter","Vista Heights","The Promenade","Civic Centre","Bayside Walk"];

/* --- generate outlets: many per (brand, city), scaled by ubiquity & weight --- */
function buildShops(){
  const r=rng(20260609);
  const shops=[];
  let id=0;
  const DENSITY=0.55;
  CITIES.forEach((c)=>{
    const[city,country,lat,lng,weight]=c;
    const prefix=city.replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase();
    let cityNum=0;
    BRANDS.forEach(brand=>{
      let count=Math.round(brand.ubiquity*weight*DENSITY*(0.85+r()*0.30));
      count=Math.min(count,60);
      for(let k=0;k<count;k++){
        cityNum++;
        const jlat=lat+(r()-0.5)*0.55;
        const jlng=lng+(r()-0.5)*0.75;
        const base=weight*(0.5+r()*1.7);
        const txns=Math.round((180+r()*1500)*base/5)+40;
        const avg=Math.round(40+r()*330);
        const spend=txns*avg;
        const customers=Math.round(txns*(0.30+r()*0.30));
        const male=Math.round(38+r()*30);
        let ageRaw=AGE_BANDS.map(()=>0.4+r());
        const aSum=ageRaw.reduce((a,b)=>a+b,0);
        const age=ageRaw.map(v=>Math.round(v/aSum*100));
        const area=STREETS[Math.floor(r()*STREETS.length)];
        const code=prefix+"-"+String(cityNum).padStart(3,'0');
        shops.push({
          id:id++, brandId:brand.id, brand:brand.name, color:brand.color,
          category:brand.category, abbr:brand.abbr,
          city, country, lat:jlat, lng:jlng,
          area, code, addr:area+", "+city,
          spend, txns, customers, avgTicket:avg,
          male, female:100-male, age,
          segment:SEGMENTS[Math.floor(r()*SEGMENTS.length)],
          onlineShare:Math.round(20+r()*55),
          trend:Array.from({length:6},()=>Math.round(40+r()*60)),
          delta:Math.round((r()*2-0.6)*100)/10,
          txnType:TXN_TYPES[Math.floor(r()*TXN_TYPES.length)]
        });
      }
    });
  });
  return shops;
}

const SHOPS=buildShops();

/* --- formatting helpers --- */
function fmtAED(v){
  if(v>=1e9)return"AED "+(v/1e9).toFixed(2)+"B";
  if(v>=1e6)return"AED "+(v/1e6).toFixed(2)+"M";
  if(v>=1e3)return"AED "+(v/1e3).toFixed(1)+"K";
  return"AED "+Math.round(v);
}
function fmtNum(v){
  if(v>=1e6)return(v/1e6).toFixed(2)+"M";
  if(v>=1e3)return(v/1e3).toFixed(1)+"K";
  return""+Math.round(v);
}
const METRICS={
  spend:{key:"spend",label:"Total spend",short:"Spend",fmt:fmtAED,unit:"AED"},
  txns:{key:"txns",label:"Transactions",short:"Txns",fmt:fmtNum,unit:"txns"},
  customers:{key:"customers",label:"Customers",short:"Customers",fmt:fmtNum,unit:"customers"},
  avgTicket:{key:"avgTicket",label:"Avg ticket",short:"Avg ticket",fmt:fmtAED,unit:"AED",agg:"avg"}
};

window.GEO={BRANDS,CATEGORIES,CITIES,SEGMENTS,TXN_TYPES,AGE_BANDS,SHOPS,METRICS,fmtAED,fmtNum,BRAND_COLORS};
})();
