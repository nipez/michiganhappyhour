/* Michigan Happy Hour homepage app — source: src/homepage.jsx (built via npm run build:home) */
const {useState,useMemo,useEffect,useCallback,useRef}=React;

const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TI=new Date().getDay();
const TODAY=DAYS[TI];

const REGIONS=[
  {id:"all",name:"All Regions",emoji:"🗺️",img:"img/cheers-cocktails.jpg"},
  {id:"traverse-city",name:"Traverse City",emoji:"🏙️",img:"img/nightlife.jpg"},
  {id:"leelanau",name:"Leelanau Peninsula",emoji:"🍇",img:"img/wine-cheese.jpg"},
  {id:"old-mission",name:"Old Mission Peninsula",emoji:"🍷",img:"img/daytime-cheers.jpg"},
  {id:"elk-rapids",name:"Elk Rapids & Torch Lake",emoji:"🌊",img:"img/old-fashioned.jpg"},
  {id:"frankfort-benzie",name:"Frankfort & Benzie County",emoji:"⛵",img:"img/tropical-drinks.jpg"},
  {id:"charlevoix-petoskey",name:"Charlevoix & Petoskey",emoji:"🪨",img:"img/charcuterie.jpg"},
  {id:"mackinaw",name:"Mackinaw City & Mackinac Island",emoji:"🌉",img:"img/chalkboard.jpg"},
  {id:"bellaire-mancelona",name:"Bellaire & Antrim County",emoji:"🏔️",img:"img/friends-wine.jpg"},
  {id:"grand-rapids",name:"Grand Rapids",emoji:"🍺",img:"img/cheers-cocktails.jpg"},
  {id:"ann-arbor",name:"Ann Arbor",emoji:"🎓",img:"img/tropical-drinks.jpg"},
  {id:"detroit",name:"Detroit",emoji:"🏭",img:"img/hero.jpg"},
  {id:"kalamazoo",name:"Kalamazoo",emoji:"🍻",img:"img/friends-wine.jpg"},
  {id:"lansing",name:"Lansing & East Lansing",emoji:"🏛️",img:"img/daytime-cheers.jpg"},
  {id:"holland",name:"Holland",emoji:"🌷",img:"img/tropical-drinks.jpg"},
  {id:"muskegon",name:"Muskegon",emoji:"⚓",img:"img/old-fashioned.jpg"},
  {id:"marquette",name:"Marquette (UP)",emoji:"🏔️",img:"img/charcuterie.jpg"},
  {id:"tri-cities",name:"Saginaw / Bay City / Midland",emoji:"🏙️",img:"img/wine-cheese.jpg"},
  {id:"flint",name:"Flint",emoji:"🔧",img:"img/friends-wine.jpg"},
];

const CATS=["All","Wine Bar","Brewery","Restaurant","Cocktail Bar","Taproom","Distillery","Cidery"];
const catColors={"Wine Bar":"#8B2252","Brewery":"#D4A017","Restaurant":"#2E8B7A","Cocktail Bar":"#2D6A8F","Taproom":"#B87A1A","Distillery":"#5B4A8A","Cidery":"#C25B28"};
function toSlug(name,town){return(name+"-"+town).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
const REGION_CENTERS={
  "traverse-city":{lat:44.7631,lng:-85.6206},
  leelanau:{lat:45.02,lng:-85.75},
  "old-mission":{lat:44.9,lng:-85.52},
  "elk-rapids":{lat:44.9,lng:-85.38},
  "frankfort-benzie":{lat:44.63,lng:-86.15},
  "charlevoix-petoskey":{lat:45.37,lng:-85.05},
  "bellaire-mancelona":{lat:44.98,lng:-85.2},
  mackinaw:{lat:45.78,lng:-84.73},
  "grand-rapids":{lat:42.9634,lng:-85.6681},
  "ann-arbor":{lat:42.2808,lng:-83.743},
  detroit:{lat:42.3314,lng:-83.0458},
  kalamazoo:{lat:42.2917,lng:-85.5872},
  lansing:{lat:42.7325,lng:-84.5555},
  holland:{lat:42.7875,lng:-86.109},
  muskegon:{lat:43.2342,lng:-86.2484},
  marquette:{lat:46.5436,lng:-87.3954},
  "tri-cities":{lat:43.5,lng:-84.0},
  flint:{lat:43.0125,lng:-83.6875}
};
const REGION_IDS=new Set(REGIONS.map(r=>r.id));
function haversineMi(lat1,lng1,lat2,lng2){const R=3959;const dLat=(lat2-lat1)*Math.PI/180;const dLng=(lng2-lng1)*Math.PI/180;const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function nearestRegionId(lat,lng){let best="all",bestD=Infinity;for(const[id,c] of Object.entries(REGION_CENTERS)){const d=haversineMi(lat,lng,c.lat,c.lng);if(d<bestD){bestD=d;best=id;}}return bestD<=45?best:"all";}
function readInitialRegion(){try{const sp=new URLSearchParams(window.location.search);const fromUrl=sp.get("region");if(fromUrl&&REGION_IDS.has(fromUrl))return fromUrl;const saved=localStorage.getItem("hh-region");if(saved&&REGION_IDS.has(saved))return saved;}catch{}return"all";}

const L=[
  {id:1,name:"The Parlor",cat:"Cocktail Bar",reg:"traverse-city",town:"Traverse City",addr:"267 E Front St",hh:{s:"3:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["50% off all drinks","25% off full kitchen menu","All-night happy hour Mondays"],vibe:"Speakeasy-inspired cocktails with lively downtown energy",feat:true,ph:"(231) 944-0100",lat:44.7634,lng:-85.6197,col:["late"]},
  {id:2,name:"7 Monks Taproom",cat:"Taproom",reg:"traverse-city",town:"Traverse City",addr:"128 S Union St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$5 sliders","$4 dirty fries","$2 off craft drafts"],vibe:"Massive tap list and a hidden speakeasy downstairs (Low Bar)",ph:"(231) 421-8410",lat:44.7628,lng:-85.6219},
  {id:3,name:"Sorellina",cat:"Restaurant",reg:"traverse-city",town:"Traverse City",addr:"250 E Front St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["$5 personal pizzas","$5.50 house wines","$6 bruschetta & caprese"],vibe:"Italian comfort food and a cozy date-night starter",ph:"(231) 421-5912",lat:44.7635,lng:-85.6200},
  {id:4,name:"Mama Lu's Taco Shop",cat:"Restaurant",reg:"traverse-city",town:"Traverse City",addr:"234 E Front St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$7 classic margaritas","$5 apps","$4 house wine","$1 off beer"],vibe:"Laid-back taco spot with legendary $2 Taco Tuesdays all day",sp:["$2 Taco Tuesdays"],feat:true,ph:"(231) 252-5023",lat:44.7635,lng:-85.6204},

  {id:6,name:"Right Brain Brewery",cat:"Brewery",reg:"traverse-city",town:"Traverse City",addr:"225 E Sixteenth St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$4.50 pints","$3.75 mug fills (members)","Taco Night specials"],vibe:"Quirky creative brewery with adventurous seasonal brews",ph:"(231) 944-1239",lat:44.7555,lng:-85.6190,col:["late"]},
  {id:7,name:"Rare Bird Brewpub",cat:"Brewery",reg:"traverse-city",town:"Traverse City",addr:"229 Lake Ave",hh:{s:"3:00 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$1 off all pints","Half-off apps","$5 featured cocktail"],vibe:"Neighborhood brewpub with an outstanding patio",ph:"(231) 252-4968",lat:44.7612,lng:-85.6250,col:["patio"]},
  {id:8,name:"North Peak Brewing",cat:"Brewery",reg:"traverse-city",town:"Traverse City",addr:"400 W Front St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all alcohol","$1 off appetizers & pizzas"],vibe:"Craft brews and burgers in a converted candy factory",ph:"(231) 941-7325",lat:44.7640,lng:-85.6270},
  {id:9,name:"Left Foot Charley",cat:"Wine Bar",reg:"traverse-city",town:"Traverse City",addr:"806 Red Dr",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["$5 wine tastings","Cheese plate specials","Half-off select bottles"],vibe:"Natural winemaking in the Village at Grand Traverse Commons",ph:"(231) 995-0500",lat:44.7510,lng:-85.6350},
  {id:10,name:"Firefly",cat:"Restaurant",reg:"traverse-city",town:"Traverse City",addr:"310 Cass St",hh:{s:"4:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$8 craft cocktails","$6 wines","$5 bites menu"],vibe:"Warm neighborhood spot with seasonal New American fare",ph:"(231) 932-1310",lat:44.7622,lng:-85.6228},
  {id:11,name:"Smoke & Porter",cat:"Restaurant",reg:"traverse-city",town:"Traverse City",addr:"830 Cottageview Dr",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off craft beers","Discounted small plates","$5 well drinks"],vibe:"Smoked meats and craft beer in the Village",ph:"(231) 252-4171",lat:44.7505,lng:-85.6345},
  {id:12,name:"TC Whiskey Co.",cat:"Distillery",reg:"traverse-city",town:"Traverse City",addr:"201 E Fourteenth St",hh:{s:"3:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["$6 cocktails","Extended HH til 8 PM on live music nights"],vibe:"Award-winning cherry whiskey straight from the source",ph:"(231) 922-8468",lat:44.7565,lng:-85.6195},
  {id:13,name:"The Little Fleet",cat:"Cocktail Bar",reg:"traverse-city",town:"Traverse City",addr:"448 E Front St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$5 draft beer","$8 margaritas","$8 negronis","$8 wine by the glass","$14 wings + draft beer (Wed–Sun)"],vibe:"Laid-back outdoor food truck court and bar — a downtown TC institution",feat:true,ph:"(231) 943-1116",lat:44.7638,lng:-85.6155,col:["patio"]},
  {id:14,name:"The Filling Station",cat:"Brewery",reg:"traverse-city",town:"Traverse City",addr:"642 Railroad Pl",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off pints","$5 pizza slices","Half-off appetizers"],vibe:"Craft brewery in a converted train depot — killer pizza and house-brewed beers",ph:"(231) 946-8168",lat:44.7605,lng:-85.6248},
  {id:15,name:"The Flying Noodle",cat:"Restaurant",reg:"traverse-city",town:"Traverse City",addr:"245 E Front St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$5 apps","$4 off signature cocktails","$3 off wine","$2 off drafts"],vibe:"Vibrant Asian noodle bar on Front Street — same team as Mama Lu's",ph:"(231) 252-5023",lat:44.7636,lng:-85.6198},
  {id:16,name:"Low Bar",cat:"Cocktail Bar",reg:"traverse-city",town:"Traverse City",addr:"128 S Union St (Below 7 Monks)",hh:{s:"4:00 PM",e:"7:00 PM",d:["Wednesday","Thursday","Friday","Saturday"]},deals:["$8 craft cocktails","Smoked drink specials","$6 featured old fashioned"],vibe:"Hidden speakeasy beneath 7 Monks — dark, moody, and the best cocktails in TC",feat:true,ph:"(231) 421-8410",lat:44.7627,lng:-85.6220},
  {id:17,name:"The Burrow TC",cat:"Restaurant",reg:"traverse-city",town:"Traverse City",addr:"12930 S W Bay Shore Dr",hh:{s:"3:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["$5 wine","$5 cocktails","$4 beer","Rotating small plates"],vibe:"California-inspired American in an airy space — from the Mama Lu's team",ph:"(231) 943-1048",lat:44.7380,lng:-85.6480},
  {id:18,name:"Bubba's",cat:"Restaurant",reg:"traverse-city",town:"Traverse City",addr:"428 E Front St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$2 well drinks (late night 9–close)","$3 craft drafts","$8 burger & beer Tuesdays","Half-off apps"],vibe:"Rowdy burger bar on Front Street — great patio, late-night happy hour too",ph:"(231) 421-8920",lat:44.7639,lng:-85.6150,col:["patio","late"]},
  {id:19,name:"Lil Bo Bar",cat:"Restaurant",reg:"traverse-city",town:"Traverse City",addr:"313 W Grandview Pkwy",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$4 wells","$3 domestics","Half-off chili & po' boys"],vibe:"93-year-old neighborhood bar with award-winning chili and retro patio vibes",ph:"(231) 946-4424",lat:44.7660,lng:-85.6260,col:["patio"]},
  {id:20,name:"The Cove",cat:"Restaurant",reg:"leelanau",town:"Leland",addr:"111 River St",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 local wines","$3 off appetizers","Whitefish dip special"],vibe:"Fishtown waterfront dining — grab a seat on the deck",feat:true,ph:"(231) 256-9834",lat:45.023,lng:-85.7611,col:["patio"]},
  {id:21,name:"Hop Lot Brewing",cat:"Brewery",reg:"leelanau",town:"Suttons Bay",addr:"658 S West Bay Shore Dr",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off pints","$2 off flights","Pretzel & beer cheese $5"],vibe:"Top-tier craft beer with vineyard views and West Bay sunsets",feat:true,ph:"(231) 866-4505",lat:44.9683,lng:-85.6478,col:["patio"]},
  {id:22,name:"9 Bean Rows",cat:"Restaurant",reg:"leelanau",town:"Suttons Bay",addr:"9000 E Duck Lake Rd",hh:{s:"4:30 PM",e:"6:00 PM",d:["Wednesday","Thursday","Friday","Saturday"]},deals:["$7 wine pours","Small plates from $6","Local cheese boards"],vibe:"Farm-to-table gem using Leelanau-sourced everything",ph:"(231) 271-4165",lat:44.996,lng:-85.6747},
  {id:23,name:"Tandem Ciders",cat:"Cidery",reg:"leelanau",town:"Suttons Bay",addr:"2055 N Setterbo Rd",hh:{s:"3:00 PM",e:"5:00 PM",d:["Thursday","Friday","Saturday","Sunday"]},deals:["$2 off cider flights","Seasonal cider specials","Cheese & charcuterie deal"],vibe:"Farmstead cidery tucked into the rolling hills — unbeatable in fall",ph:"(231) 271-0050",lat:45.011,lng:-85.6575},
  {id:24,name:"Fischer's Happy Hour Tavern",cat:"Restaurant",reg:"leelanau",town:"Leland",addr:"N Manitou Trail (M-22)",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$4 wells","$3 domestic drafts","Half-off loaded nachos"],vibe:"No-frills bar near Sleeping Bear Dunes — it's literally in the name",ph:"(231) 334-3922",lat:45.0854,lng:-85.6765},
  {id:25,name:"Black Star Farms",cat:"Wine Bar",reg:"leelanau",town:"Suttons Bay",addr:"10844 E Revold Rd",hh:{s:"4:00 PM",e:"6:00 PM",d:["Thursday","Friday","Saturday"]},deals:["$6 estate wines","Artisan cheese pairings","$4 off bottles to go"],vibe:"Estate winery with gorgeous tasting room and vineyard views",ph:"(231) 944-1251",lat:44.9339,lng:-85.6361,col:["patio"]},
  {id:26,name:"Blu",cat:"Restaurant",reg:"leelanau",town:"Glen Arbor",addr:"5705 S Lake St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["$6 cocktails","$5 wine pours","Flatbread specials"],vibe:"Upscale lakeside dining steps from Sleeping Bear — stunning sunsets",ph:"(231) 334-2530",lat:44.9005,lng:-85.9870,col:["patio"]},
  {id:30,name:"Chateau Chantal",cat:"Wine Bar",reg:"old-mission",town:"Old Mission",addr:"15900 Rue de Vin",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$6 wine by the glass","$5 flatbreads","Half-off charcuterie boards"],vibe:"Vineyard views overlooking West Bay — hard to beat at golden hour",feat:true,ph:"(231) 223-4110",lat:44.9196,lng:-85.502,col:["patio"]},
  {id:31,name:"Jolly Pumpkin at Mission Table",cat:"Brewery",reg:"old-mission",town:"Old Mission",addr:"13512 Peninsula Dr",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off sour ales","$5 flatbreads","Half-off starters"],vibe:"Sour beer specialists with stunning bay views from the patio",ph:"(231) 223-4333",lat:44.8862,lng:-85.5283,col:["patio"]},
  {id:32,name:"Bonobo Winery",cat:"Wine Bar",reg:"old-mission",town:"Old Mission",addr:"12011 Center Rd",hh:{s:"4:00 PM",e:"6:00 PM",d:["Wednesday","Thursday","Friday","Saturday"]},deals:["$5 wine by the glass","Small plate pairings","Sunset specials Fridays"],vibe:"Modern tasting room with a treehouse vibe overlooking the vines",ph:"(231) 282-9463",lat:44.8604,lng:-85.5234},
  {id:33,name:"2 Lads Winery",cat:"Wine Bar",reg:"old-mission",town:"Old Mission",addr:"16985 Smokey Hollow Rd",hh:{s:"4:00 PM",e:"6:00 PM",d:["Friday","Saturday"]},deals:["$5 reserve pours","Cheese board specials","$3 off bottles"],vibe:"Modern minimalist tasting room with panoramic peninsula views",ph:"(231) 223-7722",lat:44.9343,lng:-85.496,col:["patio"]},
  {id:40,name:"Ethanology",cat:"Distillery",reg:"elk-rapids",town:"Elk Rapids",addr:"119 Ames St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Wednesday","Thursday","Friday","Saturday"]},deals:["$7 craft cocktails","$5 spirit tastings","Small bites menu"],vibe:"Grain-to-glass distillery in a charming downtown space",feat:true,ph:"(231) 264-5755",lat:44.8970,lng:-85.4140},
  {id:41,name:"Pearl's New Orleans Kitchen",cat:"Restaurant",reg:"elk-rapids",town:"Elk Rapids",addr:"617 Ames St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$6 hurricanes","$5 gumbo cups","$2 off wine & beer"],vibe:"Cajun soul food on the shores of Elk Lake — a hidden gem",ph:"(231) 264-0530",lat:44.8997,lng:-85.3959},
  {id:42,name:"Short's Torch Lake",cat:"Brewery",reg:"elk-rapids",town:"Alden",addr:"7 Bridge St",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all pints","$5 pub pretzels","Flight specials"],vibe:"Short's satellite taproom right on Torch Lake",ph:"(231) 331-4126",lat:44.8790,lng:-85.2680,col:["patio"]},
  {id:43,name:"Riverwalk Grill",cat:"Restaurant",reg:"elk-rapids",town:"Elk Rapids",addr:"105 Ames St",hh:{s:"3:30 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["$5 house wines","$2 off drafts","Bruschetta specials"],vibe:"Riverside patio dining in the heart of downtown Elk Rapids",ph:"(231) 264-9133",lat:44.8968,lng:-85.4145,col:["patio"]},
  {id:50,name:"Stormcloud Brewing",cat:"Brewery",reg:"frankfort-benzie",town:"Frankfort",addr:"303 Main St",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off pints","$2 off flights","Pretzel & mustard $4"],vibe:"Beloved Belgian-inspired brewery in the heart of downtown Frankfort",feat:true,ph:"(231) 352-0118",lat:44.6345,lng:-86.2310},
  {id:51,name:"The Hotel Frankfort",cat:"Restaurant",reg:"frankfort-benzie",town:"Frankfort",addr:"231 Main St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["$6 cocktails","$5 wine pours","Oyster specials Thursdays"],vibe:"Elevated pub fare in a beautifully restored historic hotel",ph:"(231) 352-4303",lat:44.6340,lng:-86.2315},
  {id:52,name:"Iron Fish Distillery",cat:"Distillery",reg:"frankfort-benzie",town:"Thompsonville",addr:"14234 Dzuibanek Rd",hh:{s:"3:00 PM",e:"5:00 PM",d:["Thursday","Friday","Saturday"]},deals:["$7 signature cocktails","Distillery tour + tasting combo","$5 snacks"],vibe:"Farm distillery on 120 acres — the drive alone is worth it",ph:"(231) 378-3474",lat:44.5270,lng:-85.9470},
  {id:53,name:"Cold Creek Inn",cat:"Restaurant",reg:"frankfort-benzie",town:"Beulah",addr:"491 S Benzie Blvd",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 wells","$4 domestic drafts","Half-off starters"],vibe:"Classic Up North lodge vibes on the shores of Crystal Lake",ph:"(231) 882-4341",lat:44.6310,lng:-86.0910,col:["patio"]},
  {id:60,name:"Beards Brewery",cat:"Brewery",reg:"charlevoix-petoskey",town:"Petoskey",addr:"215 E Lake St",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off pints","$5 pub bites","Monday $3 pints all day"],vibe:"Laid-back downtown Petoskey brewery with a great patio",ph:"(231) 753-2221",lat:45.3745,lng:-84.9555,col:["patio"]},
  {id:61,name:"Palette Bistro",cat:"Restaurant",reg:"charlevoix-petoskey",town:"Petoskey",addr:"321 Bay St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["$7 wines","Half-off small plates","$8 featured cocktail"],vibe:"Farm-to-fork dining in the Gaslight District",ph:"(231) 348-3321",lat:45.3750,lng:-84.9560},
  {id:62,name:"Castle Farms Winery",cat:"Wine Bar",reg:"charlevoix-petoskey",town:"Charlevoix",addr:"5052 M-66 N",hh:{s:"4:00 PM",e:"6:00 PM",d:["Friday","Saturday"]},deals:["$5 tastings","Cheese & wine pairing specials","Live music Fridays"],vibe:"Wine tasting in a stone castle — yes, an actual castle",ph:"(231) 237-0884",lat:45.3410,lng:-85.2100},
  {id:63,name:"Tap 30 Pourhouse",cat:"Taproom",reg:"charlevoix-petoskey",town:"Charlevoix",addr:"307 Bridge St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$2 off all taps","Wing Wednesday $0.75 wings","$5 cocktail of the day"],vibe:"30 taps of Michigan craft beer in downtown Charlevoix",ph:"(231) 547-0182",lat:45.3180,lng:-85.2580},
  {id:64,name:"City Park Grill",cat:"Restaurant",reg:"charlevoix-petoskey",town:"Petoskey",addr:"432 E Lake St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$6 house cocktails","$5 wines","Half-off bar bites"],vibe:"Hemingway's old haunt — a Petoskey landmark since 1875",ph:"(231) 347-0101",lat:45.3748,lng:-84.9545,col:["patio"]},
  {id:65,name:"Petoskey Brewing",cat:"Brewery",reg:"charlevoix-petoskey",town:"Petoskey",addr:"1844 M-119",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all pints","$5 soft pretzels","Flight deals"],vibe:"Local brewery with a killer view of Little Traverse Bay",ph:"(231) 753-2057",lat:45.3850,lng:-84.9700},
  {id:70,name:"The Dixie Saloon",cat:"Restaurant",reg:"mackinaw",town:"Mackinaw City",addr:"401 E Central Ave",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$4 wells","$5 burgers","Live music weekends"],vibe:"Old-school roadhouse energy right at the base of the bridge",ph:"(231) 436-5449",lat:45.7773,lng:-84.7268},
  {id:71,name:"Horn's Gaslight Bar",cat:"Cocktail Bar",reg:"mackinaw",town:"Mackinac Island",addr:"7405 Main St",hh:{s:"3:00 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$6 island cocktails","$4 drafts","Perch basket special"],vibe:"Island institution since 1933 — the oldest bar on Mackinac",feat:true,ph:"(906) 847-6154",lat:45.8491,lng:-84.6189},
  {id:72,name:"Gate House at Mission Point",cat:"Restaurant",reg:"mackinaw",town:"Mackinac Island",addr:"6633 Main St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$8 craft cocktails","Sunset appetizer menu","Wine flight specials"],vibe:"Upscale island dining with sweeping Straits views",ph:"(906) 847-3312",lat:45.8485,lng:-84.6170,col:["patio"]},
  {id:73,name:"Audie's Restaurant",cat:"Restaurant",reg:"mackinaw",town:"Mackinaw City",addr:"314 N Nicolet St",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["$5 local wines","$4 drafts","Whitefish slider special"],vibe:"Family-run Mackinaw staple serving Great Lakes comfort food since 1972",ph:"(231) 436-5744",lat:45.7785,lng:-84.7280},
  {id:80,name:"Short's Brewing Company",cat:"Brewery",reg:"bellaire-mancelona",town:"Bellaire",addr:"121 N Bridge St",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all pints","$5 pub pretzels","$2 off flights"],vibe:"The mothership — where Short's started and still innovates",feat:true,ph:"(231) 498-2300",lat:44.9804,lng:-85.2112},
  {id:81,name:"Lulu's Bistro",cat:"Restaurant",reg:"bellaire-mancelona",town:"Bellaire",addr:"123 N Bridge St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Wednesday","Thursday","Friday","Saturday"]},deals:["$7 wines by the glass","Half-off starters","Seasonal cocktail specials"],vibe:"Upscale comfort food right next to Short's — make it a double stop",ph:"(231) 533-5252",lat:44.9806,lng:-85.2110},
  {id:82,name:"Short's Pull Barn",cat:"Brewery",reg:"bellaire-mancelona",town:"Bellaire",addr:"300 N Bridge St",hh:{s:"3:00 PM",e:"5:00 PM",d:["Thursday","Friday","Saturday","Sunday"]},deals:["$1 off pints","$5 pizza slices","Live music weekends"],vibe:"Short's expansion spot with wood-fired pizza and an outdoor stage",ph:"(231) 498-2300",lat:44.9815,lng:-85.2115,col:["patio"]},
  {id:101,name:"Founders Brewing Co.",cat:"Brewery",reg:"grand-rapids",town:"Grand Rapids",addr:"235 Cesar E. Chavez Ave SW",hh:{s:"2:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["$2.50 off pints","$2 off flights","$5 flatbread pizzas"],vibe:"Iconic craft brewery in a converted trucking depot — a Michigan beer pilgrimage",feat:true,ph:"(616) 776-1195",lat:42.9534,lng:-85.6784},
  {id:102,name:"HopCat",cat:"Taproom",reg:"grand-rapids",town:"Grand Rapids",addr:"25 Ionia Ave SW",hh:{s:"3:00 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["50% off select apps","$4 local drafts","$6 mules & meowgaritas","$8 BYO burgers"],vibe:"Legendary beer bar with 40+ rotating taps — rated one of the best beer bars in the world",ph:"(616) 451-4677",lat:42.9629,lng:-85.6711},
  {id:103,name:"Butcher's Union",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"438 Bridge St NW",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$6-$10 bites (burgers, deviled eggs, nachos)","$4.75 draft beers","$8.50 cocktails","$19 sangria pitchers"],vibe:"Meat & whiskey destination in the Bridge Street entertainment district",ph:"(616) 551-1925",lat:42.9674,lng:-85.6803},
  {id:104,name:"San Chez Bistro",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"38 Fulton St W",hh:{s:"2:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["Half-off wines & drafts","Half-off sangria","$2 off specialty cocktails","$9 tapas menu"],vibe:"European-Mediterranean-Latin tapas since 1992 — a GR institution",ph:"(616) 774-8272",lat:42.9635,lng:-85.6723},
  {id:105,name:"Stella's Lounge",cat:"Cocktail Bar",reg:"grand-rapids",town:"Grand Rapids",addr:"53 Commerce Ave SW",hh:{s:"4:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["$2 PBR drafts","$3 wells","$5 nachos","Thursday $5 off burgers"],vibe:"Retro pinball arcade bar with award-winning burgers and late-night vibes",ph:"(616) 742-2100",lat:42.9628,lng:-85.6726},
  {id:106,name:"The Green Well",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"924 Cherry St SE",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["Half-off appetizers","Half-off draft beers","Half-off house wines","Half-off classic cocktails"],vibe:"Farm-to-table warmth in the East Hills neighborhood — everything half off at happy hour",ph:"(616) 808-3566",lat:42.9561,lng:-85.6585},
  {id:107,name:"Brick and Porter",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"20 Monroe Ave NW",hh:{s:"2:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday"]},deals:["$3 wells","$4 select calls","Great artichoke dip","All day Thursday specials"],vibe:"Affordable downtown gem — lowkey vibes, killer burgers, artichoke dip worth the trip",ph:"(616) 608-6340",lat:42.9651,lng:-85.6714},
  {id:108,name:"ROAM by Sanchez",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"250 Monroe Ave NW",hh:{s:"3:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday"]},deals:["Half-off menu: tostones, frites, hummus","Half-off mules & margaritas","Half-off beer & sangria"],vibe:"Global street food meets fine cocktails — hidden gem by DeVos Hall",ph:"(616) 805-5464",lat:42.9681,lng:-85.6721},
  {id:109,name:"Archival Brewing",cat:"Brewery",reg:"grand-rapids",town:"Grand Rapids",addr:"701 Wealthy St SE",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["25% off drinks","15% off appetizers"],vibe:"Inviting taproom and biergarten in the Wealthy Street corridor",ph:"(616) 466-1032",lat:42.9541,lng:-85.6564,col:["patio"]},
  {id:110,name:"One Bourbon",cat:"Cocktail Bar",reg:"grand-rapids",town:"Grand Rapids",addr:"608 Bridge St NW",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["Half off wine & beer","$2 off house cocktails","400+ bourbons & whiskeys"],vibe:"Bridge Street bourbon temple with 400+ whiskeys and elevated comfort food",ph:"(616) 214-5860",lat:42.9678,lng:-85.6837},
  {id:111,name:"Bistro Bella Vita",cat:"Wine Bar",reg:"grand-rapids",town:"Grand Rapids",addr:"44 Grandville Ave SW",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$4 draft beers","$6 select wines","$8 bistro martinis","$6 snacks & $11 pizzas"],vibe:"Beloved French-Italian fusion with an elegant American Apero happy hour",ph:"(616) 222-4600",lat:42.9615,lng:-85.6746,col:["patio"]},
  {id:112,name:"The Chop House",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"190 Monroe Ave NW",hh:{s:"5:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["$7 select cocktails","$8 wines by the glass"],vibe:"Upscale steakhouse with a refined cocktail hour in downtown GR",ph:"(616) 451-6184",lat:42.9666,lng:-85.6716},
  {id:113,name:"Graydon's Crossing",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"1223 Plainfield Ave NE",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off wine by the glass","$2 off draught beer","$3 off cocktails","$5 off beer pitchers"],vibe:"Warm British-inspired pub in Creston with craft beer and worldly comfort food",ph:"(616) 818-8425",lat:42.9796,lng:-85.657},
  {id:114,name:"Birch Lodge",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"4571 West River Dr NE",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1.99 happy hour menu","$1.99 food & drink items"],vibe:"Unbeatable $1.99 everything happy hour — the best deal in Grand Rapids",ph:"(616) 200-0768",lat:42.9949,lng:-85.6327},
  {id:115,name:"Brickyard Tavern",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"28 Market Ave SW",hh:{s:"3:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$4 taps","$5 off burgers","$2 off apps"],vibe:"Casual downtown pub with generous happy hour portions and a solid tap list",ph:"(616) 752-2810",lat:42.9625,lng:-85.6704},
  {id:116,name:"The Winchester",cat:"Cocktail Bar",reg:"grand-rapids",town:"Grand Rapids",addr:"648 Wealthy St SE",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$7 Winchester Mule","$7 featured cocktail","$2.75 PBR","$5 house wine"],vibe:"Neighborhood cocktail bar with creative drinks and an easy Wealthy Street vibe",ph:"(616) 451-4969",lat:42.9541,lng:-85.6575},
  {id:117,name:"Carolina Lowcountry Kitchen",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"200 Monroe Ave NW",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["Half-off domestic drafts","Half-off house wine","$2 fresh raw oysters","$5 happy hour starters"],vibe:"Southern comfort meets Grand Rapids — fresh oysters for $2 at happy hour",ph:"(616) 988-5454",lat:42.9668,lng:-85.6716},
  {id:118,name:"Grand Rapids Brewing Co.",cat:"Brewery",reg:"grand-rapids",town:"Grand Rapids",addr:"1 Ionia Ave SW",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off select drafts","$2 retros & wells"],vibe:"Michigan's only USDA certified organic brewery — right in the heart of downtown",ph:"(616) 458-7000",lat:42.9638,lng:-85.671},
  {id:119,name:"The Friesian Gastropub",cat:"Restaurant",reg:"grand-rapids",town:"Grand Rapids",addr:"731 Wealthy St SE",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$3.50 Tito's vodka","$1 off drafts & cans","25% off select menu items"],vibe:"Upscale gastropub comfort on Wealthy Street with craft cocktails and local drafts",ph:"(616) 855-0670",lat:42.9541,lng:-85.6557},
  {id:120,name:"The Apartment Lounge",cat:"Cocktail Bar",reg:"grand-rapids",town:"Grand Rapids",addr:"33 Sheldon Blvd SE",hh:{s:"2:00 PM",e:"9:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["Michigan Monday specials","Sangria Tuesday","Wine & Well Wednesday","Thirsty Thursday","Sunday Bloody Mary Bar"],vibe:"Michigan's longest-running LGBTQ+ bar — welcoming all with daily themed specials",ph:"(616) 451-0815",lat:42.9607,lng:-85.6695},
  {id:201,name:"Zingerman's Roadhouse",cat:"Restaurant",reg:"ann-arbor",town:"Ann Arbor",addr:"2501 Jackson Ave",hh:{s:"2:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off all 16oz drafts","BBQ tacos specials","Happy oysters","Fried pickles"],vibe:"Ann Arbor institution — pit-smoked BBQ and the best happy hour oysters in town",feat:true,ph:"(734) 663-3663",lat:42.2808,lng:-83.7782},
  {id:202,name:"The Ravens Club",cat:"Cocktail Bar",reg:"ann-arbor",town:"Ann Arbor",addr:"207 S Main St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off appetizers","Select discounted cocktails","130+ whiskeys"],vibe:"Main Street gem with 130+ whiskeys and handcrafted cocktails done right",ph:"(734) 214-0400",lat:42.2796,lng:-83.7490},
  {id:203,name:"Jolly Pumpkin",cat:"Brewery",reg:"ann-arbor",town:"Ann Arbor",addr:"311 S Main St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$4 North Peak drafts","$5 Jolly Pumpkin drafts","$10 pizzas"],vibe:"Artisan ales and wood-fired pizza on Main Street — sour beer paradise",ph:"(734) 913-2730",lat:42.2790,lng:-83.7492},
  {id:204,name:"Ashley's",cat:"Taproom",reg:"ann-arbor",town:"Ann Arbor",addr:"338 S State St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Sunday"]},deals:["$4 Michigan beer pints","$7 select cocktails","$4 well drinks","$5 wines"],vibe:"Legendary beer bar on State Street with an awe-inspiring tap list and scotch selection",ph:"(734) 996-9191",lat:42.2788,lng:-83.7428},
  {id:205,name:"Aventura",cat:"Wine Bar",reg:"ann-arbor",town:"Ann Arbor",addr:"216 E Washington St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$3 off wine by the glass","$10 martini, Manhattan or Old Fashioned","50% off bottled beer"],vibe:"Spanish-inspired oasis downtown — Old World wines and tapas where lingering is a way of life",ph:"(734) 369-3153",lat:42.2812,lng:-83.7459},
  {id:206,name:"HopCat Ann Arbor",cat:"Taproom",reg:"ann-arbor",town:"Ann Arbor",addr:"311 Maynard St",hh:{s:"3:00 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["50% off select apps","$4 local drafts","$6 mules & meowgaritas","$6 wine"],vibe:"The Ann Arbor outpost of the legendary Grand Rapids beer bar",ph:"(734) 436-2747",lat:42.2799,lng:-83.7440},
  {id:207,name:"Mani Osteria",cat:"Restaurant",reg:"ann-arbor",town:"Ann Arbor",addr:"341 E Liberty St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$5 prosecco","$7 Americano","$8 spritzes","$4 Peroni","$4 crostini"],vibe:"Italian bar and kitchen with a killer happy hour spritz and wood-fired pizza",ph:"(734) 769-6264",lat:42.2803,lng:-83.7445},
  {id:208,name:"The Blue Leprechaun",cat:"Restaurant",reg:"ann-arbor",town:"Ann Arbor",addr:"202 E Washington St",hh:{s:"4:00 PM",e:"8:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["$4 Michigan pints","$5 wells","Happy hour food specials"],vibe:"Campus staple with Greek dishes and game-day energy since forever",ph:"(734) 369-4980",lat:42.2812,lng:-83.7462},
  {id:209,name:"Grizzly Peak Brewing",cat:"Brewery",reg:"ann-arbor",town:"Ann Arbor",addr:"120 W Washington St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off house pints","$5 select appetizers","$6 wine by the glass"],vibe:"Downtown brewpub institution — house-brewed beers in a warm multilevel space",ph:"(734) 741-7325",lat:42.2810,lng:-83.7500},
  {id:210,name:"The Circ Bar",cat:"Cocktail Bar",reg:"ann-arbor",town:"Ann Arbor",addr:"210 S First St",hh:{s:"6:00 PM",e:"9:00 PM",d:["Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["Discounted cocktails","Food specials","Rooftop patio vibes"],vibe:"Upstairs rooftop bar with a state-of-the-art kitchen and karaoke nights",ph:"(734) 222-9475",lat:42.2798,lng:-83.7517,col:["patio","late"]},
  {id:211,name:"Venue by 4M",cat:"Restaurant",reg:"ann-arbor",town:"Ann Arbor",addr:"365 S Main St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["Draft beer specials","Wine by the glass deals","Select food menu","Tropic Thunder cocktail"],vibe:"Versatile restaurant and event space with creative cocktails and chef-driven bites",ph:"(734) 369-5777",lat:42.2785,lng:-83.7493},
  {id:212,name:"Conor O'Neill's",cat:"Restaurant",reg:"ann-arbor",town:"Ann Arbor",addr:"318 S Main St",hh:{s:"4:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 select pints","$6 Irish coffee","Weekly food specials"],vibe:"Authentic Irish pub built with imported wood and stone — trivia nights and live music",ph:"(734) 665-2968",lat:42.2791,lng:-83.7491},
  {id:213,name:"The Brown Jug",cat:"Restaurant",reg:"ann-arbor",town:"Ann Arbor",addr:"1204 S University Ave",hh:{s:"2:00 PM",e:"4:00 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["Half-off appetizers","$3 Coors/Miller/Labatt 22oz drafts","$5 Long Islands","$4 premium pints"],vibe:"U-M tradition since 1936 — named after the Michigan-Minnesota football trophy",ph:"(734) 761-3355",lat:42.2737,lng:-83.7382},
  {id:214,name:"Lowertown",cat:"Cocktail Bar",reg:"ann-arbor",town:"Ann Arbor",addr:"301 W Huron St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$9 margaritas","$4 Two Hearted","$7 gin & tonics","$9 wines"],vibe:"Cozy bar and cafe with craft cocktails and a Wednesday experimental cocktail night",ph:"(734) 436-3663",lat:42.2830,lng:-83.7507},
  {id:215,name:"Black Pearl",cat:"Restaurant",reg:"ann-arbor",town:"Ann Arbor",addr:"302 S Main St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["Discounted apps (coconut shrimp, fish tacos)","200+ drink options","Wine specials"],vibe:"Eclectic Main Street spot with 200+ drink options and creative seafood apps",ph:"(734) 369-6390",lat:42.2793,lng:-83.7491,col:["late"]},
  {id:216,name:"Haymaker Public House",cat:"Restaurant",reg:"ann-arbor",town:"Ann Arbor",addr:"203 E Washington St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off drafts","$6 wells","Half-off select apps"],vibe:"Farm-to-table comfort food with a great draft list in the heart of downtown",ph:"(734) 429-5495",lat:42.2812,lng:-83.7460},
  {id:217,name:"The Last Word",cat:"Cocktail Bar",reg:"ann-arbor",town:"Ann Arbor",addr:"301 W Huron St",hh:{s:"5:00 PM",e:"7:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$9 classic cocktails","$5 beer & wine","Small plates specials"],vibe:"Prohibition-era cocktail lounge with a speakeasy vibe and expertly mixed classics",ph:"(734) 585-5791",lat:42.2830,lng:-83.7507},
  {id:218,name:"Sava's",cat:"Restaurant",reg:"ann-arbor",town:"Ann Arbor",addr:"216 S State St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 select cocktails","$4 draft beer","Half-off appetizers"],vibe:"Trendy State Street restaurant with eclectic American fare and a buzzy bar scene",ph:"(734) 623-2233",lat:42.2796,lng:-83.7432},
  {id:219,name:"Mothfire Brewing",cat:"Brewery",reg:"ann-arbor",town:"Ann Arbor",addr:"325 W Liberty St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off pints","$2 off flights","Snack specials"],vibe:"Neighborhood microbrewery with creative small-batch beers and a chill taproom",ph:"(734) 929-4782",lat:42.2794,lng:-83.7518},
  {id:220,name:"Old Town",cat:"Cocktail Bar",reg:"ann-arbor",town:"Ann Arbor",addr:"122 W Liberty St",hh:{s:"10:00 PM",e:"12:00 AM",d:["Sunday","Monday","Tuesday","Wednesday","Thursday"]},deals:["50% off select drinks","Monday $1 off Michigan alcohol"],vibe:"Late-night happy hour spot with a funky vibe and cheap drinks after 10",ph:"(734) 662-9291",lat:42.2800,lng:-83.7503},
  {id:301,name:"Grey Ghost",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"47 Watson St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$8 cocktails","$5 draft beers","$7 wine","Cheeseburger sliders & crispy pork belly"],vibe:"Upscale Brush Park gem — elevated comfort food and craft cocktails at happy hour prices",feat:true,ph:"(313) 262-6534",lat:42.3455,lng:-83.0530},
  {id:302,name:"The Sugar House",cat:"Cocktail Bar",reg:"detroit",town:"Detroit",addr:"2130 Michigan Ave",hh:{s:"5:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$8 classic cocktails","$5 draft beer","Seasonal specials"],vibe:"Detroit's premier craft cocktail bar in Corktown — speakeasy vibes done right",ph:"(313) 962-0123",lat:42.3275,lng:-83.0714},
  {id:303,name:"Batch Brewing Company",cat:"Brewery",reg:"detroit",town:"Detroit",addr:"1400 Porter St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off pints","$2 off flights","Rotating food specials"],vibe:"Corktown microbrewery with creative small-batch beers and a neighborhood feel",ph:"(313) 338-8008",lat:42.3279,lng:-83.0679,col:["late"]},
  {id:304,name:"HopCat Detroit",cat:"Taproom",reg:"detroit",town:"Detroit",addr:"4265 Woodward Ave",hh:{s:"3:00 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["50% off select apps","$4 draft beers","$6 specialty drinks","Thu $9 burger + fries + draft"],vibe:"Midtown outpost with 130 taps — Michigan's largest craft beer selection",ph:"(313) 769-8828",lat:42.3530,lng:-83.0653},
  {id:305,name:"Dragonfly",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"3201 Cass Ave",hh:{s:"5:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 menu items","$5 beer & shot combo","$5 mocktails","Caesar salad special"],vibe:"Bright and colorful Midtown spot — inclusive $5 happy hour with creative bites",ph:"(313) 462-2358",lat:42.3494,lng:-83.0619},
  {id:306,name:"Parc Detroit",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"800 Woodward Ave",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$9 craft cocktails","$8-$11 wines","$12 small bites","Espresso martini & old fashioned specials"],vibe:"Campus Martius views and craft cocktails — Detroit's most scenic social hour",ph:"(313) 922-7272",lat:42.3315,lng:-83.0462,col:["patio"]},
  {id:307,name:"The Shelby",cat:"Cocktail Bar",reg:"detroit",town:"Detroit",addr:"1537 Shelby St",hh:{s:"5:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday"]},deals:["$8 old fashioned","$8 daiquiri","$8 espresso martini","$10 beef tartare"],vibe:"Hidden in an old bank vault — one of Detroit's coolest cocktail bars",ph:"(313) 324-1411",lat:42.3312,lng:-83.0491},
  {id:308,name:"Green Dot Stables",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"2200 W Lafayette Blvd",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2.50-$5 sliders","$3 Michigan drafts","$4 wells"],vibe:"Iconic slider spot with horse-racing vibes and the most creative $3 sliders in the city",ph:"(313) 962-5588",lat:42.3280,lng:-83.0753},
  {id:309,name:"Anchor Bar",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"450 W Fort St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 well drinks","$8 Miller/PBR pitchers","$8 garbage can nachos","$3 sliders"],vibe:"Historic dive bar since 1959 — wood-fired pizza and cheap drinks downtown",ph:"(313) 964-9127",lat:42.3286,lng:-83.0531},
  {id:310,name:"Firebird Tavern",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"419 Monroe St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["Half-off beers & wine","$5 small plates","Irish nachos","Cauliflower dip"],vibe:"Warm Greektown tavern with half-off drinks and killer small plates",ph:"(313) 782-4189",lat:42.3360,lng:-83.0410,col:["late"]},
  {id:311,name:"The Skip",cat:"Cocktail Bar",reg:"detroit",town:"Detroit",addr:"42 W Columbia St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 select beers","$6 well drinks","Rotating cocktail specials","Seasonal slushies"],vibe:"Outdoor tiki bar hidden in Belt Alley — Detroit's best-kept happy hour secret",ph:"(248) 990-7547",lat:42.3339,lng:-83.0490,col:["patio","late"]},
  {id:312,name:"The Block",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"4140 Woodward Ave",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$6 happy hour menu","Famous salmon sliders","$6 classic margarita"],vibe:"Black-woman-owned Midtown staple — neighborhood energy with incredible salmon sliders",ph:"(313) 832-0892",lat:42.3521,lng:-83.0655,col:["late"]},
  {id:313,name:"Besa",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"600 Woodward Ave",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["Rotating craft cocktails","Discounted raw bar","Bistro fare specials"],vibe:"Adriatic-inspired elegance — globally-influenced bistro with a raw bar and cocktails",ph:"(313) 315-3019",lat:42.3301,lng:-83.0466},
  {id:314,name:"Motor City Wine",cat:"Wine Bar",reg:"detroit",town:"Detroit",addr:"1949 Michigan Ave",hh:{s:"5:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$6 select wines","$4 draft beers","Charcuterie specials"],vibe:"Cozy Corktown wine bar with daily happy hour, live music, and neighborhood charm",ph:"(313) 483-7283",lat:42.3282,lng:-83.0685},
  {id:315,name:"The Peterboro",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"420 Peterboro St",hh:{s:"5:00 PM",e:"7:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$6 craft cocktails","$4 beers","Scallion pancake specials","General Tso's cauliflower"],vibe:"Modern Asian fusion in historic Chinatown — creative cocktails and legendary scallion pancakes",ph:"(313) 462-1080",lat:42.3464,lng:-83.0608},
  {id:316,name:"Standby",cat:"Cocktail Bar",reg:"detroit",town:"Detroit",addr:"225 Gratiot Ave",hh:{s:"5:00 PM",e:"7:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$8 select cocktails","$5 beer specials","Bar snacks"],vibe:"Speakeasy-style craft cocktails in the Belt — Detroit's cocktail culture at its finest",ph:"(313) 736-5533",lat:42.3341,lng:-83.0473,col:["late"]},
  {id:317,name:"The Library",cat:"Cocktail Bar",reg:"detroit",town:"Detroit",addr:"2 E Grand River Ave",hh:{s:"4:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$7 classic cocktails","$5 draft beer","Happy hour oysters","Small plates specials"],vibe:"Book-lined walls and chandeliers — sophisticated cocktails in a library setting",ph:"(313) 312-3846",lat:42.3341,lng:-83.0473,col:["late"]},
  {id:318,name:"Midtown Social",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"4414 Second Ave",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday"]},deals:["$4 wine","$3 wells","$4 mystery beers","$5 bartender choice cocktails"],vibe:"Midtown food hall with drink specials and a rotating cast of local vendors",ph:"(313) 638-0888",lat:42.3549,lng:-83.0668},
  {id:319,name:"Detroit Shipping Company",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"474 Peterboro St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 draft beers","$6 cocktails","Food vendor specials"],vibe:"Shipping container food hall in Midtown — outdoor vibes and multiple food options",ph:"(313) 462-4620",lat:42.3469,lng:-83.0601,col:["patio"]},
  {id:320,name:"Bakersfield DET",cat:"Restaurant",reg:"detroit",town:"Detroit",addr:"1430 Gratiot Ave",hh:{s:"4:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 house margaritas","$3 Tecate cans","$2 tacos","$5 queso"],vibe:"Tacos and tequila in Eastern Market — $2 tacos and $5 margs at happy hour",ph:"(313) 338-3230",lat:42.3420,lng:-83.0382},
  {id:401,name:"Bell's Eccentric Cafe",cat:"Brewery",reg:"kalamazoo",town:"Kalamazoo",addr:"355 E Kalamazoo Ave",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off Bell's pints","$5 appetizers","Live music nights"],vibe:"Michigan's oldest craft brewery — 20+ taps, a legendary beer garden, and live music",feat:true,ph:"(269) 382-2332",lat:42.2918,lng:-85.5783},
  {id:402,name:"HopCat Kalamazoo",cat:"Taproom",reg:"kalamazoo",town:"Kalamazoo",addr:"401 E Michigan Ave",hh:{s:"3:00 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["50% off select apps","$4 local drafts","$6 mules & meowgaritas","Thu $9 burger + fries + draft"],vibe:"Historic train depot turned beer bar — a short walk from Bell's and Arcadia",ph:"(269) 215-2497",lat:42.2924,lng:-85.5773},
  {id:403,name:"Brick and Brine",cat:"Restaurant",reg:"kalamazoo",town:"Kalamazoo",addr:"773 W Michigan Ave",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$9 mushroom canapé","$9 salmon belly tartare","$9 chicken wings","$10 bartender feature cocktail"],vibe:"Upscale brick-fired kitchen with a double-sided fireplace and craft cocktails",ph:"(269) 459-2742",lat:42.292,lng:-85.5939},
  {id:404,name:"Stamped Robin",cat:"Cocktail Bar",reg:"kalamazoo",town:"Kalamazoo",addr:"211 E Water St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$8 craft cocktails","$5 beer & wine","Discounted small plates"],vibe:"Stylish cocktail bar downtown with creative drinks and a warm modern vibe",ph:"(269) 585-5074",lat:42.2907,lng:-85.5832},
  {id:405,name:"Principle Food & Drink",cat:"Restaurant",reg:"kalamazoo",town:"Kalamazoo",addr:"226 S Kalamazoo Mall",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$7 cocktails","$5 draft beer","Half-off select apps"],vibe:"Farm-to-table downtown spot with seasonal menus and expertly mixed cocktails",ph:"(269) 220-0960",lat:42.2895,lng:-85.5854},
  {id:406,name:"One Well Brewing",cat:"Brewery",reg:"kalamazoo",town:"Kalamazoo",addr:"4213 Portage St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off pints","$2 off flights","Board game library"],vibe:"Community brewery with a huge board game library — beer and games under one roof",ph:"(269) 459-3569",lat:42.2756,lng:-85.5787},
  {id:407,name:"Kalamazoo Beer Exchange",cat:"Taproom",reg:"kalamazoo",town:"Kalamazoo",addr:"211 E Water St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["Stock market-style beer pricing","Prices drop when you buy","Market crash specials"],vibe:"Beer prices rise and fall like the stock market — buy low and drink well",ph:"(269) 532-1188",lat:42.2907,lng:-85.5829},
  {id:408,name:"600 Kitchen & Bar",cat:"Restaurant",reg:"kalamazoo",town:"Kalamazoo",addr:"600 E Michigan Ave",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$6 cocktails","$4 drafts","$5 wine","Bar bite specials"],vibe:"Friendly downtown gathering spot with fresh, quality food and craft cocktails",ph:"(269) 443-2401",lat:42.2925,lng:-85.5751,col:["late"]},
  {id:409,name:"Louie's Trophy House",cat:"Restaurant",reg:"kalamazoo",town:"Kalamazoo",addr:"629 E Vine St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$3 house wines","$4 wells","$5 appetizers"],vibe:"Neighborhood gem with house wines at $3 — can't beat that for a patio happy hour",ph:"(269) 375-1400",lat:42.2895,lng:-85.5748,col:["patio"]},
  {id:410,name:"Latitude 42",cat:"Brewery",reg:"kalamazoo",town:"Portage",addr:"7842 Portage Rd",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off house pints","$5 apps","$6 wine"],vibe:"Spacious brewpub just south of Kalamazoo with house-brewed beers and pub fare",ph:"(269) 459-4242",lat:42.2452,lng:-85.5744},
  {id:501,name:"HopCat East Lansing",cat:"Taproom",reg:"lansing",town:"East Lansing",addr:"300 Grove St",hh:{s:"3:00 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["50% off select apps","$4 local drafts","$6 mules & meowgaritas","$6 wine"],vibe:"Spartan territory's top beer bar with 100+ taps near campus",feat:true,ph:"(517) 816-4300",lat:42.7346,lng:-84.483},
  {id:502,name:"Beggar's Banquet",cat:"Restaurant",reg:"lansing",town:"East Lansing",addr:"218 Abbot Rd",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["Half-off drinks","$5 sliders & snacks","Wine Wednesday specials"],vibe:"East Lansing institution with handcrafted cocktails and locally sourced ingredients",ph:"(517) 351-4540",lat:42.7357,lng:-84.4819},
  {id:503,name:"Midtown Brewing Co.",cat:"Brewery",reg:"lansing",town:"Lansing",addr:"402 S Washington Sq",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off house pints","$5 apps","$6 cocktails"],vibe:"Downtown Lansing brewpub steps from the Capitol with solid house beers",ph:"(517) 977-1349",lat:42.7318,lng:-84.5533},
  {id:504,name:"Zoobie's Old Town Tavern",cat:"Restaurant",reg:"lansing",town:"Lansing",addr:"611 E Grand River Ave",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$3-$6 appetizers","$2 PBR","$4 well highballs","$5 wine","$6 cocktails"],vibe:"Old Town neighborhood tavern — cheap PBR and solid apps in a laid-back setting",ph:"(517) 483-2190",lat:42.7445,lng:-84.5453},
  {id:505,name:"Cask & Co.",cat:"Restaurant",reg:"lansing",town:"Lansing",addr:"3415 E Saginaw St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 cocktails","$4 draft beer","$5 select apps"],vibe:"Upscale casual with a great whiskey selection and happy hour specials",ph:"(517) 580-3715",lat:42.742,lng:-84.5064},
  {id:506,name:"FieldHouse",cat:"Restaurant",reg:"lansing",town:"East Lansing",addr:"213 Ann St",hh:{s:"4:00 PM",e:"7:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 craft shorts & domestic tallboys","$6 house wine","$7 seasonal cocktails","Tue $2 tacos, Thu $5 pizza"],vibe:"MSU game-day staple with daily food specials and a solid craft beer lineup",ph:"(517) 993-5150",lat:42.7352,lng:-84.4828},
  {id:507,name:"Art's Pub",cat:"Restaurant",reg:"lansing",town:"Lansing",addr:"809 E Kalamazoo St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$4 wells","$1 off drafts","Half-off apps"],vibe:"Legendary Lansing sports bar — best thin-crust pizza in town and ice-cold drafts",ph:"(517) 977-1033",lat:42.7274,lng:-84.5388},
  {id:508,name:"One North Kitchen & Bar",cat:"Restaurant",reg:"lansing",town:"Lansing",addr:"5001 W Saginaw Hwy",hh:{s:"3:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["Half-off pizza & appetizers","$4 well drinks","$1 off beers & wine"],vibe:"West side gem with half-off pizza and apps — the best value happy hour in Lansing",ph:"(517) 901-5001",lat:42.738,lng:-84.6105},
  {id:509,name:"Westgate Tavern & Grill",cat:"Restaurant",reg:"lansing",town:"Lansing",addr:"623 N Rosemary St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["Daily drink specials","$1 wings Wednesday","$11.99 sirloin specials"],vibe:"Neighborhood bar and grill with daily specials and the best burger in Lansing",ph:"(517) 323-9170",lat:42.7397,lng:-84.5814},
  {id:510,name:"Sidebar East Lansing",cat:"Restaurant",reg:"lansing",town:"East Lansing",addr:"233 Albert Ave",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 cocktails","$4 drafts","Bar snack specials"],vibe:"MSU neighborhood sports bar with made-from-scratch food and free parking",ph:"(517) 220-2131",lat:42.7349,lng:-84.481},
  {id:601,name:"New Holland Brewing",cat:"Brewery",reg:"holland",town:"Holland",addr:"66 E 8th St",hh:{s:"2:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off all pints","$1 off Dragon's Milk 10oz","$8 Dragon's Milk Old Fashioned","$5 call drinks"],vibe:"Holland's flagship brewery — Dragon's Milk on draft and craft spirits in downtown",feat:true,ph:"(616) 355-6422",lat:42.7882,lng:-86.1068},
  {id:602,name:"HopCat Holland",cat:"Taproom",reg:"holland",town:"Holland",addr:"84 E 8th St",hh:{s:"3:00 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday"]},deals:["50% off select apps","$4 local drafts","$6 mules & meowgaritas","Thu $9 burger + fries + draft"],vibe:"Downtown Holland's craft beer destination with local taps and famous Cosmik Fries",ph:"(616) 392-3020",lat:42.7882,lng:-86.1063},
  {id:603,name:"Big Lake Brewing",cat:"Brewery",reg:"holland",town:"Holland",addr:"13 W 7th St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off pints","$2 off flights","Appetizer specials"],vibe:"Friendly neighborhood brewery with small-batch craft beers and hearty pub fare",ph:"(616) 796-8920",lat:42.7873,lng:-86.1091},
  {id:604,name:"Seventy Six",cat:"Restaurant",reg:"holland",town:"Holland",addr:"76 E 8th St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$7 cocktails","$5 beer & wine","Discounted appetizers"],vibe:"Upscale downtown spot with creative cocktails and a sophisticated atmosphere",ph:"(616) 355-2076",lat:42.7882,lng:-86.1065},
  {id:605,name:"Hops at 84 East",cat:"Taproom",reg:"holland",town:"Holland",addr:"84 E 8th St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off craft pints","$5 apps","Half-off select pizzas"],vibe:"Lively craft beer and pub fare spot right on 8th Street — perfect patio weather spot",ph:"(616) 396-4677",lat:42.7882,lng:-86.1063,col:["patio"]},
  {id:606,name:"Boatwerks Waterfront",cat:"Restaurant",reg:"holland",town:"Holland",addr:"216 Van Raalte Ave",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 draft beers","$6 house wine","$7 cocktails","Sunset views"],vibe:"Waterfront dining on Lake Macatawa — sunset happy hours that can't be beat",ph:"(616) 396-0600",lat:42.772,lng:-86.1235,col:["patio"]},
  {id:607,name:"The Curragh",cat:"Restaurant",reg:"holland",town:"Holland",addr:"73 E 8th St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 Irish pints","$6 whiskey specials","$5 appetizers"],vibe:"Authentic Irish pub on 8th Street with whiskey, live music, and traditional dishes",ph:"(616) 393-6340",lat:42.7882,lng:-86.1067},
  {id:608,name:"Waverly Stone",cat:"Restaurant",reg:"holland",town:"Holland",addr:"1 W 7th St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$8 cocktails","$5 beer & wine","Half-off select starters"],vibe:"Gastropub with craft cocktails and seasonal American fare in a warm stone-walled space",ph:"(616) 965-1910",lat:42.7873,lng:-86.1086},
  {id:609,name:"CitySen Lounge",cat:"Cocktail Bar",reg:"holland",town:"Holland",addr:"61 E 7th St",hh:{s:"4:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]},deals:["$6 cocktails","$4 draft beer","Food specials daily"],vibe:"Stylish hotel lounge with daily happy hour — great deals and friendly bartenders",ph:"(616) 796-2100",lat:42.7875,lng:-86.1068},
  {id:610,name:"Butch's Dry Dock",cat:"Wine Bar",reg:"holland",town:"Holland",addr:"44 E 8th St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$6 select wines","$5 craft drafts","Appetizer specials"],vibe:"Fine dining meets craft beer and wine — Holland's most refined happy hour",ph:"(616) 396-8227",lat:42.7882,lng:-86.1073},

  // === MUSKEGON ===
  {id:701,name:"Pigeon Hill Brewing",cat:"Brewery",reg:"muskegon",town:"Muskegon",addr:"895 4th St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all pints","$2 off flights","Happy hour soft pretzels $5"],vibe:"Muskegon's beloved brewery with Muskegon Lake views and the legendary Renny IPA",ph:"(231) 375-5184",lat:43.2336,lng:-86.2560,feat:true,col:["patio"]},
  {id:702,name:"Unruly Brewing",cat:"Brewery",reg:"muskegon",town:"Muskegon",addr:"360 W Western Ave",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off house beers","$3 off pitchers","Smoked meat specials"],vibe:"Downtown brewery and live music venue with house-smoked meats and a social district to-go cup",ph:"(231) 288-4516",lat:43.2342,lng:-86.2530},
  {id:703,name:"Lake Bluff Grille",cat:"Restaurant",reg:"muskegon",town:"Muskegon",addr:"1049 W Norton Ave",hh:{s:"3:00 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off drafts & seltzers","Discounted appetizers","All-day happy hour on Monday"],vibe:"New American dining with breathtaking Muskegon Lake views and Monday all-day happy hour",ph:"(231) 375-5230",lat:43.2130,lng:-86.2764,col:["patio"]},
  {id:704,name:"18th Amendment Spirits Co.",cat:"Cocktail Bar",reg:"muskegon",town:"Muskegon",addr:"120 Ottawa St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off craft cocktails","$5 classic cocktails","Small plates specials"],vibe:"Prohibition-themed speakeasy in the heart of downtown with handcrafted cocktails",ph:"(231) 288-4400",lat:43.2340,lng:-86.2490,col:["late"]},
  {id:705,name:"Liquid Assets",cat:"Cocktail Bar",reg:"muskegon",town:"Muskegon",addr:"310 W Western Ave",hh:{s:"4:00 PM",e:"6:00 PM",d:["Wednesday","Thursday","Friday"]},deals:["$2 off craft cocktails","$5 wine pours","$4 select beers"],vibe:"Stylish cocktail bar inside a converted bank lobby with Aviation cocktails and French 75s",ph:"(231) 375-5100",lat:43.2338,lng:-86.2523,col:["late"]},
  {id:706,name:"46 Bar",cat:"Restaurant",reg:"muskegon",town:"Muskegon",addr:"4646 E Apple Ave",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all drinks","Discounted appetizers","Famous burger specials"],vibe:"Muskegon's go-to for famous burgers, pull tabs, and a big outdoor patio",ph:"(231) 799-1111",lat:43.2145,lng:-86.1890,col:["patio"]},
  {id:707,name:"Pints & Quarts",cat:"Restaurant",reg:"muskegon",town:"Norton Shores",addr:"950 W Norton Ave",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["Quarter off appetizers on Thursday","Daily food specials","BOGO burgers Monday"],vibe:"Neighborhood bar and grill beloved since 2003 — award-winning fish fry and top-4 Michigan poutine",ph:"(231) 798-0808",lat:43.2135,lng:-86.2910},
  {id:708,name:"The Deck",cat:"Restaurant",reg:"muskegon",town:"Muskegon",addr:"1 S Beach St",hh:{s:"3:00 PM",e:"5:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off drafts","$5 BBQ sliders","Seasonal drink specials"],vibe:"The only beachfront restaurant on Pere Marquette Beach — BBQ, tiki vibes, and Lake Michigan sunsets",ph:"(231) 288-4660",lat:43.2290,lng:-86.3430,sp:["Waterfront"],col:["patio"]},
  {id:709,name:"North Grove Brewers",cat:"Brewery",reg:"muskegon",town:"Muskegon",addr:"4700 Henry St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Wednesday","Thursday","Friday"]},deals:["$1 off pints","$3 off growler fills"],vibe:"Self-proclaimed hole-in-the-wall brewpub with arcade games, darts, pool, and a biergarten",ph:"(231) 375-5270",lat:43.2150,lng:-86.2070,col:["patio"]},
  {id:710,name:"Hank's Tavern",cat:"Restaurant",reg:"muskegon",town:"Muskegon",addr:"2536 Henry St",hh:{s:"11:00 AM",e:"11:00 PM",d:["Tuesday","Thursday"]},deals:["Half off draft beer all day Tuesday","25% off drinks all day Thursday"],vibe:"Classic family restaurant with all-day drink deals twice a week — no time limit required",ph:"(231) 755-2566",lat:43.2370,lng:-86.2350,col:["late"]},

  // === MARQUETTE (UPPER PENINSULA) ===
  {id:801,name:"Ore Dock Brewing",cat:"Brewery",reg:"marquette",town:"Marquette",addr:"114 Spring St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off pints","$2 off flights","Rotating seasonal specials"],vibe:"Drawing from the Greatest of Lakes since 2012 — Belgian, American, and English ales in downtown Marquette",ph:"(906) 228-8888",lat:46.5437,lng:-87.3955,feat:true},
  {id:802,name:"Blackrocks Brewery",cat:"Brewery",reg:"marquette",town:"Marquette",addr:"424 N 3rd St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all beers","Cribbage and ring game at the bar"],vibe:"Legendary Marquette brewery with a ski-wall patio and cribbage at the bar — the coolest thing to do in town",ph:"(906) 273-1333",lat:46.5490,lng:-87.3973,col:["patio"]},
  {id:803,name:"The Vierling",cat:"Brewery",reg:"marquette",town:"Marquette",addr:"119 S Front St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off house brews","$5 whitefish dip","Appetizer specials"],vibe:"Historic brewpub overlooking downtown and Lake Superior — the place everyone sends you first",ph:"(906) 228-3533",lat:46.5435,lng:-87.3940,sp:["Waterfront"],col:["patio"]},
  {id:804,name:"Lagniappe Cajun Creole Eatery",cat:"Restaurant",reg:"marquette",town:"Marquette",addr:"145 Jackson St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off craft cocktails","$5 Cajun appetizers","Discounted hurricanes"],vibe:"Louisiana soul in the Upper Peninsula — live Cajun and blues music with seafood fondue and shrimp & grits",ph:"(906) 226-8200",lat:46.5435,lng:-87.3953},
  {id:805,name:"Iron Bay Restaurant & Drinkery",cat:"Restaurant",reg:"marquette",town:"Marquette",addr:"137 W Washington St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off microbrews","$6 whitefish tacos","Discounted appetizers"],vibe:"Historic building with Lake Superior views, local fish, and one of the UP's best craft beer selections",ph:"(906) 226-6110",lat:46.5435,lng:-87.3975,col:["patio"]},
  {id:806,name:"Zephyr Wine Bar",cat:"Wine Bar",reg:"marquette",town:"Marquette",addr:"224 W Washington St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday","Saturday"]},deals:["$3 off wine flights","$5 featured wines by the glass","Charcuterie board specials"],vibe:"Over 140 handcrafted wines from around the world plus craft cocktails in an intimate downtown setting",ph:"(906) 273-0222",lat:46.5433,lng:-87.3985},
  {id:807,name:"Stucko's Pub & Grill",cat:"Restaurant",reg:"marquette",town:"Marquette",addr:"819 N 3rd St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off pints","$5 burger & fries combo","Half-off select apps"],vibe:"Reader's Choice best burger, nachos, and chili — top-4 poutine in all of Michigan per MLive",ph:"(906) 228-5200",lat:46.5510,lng:-87.3960},
  {id:808,name:"Portside Inn",cat:"Restaurant",reg:"marquette",town:"Marquette",addr:"239 W Washington St",hh:{s:"3:00 PM",e:"5:30 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off drafts","$5 onion rings","Soup & sandwich combo $8"],vibe:"Nautical-themed bar with 40 years of tradition, famous baked French onion soup, and a dog-friendly deck",ph:"(906) 228-3200",lat:46.5432,lng:-87.3988,col:["patio"]},
  {id:809,name:"Drifa Brewing Co-op",cat:"Brewery",reg:"marquette",town:"Marquette",addr:"515 S Front St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Thursday","Friday","Saturday"]},deals:["$1 off all pints","Member discount on growlers"],vibe:"Michigan's first cooperatively owned brewery with a dog-friendly patio on the Marquette multi-use path",ph:"(906) 273-2739",lat:46.5395,lng:-87.3935,col:["patio"]},
  {id:810,name:"The Honorable",cat:"Cocktail Bar",reg:"marquette",town:"Marquette",addr:"219 S Front St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Wednesday","Thursday","Friday","Saturday"]},deals:["$2 off craft cocktails","$5 beer & shot combo","Rotating small plates"],vibe:"Stunning cocktail lounge inside the former Nordic Theater (1936-1994) — Marquette's most unique setting",ph:"(906) 273-2300",lat:46.5430,lng:-87.3940,col:["late"]},

  // === SAGINAW / BAY CITY / MIDLAND ===
  {id:901,name:"WhichCraft Taproom",cat:"Taproom",reg:"tri-cities",town:"Midland",addr:"124 Ashman St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all Michigan drafts","$2 off flights","Panini specials"],vibe:"80+ Michigan craft beers with 40 on tap — every single drink is made in Michigan",ph:"(989) 832-3395",lat:43.6156,lng:-84.2472,feat:true},
  {id:902,name:"Harvey's Grill & Bar",cat:"Restaurant",reg:"tri-cities",town:"Saginaw",addr:"3055 Tittabawassee Rd",hh:{s:"3:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off cocktails","$4 domestic drafts","Discounted appetizers"],vibe:"Saginaw's go-to for after-work happy hour with generous portions and a full bar",ph:"(989) 793-0100",lat:43.4377,lng:-84.0160,col:["late"]},
  {id:903,name:"Prost Wine Bar & Charcuterie",cat:"Wine Bar",reg:"tri-cities",town:"Bay City",addr:"1000 Saginaw St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$3 off wine flights","$5 featured wines","Charcuterie board specials"],vibe:"Bay City's upscale wine destination with curated boards and an intimate atmosphere",ph:"(989) 414-4010",lat:43.5947,lng:-83.8883},
  {id:904,name:"Retro Rocks",cat:"Restaurant",reg:"tri-cities",town:"Saginaw",addr:"5800 Gratiot Rd",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$4 domestic bottles","$2 off craft drafts","Half-off select apps"],vibe:"Nostalgic tunes meet gourmet flavors — Saginaw's most unique dining and nightlife experience",ph:"(989) 249-9090",lat:43.4310,lng:-83.9570},
  {id:905,name:"Old City Hall",cat:"Restaurant",reg:"tri-cities",town:"Bay City",addr:"814 Saginaw St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off Michigan beers","$5 appetizer specials","Discounted wine pours"],vibe:"Bay City staple in a historic setting with a solid Michigan craft beer selection",ph:"(989) 893-4505",lat:43.5936,lng:-83.8877},
  {id:906,name:"Big Ugly Fish",cat:"Restaurant",reg:"tri-cities",town:"Saginaw",addr:"7387 Gratiot Rd",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$5 swordfish skewers","$2 off all cocktails","$4 domestic drafts"],vibe:"Great river views and surprisingly elegant seafood — the swordfish skewer is a must",ph:"(989) 793-3474",lat:43.4250,lng:-83.9470,col:["patio"]},
  {id:907,name:"Merl's Tavern",cat:"Restaurant",reg:"tri-cities",town:"Saginaw",addr:"301 S Hamilton St",hh:{s:"3:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$3 wells","$2 PBR cans","$1 off all drafts"],vibe:"Cool destination dive bar with cheap drinks, a great atmosphere, and the friendliest staff in Saginaw",ph:"(989) 752-8050",lat:43.4185,lng:-83.9505,col:["late"]},
  {id:908,name:"Frick's Sports Bar",cat:"Restaurant",reg:"tri-cities",town:"Midland",addr:"4408 Saginaw Rd",hh:{s:"3:00 PM",e:"6:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all drinks","$5 loaded nachos","Wing specials"],vibe:"Midland's favorite sports bar with outdoor dining, arcade games, pool tables, and live music weekends",ph:"(989) 486-1712",lat:43.6100,lng:-84.2680},
  {id:909,name:"The Public House",cat:"Cocktail Bar",reg:"tri-cities",town:"Bay City",addr:"901 Saginaw St",hh:{s:"4:00 PM",e:"6:00 PM",d:["Wednesday","Thursday","Friday"]},deals:["$2 off craft cocktails","$5 select beers","Shareable plates specials"],vibe:"Upscale vibes meet tiki flair with craft cocktails and even vegan corn dogs — Bay City's hidden gem",ph:"(989) 891-0090",lat:43.5940,lng:-83.8880},
  {id:910,name:"Timbers Bar & Grill",cat:"Restaurant",reg:"tri-cities",town:"Saginaw",addr:"8540 Gratiot Rd",hh:{s:"3:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$4 wells","$3 domestic drafts","Half-off appetizers"],vibe:"Friendly staff, affordable happy hour, and solid bar food — Saginaw's comfortable after-work spot",ph:"(989) 781-2811",lat:43.4200,lng:-83.9350,col:["late"]},

  // === FLINT & GENESEE COUNTY ===
  {id:1001,name:"Tenacity Brewing",cat:"Brewery",reg:"flint",town:"Flint",addr:"119 N Grand Traverse St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all pints","$2 off flights","Food truck specials"],vibe:"Craft brewery in a converted fire station on the Flint River — creative beers and a massive outdoor patio with fire pits",ph:"(810) 339-6676",lat:43.0133,lng:-83.6930,feat:true,col:["patio"]},
  {id:1002,name:"Torch Bar & Grill",cat:"Restaurant",reg:"flint",town:"Flint",addr:"522 Buckham Alley",hh:{s:"11:00 AM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$3 domestic drafts","$1 off all burgers","$4 wells"],vibe:"Flint institution since 1931 serving legendary made-to-order burgers in a beloved dive bar setting",ph:"(810) 238-1470",lat:43.0140,lng:-83.6900,col:["late"]},
  {id:1003,name:"Soggy Bottom Bar",cat:"Cocktail Bar",reg:"flint",town:"Flint",addr:"120 W 1st St",hh:{s:"4:00 PM",e:"7:00 PM",d:["Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off craft cocktails","$5 whiskey pours","Rotating small plates"],vibe:"Modern craft cocktails, an excellent whiskey list, and live music — downtown Flint's freshest bar",ph:"(810) 445-5000",lat:43.0125,lng:-83.6888,col:["late"]},
  {id:1004,name:"Redwood Steakhouse & Brewery",cat:"Brewery",reg:"flint",town:"Grand Blanc",addr:"5304 Gateway Centre",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$2 off house brews","$6 select steaks","Half-off appetizers"],vibe:"Upscale steaks paired with house-brewed craft beers in a warm Grand Blanc setting",ph:"(810) 953-6700",lat:42.9250,lng:-83.6140},
  {id:1005,name:"Little Joe's Tavern",cat:"Restaurant",reg:"flint",town:"Flint",addr:"706 Garland St",hh:{s:"3:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$3 wells","$2 off craft beers","Flight Night specials"],vibe:"A Great Depression-era survivor that outgrew its original spot — Flint's friendliest neighborhood bar with flight nights",ph:"(810) 232-3390",lat:43.0120,lng:-83.6960,col:["late"]},
  {id:1006,name:"The Loft",cat:"Restaurant",reg:"flint",town:"Flint",addr:"126 S Saginaw St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$1 off all drinks","Food truck bites below","Patio drink specials"],vibe:"Downtown loft space with early happy hour, food trucks below, an outdoor patio, and big-screen TVs",ph:"(810) 339-2850",lat:43.0128,lng:-83.6870,col:["patio"]},
  {id:1007,name:"Market Tap",cat:"Taproom",reg:"flint",town:"Flint",addr:"519 S Saginaw St",hh:{s:"3:00 PM",e:"6:00 PM",d:["Wednesday","Thursday","Friday"]},deals:["$1 off all taps","$5 Michigan ciders","Rotating food specials"],vibe:"Flint's rotating local tap room with a chill vibe and strong conversation without the noise",ph:"(810) 339-2820",lat:43.0110,lng:-83.6870},
  {id:1008,name:"Churchill's Food & Spirits",cat:"Restaurant",reg:"flint",town:"Flint",addr:"340 S Saginaw St",hh:{s:"3:00 PM",e:"7:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$4 wells","$5 craft drafts","Half-off select appetizers"],vibe:"Reliable downtown spot with daily specials and a loyal following for solid drinks and bar food",ph:"(810) 232-1500",lat:43.0118,lng:-83.6868,col:["late"]},
  {id:1009,name:"Vic's Place",cat:"Restaurant",reg:"flint",town:"Flint",addr:"3340 Richfield Rd",hh:{s:"3:00 PM",e:"6:00 PM",d:["Monday","Tuesday","Wednesday","Thursday","Friday"]},deals:["$3 domestics","$2 off cocktails","Wing specials"],vibe:"Local favorite with friendly staff and a laid-back vibe — the kind of bar where the owner buys you a drink",ph:"(810) 736-1350",lat:43.0350,lng:-83.7370},
  {id:1010,name:"X Bar",cat:"Cocktail Bar",reg:"flint",town:"Flint",addr:"128 S Saginaw St",hh:{s:"4:00 PM",e:"7:00 PM",d:["Thursday","Friday","Saturday"]},deals:["$2 off craft cocktails","$5 beer & shot","DJ specials"],vibe:"Sleek downtown cocktail bar with themed nights, game nights, and the best dance floor in Flint",ph:"(810) 339-2900",lat:43.0130,lng:-83.6872,col:["late"]},

];


function Badge({children,color="#2D6A8F",bg="#EDF2F6"}){
  return <span style={{display:"inline-block",padding:"6px 14px",borderRadius:24,fontSize:18,fontWeight:600,color,background:bg,letterSpacing:0.3,whiteSpace:"nowrap"}}>{children}</span>;
}

function trackSpotCta(cta,l,source){
  if(typeof window.trackCta==="function"){
    window.trackCta(cta,{id:l.id,name:l.name,town:l.town,page_type:"home",source:source||"card"});
  }
}

function escapeMapHtml(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function Card({l,isT,onMapClick,highlighted,isFav,onToggleFav,dist,onClaim,isLive}){
  const cc=catColors[l.cat]||"#2D6A8F";
  const [open,setOpen]=useState(false);
  const deals=l.deals||[];
  const shown=open?deals:deals.slice(0,2);
  const more=deals.length-shown.length;
  const slug=toSlug(l.name,l.town);
  return(
    <div id={`card-${l.id}`} className="card-hover" style={{
      background:"#fff",borderRadius:16,overflow:"hidden",
      border:highlighted?"2px solid #E8614D":l.feat&&isT?"1.5px solid #E8614D":"1.5px solid #D8E2EA",
      boxShadow:highlighted?"0 8px 32px rgba(232,97,77,0.2)":"0 2px 12px rgba(45,106,143,0.06)",
      transition:"all 0.3s ease"
    }}>
      <div style={{padding:"16px 16px 12px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:cc,flexShrink:0}}/>
              <div style={{fontWeight:700,fontSize:"clamp(17px,3.5vw,21px)",color:"#1B2838",lineHeight:1.25,minWidth:0}}>
                <a href={"/spots/"+slug} style={{color:"#1B2838",textDecoration:"none"}} onMouseOver={e=>e.target.style.color="#E8614D"} onMouseOut={e=>e.target.style.color="#1B2838"}>{l.name}</a>
              </div>
              <button onClick={(e)=>{e.stopPropagation();onToggleFav(l.id);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,padding:"2px",flexShrink:0}} title={isFav?"Remove from favorites":"Add to favorites"} aria-label="Favorite">{isFav?"❤️":"🤍"}</button>
            </div>
            <div style={{fontSize:15,color:"#6B8A9E",lineHeight:1.4,paddingLeft:16}}>
              {l.town}{l.addr?" · "+l.addr:""}
              {dist!=null&&<span style={{marginLeft:6,color:"#2D6A8F",fontWeight:700,fontSize:14}}>{dist<0.1?"< 0.1":dist.toFixed(1)} mi</span>}
              {isLive&&<span style={{marginLeft:6,background:"#22C55E",color:"#fff",padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>LIVE</span>}
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontWeight:800,fontSize:18,color:"#E8614D",whiteSpace:"nowrap"}}>{(l.hh.s&&l.hh.e)?(l.hh.s+"–"+l.hh.e):"Hours TBD"}</div>
            <div style={{fontSize:13,color:"#8AA3B5",marginTop:2,fontWeight:600}}>{(l.hh.s&&l.hh.e)?(isT?"Today":(l.hh.d.length===7?"Every day":l.hh.d.length+" days")):"Call ahead"}</div>
          </div>
        </div>
        <div style={{padding:"10px 0 0 16px",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <Badge color={cc} bg={cc+"18"}>{l.cat}</Badge>
          {l.col?.includes("patio") && <Badge color="#D97706" bg="#FFFBEB">Patio</Badge>}
          {l.col?.includes("late") && <Badge color="#2D6A8F" bg="#EFF6FF">Late</Badge>}
          {l.feat && <Badge color="#E8614D" bg="#FFF0ED">Featured</Badge>}
        </div>
        {open && l.vibe && <p style={{fontSize:15,color:"#4A6274",fontStyle:"italic",margin:"10px 0 0 16px",lineHeight:1.45}}>"{l.vibe}"</p>}
        <div style={{margin:"12px 0 0 16px"}}>
          {shown.map((d,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:5,fontSize:16,color:"#1B2838",lineHeight:1.4}}>
              <span style={{color:"#E8614D",fontWeight:700,flexShrink:0}}>→</span>{d}
            </div>
          ))}
          {(more>0 || (!open && (deals.length>2 || l.vibe))) && (
            <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",color:"#2D6A8F",fontWeight:700,fontSize:14,cursor:"pointer",padding:"4px 0",marginTop:2}}>
              {open?"Show less":(more>0?`+${more} more deal${more>1?"s":""}`:"More details")}
            </button>
          )}
        </div>
        <div className="card-actions" style={{paddingLeft:16}}>
          <a className="btn-details" href={"/spots/"+slug} onClick={()=>trackSpotCta("cta_details",l,"card")}>Details</a>
          <a className="btn-directions" href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(l.name+" "+(l.addr||"")+" "+l.town+" MI")} target="_blank" rel="noopener" onClick={()=>trackSpotCta("cta_directions",l,"card")}>Directions</a>
        </div>
        <div className="card-meta-links" style={{paddingLeft:16}}>
          {l.ph && <button type="button" onClick={()=>{trackSpotCta("cta_call",l,"card");window.location.href="tel:"+l.ph;}}>Call {l.ph}</button>}
          <button type="button" onClick={()=>{trackSpotCta("cta_map",l,"card");onMapClick(l);}}>Show on map</button>
        </div>
      </div>
    </div>
  );
}

// ===== MAP COMPONENT =====
function HappyHourMap({listings,onPinClick,highlightId}){
  const mapRef=useRef(null);
  const mapInst=useRef(null);
  const markersRef=useRef({});
  const listingsKey=listings.map(l=>l.id).join(",");

  useEffect(()=>{
    if(!mapRef.current||mapInst.current)return;
    const map=window.L.map(mapRef.current,{scrollWheelZoom:true,zoomControl:true}).setView([44.95,-85.5],8);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; OpenStreetMap contributors',maxZoom:18
    }).addTo(map);
    mapInst.current=map;
    setTimeout(()=>map.invalidateSize(),200);
  },[]);

  useEffect(()=>{
    if(!mapInst.current)return;
    const map=mapInst.current;
    Object.values(markersRef.current).forEach(m=>map.removeLayer(m));
    markersRef.current={};
    if(!listings.length)return;
    const bounds=[];
    listings.forEach(l=>{
      if(l.lat==null||l.lng==null)return;
      const cc=catColors[l.cat]||"#2D6A8F";
      const icon=window.L.divIcon({
        className:"",
        html:`<div style="width:14px;height:14px;border-radius:50%;background:${cc};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
        iconSize:[14,14],
        iconAnchor:[7,7],
      });
      const slug=toSlug(l.name,l.town);
      const mapsUrl="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(l.name+" "+(l.addr||"")+" "+l.town+" MI");
      const dealsHtml=(l.deals||[]).slice(0,3).map(d=>`<div class="mpp-deal">→ ${escapeMapHtml(d)}</div>`).join("");
      const vibe=l.vibe?`<div class="mpp-vibe">"${escapeMapHtml(String(l.vibe).slice(0,90))}${String(l.vibe).length>90?"…":""}"</div>`:"";
      const trackPayload=JSON.stringify({id:l.id,name:l.name,town:l.town,page_type:"home",source:"map_popup"});
      const marker=window.L.marker([l.lat,l.lng],{icon}).addTo(map);
      marker.bindPopup(`<div class="map-pin-popup">
        <div class="mpp-head">
          <h4>${escapeMapHtml(l.name)}</h4>
          <p class="mpp-meta">${escapeMapHtml(l.town)}${l.addr?" · "+escapeMapHtml(l.addr):""} · <strong>${escapeMapHtml(l.cat||"")}</strong></p>
        </div>
        <div class="mpp-body">
          <div class="mpp-time">${(l.hh&&l.hh.s&&l.hh.e)?escapeMapHtml(l.hh.s)+" – "+escapeMapHtml(l.hh.e):"Hours TBD — call ahead"}</div>
          ${vibe}
          ${dealsHtml}
        </div>
        <div class="mpp-btns">
          <a class="mpp-primary" href="/spots/${escapeMapHtml(slug)}" onclick='window.trackCta&&window.trackCta("cta_details",${trackPayload})'>View Details</a>
          <a class="mpp-secondary" href="${mapsUrl}" target="_blank" rel="noopener" onclick='window.trackCta&&window.trackCta("cta_directions",${trackPayload})'>📍 Directions</a>
        </div>
      </div>`,{maxWidth:300,minWidth:240});
      marker.on("click",()=>{
        trackSpotCta("cta_map",l,"map_pin");
        // Stay on the map — open popup card (Leaflet default) instead of scrolling to the list
        if(typeof onPinClick==="function") onPinClick(l.id,{scrollToCard:false});
      });
      markersRef.current[l.id]=marker;
      bounds.push([l.lat,l.lng]);
    });
    if(bounds.length>1)map.fitBounds(bounds,{padding:[40,40],maxZoom:13});
    else if(bounds.length===1)map.setView(bounds[0],13);
  },[listingsKey]);

  // Open popup when a list card asks to show this spot on the map
  useEffect(()=>{
    if(!highlightId||!markersRef.current[highlightId]||!mapInst.current)return;
    const m=markersRef.current[highlightId];
    mapInst.current.panTo(m.getLatLng(),{animate:true});
    setTimeout(()=>m.openPopup(),150);
  },[highlightId]);

  return <div ref={mapRef} style={{width:"100%",height:"100%",borderRadius:16}}/>;
}

// ===== MAIN APP =====
function App(){
  const [listings,setListings]=useState(L);
  const [day,setDay]=useState(TODAY);
  const [reg,setReg]=useState(readInitialRegion);
  const [regionNote,setRegionNote]=useState(()=>{try{const sp=new URLSearchParams(window.location.search);if(sp.get("region"))return"From link";const saved=localStorage.getItem("hh-region");if(saved&&saved!=="all")return"Your default";}catch{}return"";});
  const [cat,setCat]=useState("All");
  const [q,setQ]=useState(()=>{try{return new URLSearchParams(window.location.search).get("q")||"";}catch{return"";}});
  const [sort,setSort]=useState("region");
  const [modal,setModal]=useState(false);
  const [mapHighlight,setMapHighlight]=useState(null);
  const [showMap,setShowMap]=useState(true);
  const [showTop,setShowTop]=useState(false);
  const [favs,setFavs]=useState(()=>{try{return JSON.parse(localStorage.getItem('hh-favs'))||[];}catch{return[];}});
  const [showFavs,setShowFavs]=useState(false);
  const [showNow,setShowNow]=useState(false);
  const [colFilter,setColFilter]=useState(null);
  const [userLoc,setUserLoc]=useState(null);
  const [locLoading,setLocLoading]=useState(false);
  const [claimModal,setClaimModal]=useState(null);
  const applyRegion=(id,{save=true,note=""}={})=>{
    const next=REGION_IDS.has(id)?id:"all";
    setReg(next);
    if(note!==undefined) setRegionNote(note);
    if(save){try{localStorage.setItem("hh-region",next);}catch{}}
  };
  React.useEffect(()=>{const h=()=>setShowTop(window.scrollY>800);window.addEventListener("scroll",h);return()=>window.removeEventListener("scroll",h);},[]);
  React.useEffect(()=>{
    fetch("/api/venues?format=list")
      .then(r=>r.json())
      .then(d=>{ if(d&&d.ok&&Array.isArray(d.venues)&&d.venues.length) setListings(d.venues); })
      .catch(()=>{});
  },[]);
  React.useEffect(()=>{
    try{
      const url=new URL(window.location.href);
      if(q) url.searchParams.set("q",q); else url.searchParams.delete("q");
      if(reg&&reg!=="all") url.searchParams.set("region",reg); else url.searchParams.delete("region");
      window.history.replaceState({},"",url.pathname+url.search+url.hash);
    }catch{}
  },[q,reg]);
  // First visit: detect nearest region when no URL/saved preference yet
  React.useEffect(()=>{
    try{
      const sp=new URLSearchParams(window.location.search);
      if(sp.get("region")) return;
      if(localStorage.getItem("hh-region")!=null) return;
      if(!navigator.geolocation){localStorage.setItem("hh-region","all");return;}
      navigator.geolocation.getCurrentPosition((pos)=>{
        const id=nearestRegionId(pos.coords.latitude,pos.coords.longitude);
        setUserLoc({lat:pos.coords.latitude,lng:pos.coords.longitude});
        if(id&&id!=="all"){
          applyRegion(id,{note:"Detected near you"});
        }else{
          localStorage.setItem("hh-region","all");
        }
      },()=>{try{localStorage.setItem("hh-region","all");}catch{}},{enableHighAccuracy:false,timeout:7000,maximumAge:600000});
    }catch{}
  },[]);
  const parseTime=(t)=>{if(!t)return null;const m=String(t).match(/(\d+):(\d+)\s*(AM|PM)/i);if(!m)return null;let h=parseInt(m[1]);const min=parseInt(m[2]);const ap=m[3].toUpperCase();if(ap==="PM"&&h!==12)h+=12;if(ap==="AM"&&h===12)h=0;return h*60+min;};
  const isHappeningNow=(l)=>{const s=parseTime(l.hh&&l.hh.s);const e=parseTime(l.hh&&l.hh.e);if(s==null||e==null||!(l.hh.d||[]).length)return false;const now=new Date();const mins=now.getHours()*60+now.getMinutes();return mins>=s&&mins<=e&&l.hh.d.includes(TODAY);};
  const toggleFav=(id)=>{setFavs(prev=>{const next=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id];try{localStorage.setItem('hh-favs',JSON.stringify(next));}catch{}return next;});};
  const haversine=haversineMi;
  const getDist=(l)=>userLoc?haversine(userLoc.lat,userLoc.lng,l.lat,l.lng):null;
  const requestLocation=()=>{
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition((pos)=>{
      const loc={lat:pos.coords.latitude,lng:pos.coords.longitude};
      setUserLoc(loc);
      const id=nearestRegionId(loc.lat,loc.lng);
      if(id&&id!=="all") applyRegion(id,{note:"Detected near you"});
      setSort("near");
      setLocLoading(false);
    },(err)=>{alert("Location access denied. Enable location to use Near Me.");setLocLoading(false);},{enableHighAccuracy:false,timeout:8000});
  };

  const filtered=useMemo(()=>{
    let r=listings.filter(l=>(showFavs?favs.includes(l.id):true)&&(showNow?isHappeningNow(l):(!(l.hh.d||[]).length||l.hh.d.includes(day)))&&(reg==="all"||l.reg===reg)&&(cat==="All"||l.cat===cat)&&(!colFilter||l.col&&l.col.includes(colFilter))&&(!q||l.name.toLowerCase().includes(q.toLowerCase())||l.town.toLowerCase().includes(q.toLowerCase())||(l.deals||[]).some(d=>d.toLowerCase().includes(q.toLowerCase()))));
    if(sort==="near"&&userLoc)r.sort((a,b)=>haversine(userLoc.lat,userLoc.lng,a.lat,a.lng)-haversine(userLoc.lat,userLoc.lng,b.lat,b.lng));
    else if(sort==="name")r.sort((a,b)=>a.name.localeCompare(b.name));
    else if(sort==="rating")r.sort((a,b)=>b.r-a.r);
    else if(sort==="time")r.sort((a,b)=>{const as=a.hh&&a.hh.s||"ZZZ";const bs=b.hh&&b.hh.s||"ZZZ";return as.localeCompare(bs);});
    else r.sort((a,b)=>{const ri=REGIONS.findIndex(x=>x.id===a.reg)-REGIONS.findIndex(x=>x.id===b.reg);return ri!==0?ri:a.name.localeCompare(b.name);});
    return r;
  },[listings,day,reg,cat,q,sort,showFavs,favs,showNow,colFilter,userLoc]);

  // Total listings per region (not day-filtered) — keeps hero / region cards consistent
  const rc=useMemo(()=>{
    const c={};listings.forEach(l=>{c[l.reg]=(c[l.reg]||0)+1;});
    c.all=listings.length;return c;
  },[listings]);

  const grouped=useMemo(()=>{
    if(reg!=="all"||sort!=="region")return null;
    const g={};filtered.forEach(l=>{if(!g[l.reg])g[l.reg]=[];g[l.reg].push(l);});return g;
  },[filtered,reg,sort]);

  const scrollToFeatured=()=>{var el=document.getElementById("card-13");if(el){el.scrollIntoView({behavior:"smooth",block:"center"});el.style.transition="box-shadow 0.3s";el.style.boxShadow="0 0 0 3px #E8614D";setTimeout(function(){el.style.boxShadow="";},2500);}};
  const handleMapCardClick=(l)=>{
    setShowMap(true);
    setMapHighlight(l.id);
    document.getElementById("map-section")?.scrollIntoView({behavior:"smooth",block:"center"});
    setTimeout(()=>setMapHighlight(null),6000);
  };

  // Pin clicks keep the user on the map (popup). Optional soft highlight on the list card — no scroll.
  const handlePinClick=(id,_opts)=>{
    setMapHighlight(id);
    setTimeout(()=>setMapHighlight(null),6000);
  };

  const scrollToListings=()=>{const el=document.getElementById("listings-top");if(el)el.scrollIntoView({behavior:"smooth",block:"start"});};

  return(
    <div style={{background:"#F5F7FA",minHeight:"100vh"}}>

      {/* STICKY NAV */}
      <nav style={{position:"sticky",top:0,zIndex:50,backdropFilter:"blur(12px)",background:"rgba(15,24,36,0.92)",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <a href="/" className="serif" style={{color:"#fff",fontWeight:800,fontSize:20,textDecoration:"none",letterSpacing:-0.3}}>Michigan Happy Hour</a>
          <div className="nav-links">
            <button onClick={scrollToListings} style={{background:"none",border:"none",color:"#D5E0EA",fontWeight:600,fontSize:14,cursor:"pointer"}}>Today's deals</button>
            <a href="/blog/" style={{color:"#D5E0EA",fontWeight:600,fontSize:14,textDecoration:"none"}}>Guides</a>
            <a href="/map/" style={{color:"#D5E0EA",fontWeight:600,fontSize:14,textDecoration:"none"}}>Map</a>
            <a className="nav-for-biz" href="/for-business/" style={{color:"#FFB3A6",fontWeight:700,fontSize:14,textDecoration:"none"}}>For business</a>
          </div>
        </div>
      </nav>

      {/* HERO — brand-first, one primary CTA */}
      <header style={{position:"relative",height:"72vh",minHeight:420,maxHeight:700,overflow:"hidden"}}>
        <img src="img/hero.jpg" alt="Happy hour drinks in Michigan" style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 40%"}}/>
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(to bottom, rgba(10,20,35,0.28) 0%, rgba(10,20,35,0.52) 42%, rgba(10,20,35,0.94) 100%)"}}/>
        <div style={{position:"relative",zIndex:1,height:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:"0 20px 36px",maxWidth:1200,margin:"0 auto"}}>
          <div className="fade-up" style={{maxWidth:740}}>
            <h1 className="serif" style={{fontSize:"clamp(48px, 8vw, 84px)",fontWeight:900,color:"#fff",margin:"0 0 12px 0",lineHeight:0.98,letterSpacing:-1.8}}>Michigan Happy Hour</h1>
            <p style={{fontSize:"clamp(20px,3.4vw,28px)",color:"#F2F6F9",fontWeight:700,margin:"0 0 10px 0",lineHeight:1.25}}>#1 place to find your next happy hour in Michigan</p>
            <p style={{fontSize:"clamp(16px,2.8vw,19px)",color:"#B8CBD9",margin:"0 0 22px 0",lineHeight:1.45,maxWidth:540}}>Real hours and specials from Detroit to Mackinac — filter by day, city, or what's live now.</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
              <button onClick={scrollToListings} style={{padding:"15px 24px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#E8614D,#F0806E)",color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer"}}>Browse {listings.length} spots</button>
              <a href="/map/" style={{padding:"15px 22px",borderRadius:12,border:"1.5px solid rgba(255,255,255,0.28)",background:"rgba(255,255,255,0.1)",color:"#fff",fontWeight:700,fontSize:16,textDecoration:"none"}}>Open map</a>
            </div>
            <div style={{fontSize:14,color:"#8AA3B5",fontWeight:600}}>{REGIONS.length-1} regions · {listings.length} listings · Updated weekly</div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main style={{maxWidth:1200,margin:"0 auto",padding:"12px 16px 0"}}>
        {/* Day selector */}
        <div style={{display:"flex",gap:6,padding:"20px 0 18px",overflowX:"auto"}}>
          {DAYS.map((d,i)=>{
            const isA=day===d,isC=i===TI;
            return <button key={d} onClick={()=>setDay(d)} style={{padding:"8px 14px",borderRadius:28,border:isA?"none":"1.5px solid #D8E2EA",background:isA?"linear-gradient(135deg,#2D6A8F,#E8614D)":"#fff",color:isA?"#fff":"#4A6274",fontWeight:isA?700:500,fontSize:15,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,boxShadow:isA?"0 4px 16px rgba(45,106,143,0.3)":"none",position:"relative"}}>
              {d.slice(0,3)}
              {isC&&!isA&&<span style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",width:6,height:6,borderRadius:"50%",background:"#E8614D"}}/>}
            </button>;
          })}
        </div>

        {/* Region cards — each region is its own landing URL; All Regions filters homepage */}
        {(reg!=="all"||regionNote)&&(
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8,marginBottom:10,padding:"10px 12px",background:"#EFF6FF",border:"1.5px solid #BFDBFE",borderRadius:12}}>
            <span style={{fontSize:14,color:"#1B2838",fontWeight:600}}>
              {reg==="all"?"Statewide":`Showing ${REGIONS.find(r=>r.id===reg)?.name||reg}`}
              {regionNote?` · ${regionNote}`:""}
              {reg!=="all"?` · saved as your default`:""}
            </span>
            <button type="button" onClick={()=>applyRegion("all",{note:""})} style={{marginLeft:"auto",border:"none",background:"transparent",color:"#2D6A8F",fontWeight:700,fontSize:13,cursor:"pointer"}}>Show all</button>
            {reg!=="all"&&<a href={`/regions/${reg}`} style={{color:"#E8614D",fontWeight:700,fontSize:13,textDecoration:"none"}}>Open region page →</a>}
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(42%,170px),1fr))",gap:6,marginBottom:16}}>
          {REGIONS.map(r=>{
            const isA=reg===r.id,cnt=r.id==="all"?(rc.all||0):(rc[r.id]||0);
            const hub=r.id==="all"?null:`/regions/${r.id}`;
            const shellStyle={padding:0,borderRadius:12,border:isA?"3px solid #E8614D":"2px solid transparent",background:"#000",cursor:"pointer",overflow:"hidden",position:"absolute",inset:0,width:"100%",height:"100%",transition:"all 0.2s ease",boxShadow:isA?"0 4px 20px rgba(232,97,77,0.3)":"0 2px 8px rgba(0,0,0,0.1)",display:"block",textDecoration:"none"};
            const cardInner=(
              <span style={{display:"block",position:"absolute",inset:0}}>
                <img src={r.img} alt="" style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",objectFit:"cover",opacity:isA?0.35:0.3}}/>
                <div style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",background:"linear-gradient(to top,rgba(0,0,0,0.7) 0%,rgba(0,0,0,0.3) 100%)"}}></div>
                <div style={{position:"relative",zIndex:1,height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,padding:"6px 10px"}}>
                  <span style={{fontSize:18}} aria-hidden="true">{r.emoji}</span>
                  <span style={{fontSize:"clamp(13px,2.5vw,16px)",fontWeight:isA?700:600,color:"#fff",textAlign:"center",lineHeight:1.2,textShadow:"0 1px 3px rgba(0,0,0,0.9),0 0 8px rgba(0,0,0,0.5)"}}>{r.name}</span>
                  <span style={{fontSize:16,color:"#fff",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.9),0 0 8px rgba(0,0,0,0.5)"}}>{cnt}</span>
                </div>
              </span>
            );
            return <div key={r.id} style={{position:"relative",height:80}}>
              {hub?(
                <a href={hub} aria-label={`${r.name} happy hour guide`} style={shellStyle} onClick={()=>{try{localStorage.setItem("hh-region",r.id);}catch(e){}}}>{cardInner}</a>
              ):(
                <button type="button" onClick={()=>applyRegion("all",{note:""})} style={shellStyle}>{cardInner}</button>
              )}
            </div>;
          })}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",margin:"-4px 0 16px"}}>
          <p style={{fontSize:14,color:"#8AA3B5",fontWeight:500,margin:0,flex:1}}>Each region has its own page you can share — tap a card to open it.</p>
          <button type="button" onClick={requestLocation} style={{padding:"8px 12px",borderRadius:10,border:"1.5px solid #D8E2EA",background:"#fff",color:"#2D6A8F",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>{locLoading?"Detecting…":"📍 Use my location"}</button>
        </div>

        {/* Search & filters */}
        <div id="listings-top" style={{background:"#fff",borderRadius:14,padding:"10px 12px",marginBottom:12,border:"1.5px solid #D8E2EA",boxShadow:"0 2px 12px rgba(45,106,143,0.04)"}}>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:18,pointerEvents:"none"}}>🔍</span>
            <input type="text" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search spots, towns, deals..." style={{width:"100%",padding:"12px 12px 12px 40px",borderRadius:10,border:"1.5px solid #D8E2EA",fontSize:16,color:"#1B2838",outline:"none",background:"#F5F7FA",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor="#E8614D"} onBlur={e=>e.target.style.borderColor="#D8E2EA"}/>
          </div>
          <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none"}}>
            <button onClick={()=>{setShowNow(!showNow);if(!showNow)setDay(TODAY);}} style={{padding:"8px 10px",borderRadius:10,border:showNow?"1.5px solid #22C55E":"1.5px solid #D8E2EA",background:showNow?"#ECFDF5":"#F5F7FA",color:showNow?"#16A34A":"#4A6274",cursor:"pointer",fontWeight:showNow?700:500,fontSize:14,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>{"🟢"} Live</button>
            <button onClick={requestLocation} style={{padding:"8px 10px",borderRadius:10,border:sort==="near"?"1.5px solid #2D6A8F":"1.5px solid #D8E2EA",background:sort==="near"?"#EFF6FF":"#F5F7FA",color:sort==="near"?"#2D6A8F":"#4A6274",cursor:"pointer",fontWeight:sort==="near"?700:500,fontSize:14,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>{locLoading?"⏳":"📍"} Near</button>
            <button onClick={()=>setShowFavs(!showFavs)} style={{padding:"8px 10px",borderRadius:10,border:showFavs?"1.5px solid #E8614D":"1.5px solid #D8E2EA",background:showFavs?"#FFF0ED":"#F5F7FA",color:showFavs?"#E8614D":"#4A6274",cursor:"pointer",fontWeight:showFavs?700:500,fontSize:14,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>{showFavs?"❤️":"🤍"}{favs.length>0?" "+favs.length:""}</button>
            <button onClick={()=>setColFilter(colFilter==="patio"?null:"patio")} style={{padding:"8px 10px",borderRadius:10,border:colFilter==="patio"?"1.5px solid #F59E0B":"1.5px solid #D8E2EA",background:colFilter==="patio"?"#FFFBEB":"#F5F7FA",color:colFilter==="patio"?"#D97706":"#4A6274",cursor:"pointer",fontWeight:colFilter==="patio"?700:500,fontSize:14,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>{"☀️"} Patios</button>
            <button onClick={()=>setColFilter(colFilter==="late"?null:"late")} style={{padding:"8px 10px",borderRadius:10,border:colFilter==="late"?"1.5px solid #2D6A8F":"1.5px solid #D8E2EA",background:colFilter==="late"?"#EFF6FF":"#F5F7FA",color:colFilter==="late"?"#2D6A8F":"#4A6274",cursor:"pointer",fontWeight:colFilter==="late"?700:500,fontSize:14,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>{"🌙"} Late</button>
            <select value={cat} onChange={e=>setCat(e.target.value)} style={{padding:"8px 10px",borderRadius:10,border:"1.5px solid #D8E2EA",fontSize:14,color:"#4A6274",background:"#F5F7FA",cursor:"pointer",fontWeight:500,minWidth:0}}>
              {CATS.map(c=><option key={c} value={c}>{c==="All"?"All Types":c}</option>)}
            </select>
            <select value={sort} onChange={e=>setSort(e.target.value)} style={{padding:"8px 10px",borderRadius:10,border:"1.5px solid #D8E2EA",fontSize:14,color:"#4A6274",background:"#F5F7FA",cursor:"pointer",fontWeight:500,minWidth:0}}>
              <option value="region">By Region</option>
              <option value="near">Near Me</option>
              <option value="name">A–Z</option>
              <option value="time">Earliest</option>
            </select>
          </div>
        </div>

        {/* ===== FEATURED SPOT + PROMO ===== */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,500px),1fr))",gap:14,marginBottom:20}}>
          {/* Featured Card - dynamic per region */}
          {(()=>{
            const featListings=listings.filter(x=>x.feat);
            const fl=reg==="all"?featListings.find(x=>x.id===13):featListings.find(x=>x.reg===reg);
            if(!fl||(!fl.hh.d.includes(day)&&!showFavs))return null;
            const isT=day===TODAY;
            const mono=fl.name.split(" ").filter(w=>!["the","a","an","&","by","of"].includes(w.toLowerCase())).slice(0,2).map(w=>w[0]).join("");
            return <div style={{background:"#fff",borderRadius:16,overflow:"hidden",border:"1.5px solid #E8614D",boxShadow:"0 4px 24px rgba(232,97,77,0.08)"}}>
              <div style={{background:"linear-gradient(135deg,#E8614D,#F0806E)",color:"#fff",padding:"6px 16px",fontSize:13,fontWeight:700,letterSpacing:0.5,display:"flex",alignItems:"center",gap:5}}>⭐ FEATURED HAPPY HOUR</div>
              <div style={{padding:"16px 16px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#2D6A8F,#E8614D)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:16,flexShrink:0}}>{mono}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:"clamp(18px,4vw,22px)",color:"#1B2838",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis"}}>{fl.name}</div>
                    <div style={{fontSize:15,color:"#6B8A9E"}}>📍 {fl.town}, MI</div>
                  </div>
                </div>
                <p style={{fontSize:16,color:"#4A6274",fontStyle:"italic",margin:"10px 0",lineHeight:1.5}}>"{fl.vibe}"</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px",marginBottom:10}}>
                  {fl.deals.slice(0,3).map((d,i)=><span key={i} style={{fontSize:14,color:"#2D6A8F",fontWeight:600,display:"flex",alignItems:"center",gap:4}}>✔️ {d}</span>)}
                </div>
                <div style={{fontSize:15,color:"#6B8A9E",marginBottom:12}}>
                  <span style={{fontWeight:700,color:isT?"#E8614D":"#4A6274"}}>Happy Hour: </span>{(fl.hh.s&&fl.hh.e)?(fl.hh.s+"–"+fl.hh.e):( "Hours TBD")} · {(fl.hh.s&&fl.hh.e)?(fl.hh.d.length===7?"Every day":fl.hh.d.length+" days/week"):"call ahead"}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button onClick={()=>{trackSpotCta("cta_call",fl,"featured");if(fl.ph)window.location.href="tel:"+fl.ph;}} style={{flex:"1 1 auto",minWidth:0,padding:"10px 14px",borderRadius:10,border:"1.5px solid #D8E2EA",background:"#F5F7FA",color:"#4A6274",fontWeight:600,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>📞 {fl.ph}</button>
                  <button onClick={()=>{trackSpotCta("cta_details",fl,"featured");const el=document.getElementById("card-"+fl.id);if(el){el.scrollIntoView({behavior:"smooth",block:"center"});el.style.boxShadow="0 0 0 3px #E8614D";setTimeout(()=>el.style.boxShadow="",2500);}}} style={{flex:"1 1 auto",minWidth:0,padding:"10px 14px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#2D6A8F,#E8614D)",color:"#fff",fontWeight:600,fontSize:14,cursor:"pointer"}}>See Full Details ↓</button>
                </div>
              </div>
            </div>;
          })()}
          {/* Promo Card */}
          <div style={{background:"#fff",borderRadius:16,overflow:"hidden",border:"1.5px solid #D8E2EA",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",textAlign:"center",minHeight:160}}>
            <div style={{fontSize:36,marginBottom:8}}>📣</div>
            <div style={{fontSize:18,fontWeight:700,color:"#1B2838",marginBottom:4}}>Feature Your Spot Here</div>
            <p style={{fontSize:15,color:"#6B8A9E",lineHeight:1.5,marginBottom:14,maxWidth:280}}>Claim your listing, get monthly click stats, and take the top slot in your region.</p>
            <a href="/for-business/" style={{padding:"10px 24px",borderRadius:10,border:"1.5px solid #E8614D",background:"transparent",color:"#E8614D",fontWeight:700,fontSize:15,textDecoration:"none",display:"inline-block"}}>For business →</a>
          </div>
        </div>

        {/* Count */}
        <div style={{padding:"6px 4px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <span style={{fontSize:16,color:"#6B8A9E",fontWeight:600}}>{showNow?"🟢 ":showFavs?"❤️ ":colFilter==="patio"?"☀️ ":colFilter==="late"?"🌙 ":""}{filtered.length} {showFavs?"favorite":colFilter==="patio"?"patio spot":colFilter==="late"?"late-night spot":"spot"}{filtered.length!==1?"s":""}{showNow?" live right now":" on "+day}{reg!=="all"?` in ${REGIONS.find(r=>r.id===reg)?.name}`:""}</span>
            <span style={{fontSize:12,color:"#A8BFCC",fontWeight:500}}>Updated weekly</span>
          </div>
        </div>

        {/* Listings - always expanded */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,500px),1fr))",gap:14,paddingBottom:32}}>
          {filtered.length===0?(
            <div style={{textAlign:"center",padding:"64px 24px",color:"#8AA3B5",gridColumn:"1/-1"}}>
              <div style={{fontSize:56,marginBottom:16}}>🍷</div>
              <div style={{fontSize:24,fontWeight:600,marginBottom:8,color:"#4A6274"}}>No happy hours found</div>
              <div style={{fontSize:19}}>Try a different day, region, or filter.</div>
            </div>
          ):grouped?Object.entries(grouped).map(([rid,lsts])=>{
            const rg=REGIONS.find(r=>r.id===rid);
            return <React.Fragment key={rid}>
              <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,padding:"20px 0 10px",borderBottom:"3px solid #D8E2EA"}}>
                <span style={{fontSize:28}}>{rg?.emoji}</span>
                <span className="serif" style={{fontSize:26,fontWeight:700,color:"#1B2838"}}>{rg?.name}</span>
                <span style={{fontSize:18,color:"#8AA3B5",fontWeight:500,marginLeft:"auto"}}>{lsts.length} spot{lsts.length!==1?"s":""}</span>
              </div>
              {lsts.map(l=><Card key={l.id} l={l} isT={day===TODAY} onMapClick={handleMapCardClick} highlighted={mapHighlight===l.id} isFav={favs.includes(l.id)} onToggleFav={toggleFav} dist={sort==="near"&&userLoc?getDist(l):null} onClaim={(spot)=>setClaimModal(spot)} isLive={isHappeningNow(l)}/>)}
            </React.Fragment>;
          }):(filtered.map(l=><Card key={l.id} l={l} isT={day===TODAY} onMapClick={handleMapCardClick} highlighted={mapHighlight===l.id} isFav={favs.includes(l.id)} onToggleFav={toggleFav} dist={sort==="near"&&userLoc?getDist(l):null} onClaim={(spot)=>setClaimModal(spot)} isLive={isHappeningNow(l)}/>))}
        </div>

        {/* ===== INTERACTIVE MAP ===== */}
        <div id="map-section" style={{background:"#fff",borderRadius:20,overflow:"hidden",marginBottom:24,border:"1.5px solid #D8E2EA",boxShadow:"0 4px 20px rgba(45,106,143,0.08)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1.5px solid #E2EBF0",gap:12,flexWrap:"wrap"}}>
            <div>
              <div className="serif" style={{fontSize:22,fontWeight:700,color:"#1B2838"}}>Explore the map</div>
              <div style={{fontSize:14,color:"#8AA3B5",fontWeight:500,marginTop:2}}>{filtered.length} spots · click a pin for deals</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <a href="/map/" style={{padding:"8px 14px",borderRadius:20,border:"1.5px solid #D8E2EA",background:"#fff",fontSize:14,color:"#2D6A8F",fontWeight:700,textDecoration:"none"}}>Full map</a>
              <button onClick={()=>setShowMap(!showMap)} style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid #D8E2EA",background:"#F5F7FA",fontSize:14,color:"#4A6274",cursor:"pointer",fontWeight:600}}>{showMap?"Hide":"Show"}</button>
            </div>
          </div>
          {showMap && <div style={{height:"min(450px, 60vh)"}}><HappyHourMap listings={filtered} onPinClick={handlePinClick} highlightId={mapHighlight}/></div>}
          {showMap && <div style={{padding:"10px 20px 14px",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            {Object.entries(catColors).map(([name,color])=><div key={name} style={{display:"flex",alignItems:"center",gap:5,fontSize:13,color:"#4A6274"}}><div style={{width:10,height:10,borderRadius:"50%",background:color}}/>{name}</div>)}
          </div>}
        </div>

        {/* Guides + collections — after primary browse job */}
        <div style={{margin:"0 0 28px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,marginBottom:12}}>
            <div className="serif" style={{fontSize:22,fontWeight:700,color:"#1B2838"}}>City guides</div>
            <a href="/blog/" style={{fontSize:14,fontWeight:700,color:"#E8614D",textDecoration:"none"}}>All guides →</a>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,220px),1fr))",gap:10}}>
            <a href="/blog/detroit-happy-hour-guide" style={{display:"block",padding:"16px",borderRadius:14,background:"#fff",border:"1.5px solid #D8E2EA",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#8AA3B5",fontWeight:700,marginBottom:4}}>CITY GUIDE</div>
              <div style={{fontSize:16,fontWeight:700,color:"#1B2838"}}>Detroit happy hours</div>
            </a>
            <a href="/blog/grand-rapids-happy-hour-guide" style={{display:"block",padding:"16px",borderRadius:14,background:"#fff",border:"1.5px solid #D8E2EA",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#8AA3B5",fontWeight:700,marginBottom:4}}>CITY GUIDE</div>
              <div style={{fontSize:16,fontWeight:700,color:"#1B2838"}}>Grand Rapids happy hours</div>
            </a>
            <a href="/blog/ann-arbor-happy-hour-guide" style={{display:"block",padding:"16px",borderRadius:14,background:"#fff",border:"1.5px solid #D8E2EA",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#8AA3B5",fontWeight:700,marginBottom:4}}>CITY GUIDE</div>
              <div style={{fontSize:16,fontWeight:700,color:"#1B2838"}}>Ann Arbor happy hours</div>
            </a>
            <a href="/blog/lansing-happy-hour-guide" style={{display:"block",padding:"16px",borderRadius:14,background:"#fff",border:"1.5px solid #D8E2EA",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#8AA3B5",fontWeight:700,marginBottom:4}}>CITY GUIDE</div>
              <div style={{fontSize:16,fontWeight:700,color:"#1B2838"}}>Lansing happy hours</div>
            </a>
            <a href="/blog/kalamazoo-happy-hour-guide" style={{display:"block",padding:"16px",borderRadius:14,background:"#fff",border:"1.5px solid #D8E2EA",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#8AA3B5",fontWeight:700,marginBottom:4}}>CITY GUIDE</div>
              <div style={{fontSize:16,fontWeight:700,color:"#1B2838"}}>Kalamazoo happy hours</div>
            </a>
            <a href="/blog/flint-happy-hour-guide" style={{display:"block",padding:"16px",borderRadius:14,background:"#fff",border:"1.5px solid #D8E2EA",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#8AA3B5",fontWeight:700,marginBottom:4}}>CITY GUIDE</div>
              <div style={{fontSize:16,fontWeight:700,color:"#1B2838"}}>Flint happy hours</div>
            </a>
            <a href="/blog/holland-happy-hour-guide" style={{display:"block",padding:"16px",borderRadius:14,background:"#fff",border:"1.5px solid #D8E2EA",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#8AA3B5",fontWeight:700,marginBottom:4}}>CITY GUIDE</div>
              <div style={{fontSize:16,fontWeight:700,color:"#1B2838"}}>Holland happy hours</div>
            </a>
            <a href="/blog/muskegon-happy-hour-guide" style={{display:"block",padding:"16px",borderRadius:14,background:"#fff",border:"1.5px solid #D8E2EA",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#8AA3B5",fontWeight:700,marginBottom:4}}>CITY GUIDE</div>
              <div style={{fontSize:16,fontWeight:700,color:"#1B2838"}}>Muskegon happy hours</div>
            </a>
            <a href="/collections/best-breweries" style={{display:"block",padding:"16px",borderRadius:14,background:"#FFF7ED",border:"1.5px solid #D4A017",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#B45309",fontWeight:700,marginBottom:4}}>COLLECTION</div>
              <div style={{fontSize:16,fontWeight:700,color:"#92400E"}}>Best brewery happy hours</div>
            </a>
            <a href="/collections/best-patios" style={{display:"block",padding:"16px",borderRadius:14,background:"#FFFBEB",border:"1.5px solid #F59E0B",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#B45309",fontWeight:700,marginBottom:4}}>COLLECTION</div>
              <div style={{fontSize:16,fontWeight:700,color:"#92400E"}}>Best patios & rooftops</div>
            </a>
            <a href="/collections/best-late-night" style={{display:"block",padding:"16px",borderRadius:14,background:"#EFF6FF",border:"1.5px solid #2D6A8F",textDecoration:"none"}}>
              <div style={{fontSize:13,color:"#2D6A8F",fontWeight:700,marginBottom:4}}>COLLECTION</div>
              <div style={{fontSize:16,fontWeight:700,color:"#1B2838"}}>Late-night happy hours</div>
            </a>
          </div>
        </div>

        {/* CTA */}
        <div style={{position:"relative",borderRadius:20,overflow:"hidden",marginBottom:32,minHeight:280}}>
          <img src="img/chalkboard.jpg" alt="" style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",objectFit:"cover"}}/>
          <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(135deg,rgba(8,14,24,0.92),rgba(15,28,42,0.9))"}}/>
          <div style={{position:"relative",zIndex:1,padding:"40px 24px",textAlign:"center"}}>
            <h3 className="serif" style={{color:"#fff",fontSize:"clamp(24px,5vw,32px)",fontWeight:700,margin:"0 0 12px 0"}}>Own a spot in Michigan?</h3>
            <p style={{color:"#C5D4E0",fontSize:18,margin:"0 0 28px 0",lineHeight:1.5,maxWidth:480,marginLeft:"auto",marginRight:"auto"}}>List free — or claim &amp; feature your spot with monthly click analytics.</p>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              <a className="btn-glow" href="/for-business/" style={{padding:"16px 28px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#E8614D,#F0806E)",color:"#fff",fontWeight:700,fontSize:17,textDecoration:"none",boxShadow:"0 6px 24px rgba(232,97,77,0.4)",display:"inline-block"}}>For business</a>
              <button onClick={()=>setModal(true)} style={{padding:"16px 28px",borderRadius:14,border:"1.5px solid rgba(255,255,255,0.4)",background:"rgba(255,255,255,0.08)",color:"#fff",fontWeight:700,fontSize:17,cursor:"pointer"}}>Quick free submit</button>
            </div>
            <div style={{marginTop:14}}><a href="/submit/" style={{fontSize:15,color:"#A8BFCC"}}>or use the full submission form &rarr;</a></div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{borderTop:"2px solid #D8E2EA",padding:"32px 0 48px",textAlign:"center"}}>
          <div className="serif" style={{fontSize:22,fontWeight:700,color:"#2D6A8F",marginBottom:8}}>MichiganHappyHour.com</div>
          <div style={{display:"flex",justifyContent:"center",gap:20,flexWrap:"wrap",marginBottom:16}}>
            <a href="/blog/" style={{color:"#4A6274",fontWeight:600,fontSize:16,textDecoration:"none"}}>Guides</a>
            <a href="/map/" style={{color:"#4A6274",fontWeight:600,fontSize:16,textDecoration:"none"}}>Map</a>
            <a href="/submit/" style={{color:"#4A6274",fontWeight:600,fontSize:16,textDecoration:"none"}}>Submit a spot</a>
            <a href="/for-business/" style={{color:"#4A6274",fontWeight:600,fontSize:16,textDecoration:"none"}}>For business</a>
            <a href="/collections/best-patios" style={{color:"#4A6274",fontWeight:600,fontSize:16,textDecoration:"none"}}>Best patios</a>
          </div>
          <div style={{fontSize:18,color:"#8AA3B5",lineHeight:2}}>
            The most comprehensive happy hour guide in Michigan
            <br/>Built by <a href="https://solutionstud.io/" target="_blank" rel="noopener noreferrer" style={{color:"#E8614D",fontWeight:600,textDecoration:"none"}}>Solution Studio</a>
            <br/>Visit our sister site, <a href="https://traversecitywinetour.com" target="_blank" rel="noopener noreferrer" style={{color:"#E8614D",fontWeight:600,textDecoration:"none"}}>Traverse City Wine Tour</a>
            <br/>Listings are community-sourced · Hours and deals may change — <a href="/submit/" style={{color:"#E8614D"}}>suggest an update</a>
            <br/><span style={{color:"#A8BFCC"}}>© 2026 MichiganHappyHour.com</span>
          </div>
        </footer>

        {/* Back to Top */}
        {showTop&&<button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{position:"fixed",bottom:28,right:28,width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#2D6A8F,#E8614D)",color:"#fff",border:"none",boxShadow:"0 4px 16px rgba(45,106,143,0.3)",cursor:"pointer",fontSize:24,display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,transition:"opacity 0.3s",opacity:0.9}} onMouseOver={e=>e.target.style.opacity=1} onMouseOut={e=>e.target.style.opacity=0.9}>↑</button>}
      </main>

      {/* Modal */}
      {modal && (
        <div onClick={()=>setModal(false)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,padding:"32px 20px",maxWidth:520,width:"100%",maxHeight:"85vh",overflow:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.3)"}}>
            <h3 className="serif" style={{fontSize:28,fontWeight:700,color:"#1B2838",marginBottom:6}}>Submit Your Happy Hour</h3>
            <p style={{fontSize:18,color:"#8AA3B5",marginBottom:24,lineHeight:1.5}}>We'll verify and add your listing within 48 hours.</p>
            <div id="submit-form-fields">
            {["Restaurant / Bar Name","Town / City","Address","Happy Hour Days & Times","Deals & Specials","Your Name","Contact Email","Phone Number"].map((label,i)=>(
              <div key={i} style={{marginBottom:16}}>
                <label style={{fontSize:18,fontWeight:600,color:"#4A6274",display:"block",marginBottom:6}}>{label}{["Restaurant / Bar Name","Town / City","Happy Hour Days & Times","Contact Email"].includes(label)&&<span style={{color:"#E8614D"}}> *</span>}</label>
                {label==="Deals & Specials"?
                  <textarea id={"sf-"+i} rows={3} placeholder="e.g. $5 wines, half-off apps..." style={{width:"100%",padding:"14px 16px",borderRadius:10,border:"2px solid #D8E2EA",fontSize:18,resize:"vertical",outline:"none",background:"#F5F7FA",boxSizing:"border-box"}}/>:
                  label==="Happy Hour Days & Times"?
                  <textarea id={"sf-"+i} rows={2} placeholder="e.g. Mon-Fri 3-6 PM" style={{width:"100%",padding:"14px 16px",borderRadius:10,border:"2px solid #D8E2EA",fontSize:18,resize:"vertical",outline:"none",background:"#F5F7FA",boxSizing:"border-box"}}/>:
                  <input id={"sf-"+i} type={label.includes("Email")?"email":"text"} placeholder={label} style={{width:"100%",padding:"14px 16px",borderRadius:10,border:"2px solid #D8E2EA",fontSize:18,outline:"none",background:"#F5F7FA",boxSizing:"border-box"}}/>
                }
              </div>
            ))}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:18,fontWeight:600,color:"#4A6274",display:"block",marginBottom:6}}>Category</label>
              <select id="sf-cat" style={{width:"100%",padding:"14px 16px",borderRadius:10,border:"2px solid #D8E2EA",fontSize:18,outline:"none",background:"#F5F7FA",boxSizing:"border-box"}}>
                <option value="">Select one...</option>
                <option>Restaurant</option><option>Brewery</option><option>Cocktail Bar</option><option>Wine Bar</option><option>Taproom</option><option>Distillery</option><option>Other</option>
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:18,fontWeight:600,color:"#4A6274",display:"block",marginBottom:6}}>Has outdoor seating?</label>
              <div style={{display:"flex",gap:12}}>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:16,color:"#4A6274",cursor:"pointer"}}><input type="radio" name="patio" value="yes"/> Yes</label>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:16,color:"#4A6274",cursor:"pointer"}}><input type="radio" name="patio" value="no"/> No</label>
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:18,fontWeight:600,color:"#4A6274",display:"block",marginBottom:6}}>Anything else we should know?</label>
              <textarea id="sf-notes" rows={2} placeholder="Website URL, vibe description, signature drinks..." style={{width:"100%",padding:"14px 16px",borderRadius:10,border:"2px solid #D8E2EA",fontSize:18,resize:"vertical",outline:"none",background:"#F5F7FA",boxSizing:"border-box"}}/>
            </div>
            </div>
            <div style={{display:"flex",gap:12,marginTop:24}}>
              <button onClick={()=>setModal(false)} style={{flex:1,padding:"16px",borderRadius:12,border:"2px solid #D8E2EA",background:"transparent",color:"#4A6274",fontWeight:600,fontSize:18,cursor:"pointer"}}>Cancel</button>
              <button className="btn-glow" onClick={async()=>{
                const name=document.getElementById("sf-0")?.value?.trim();
                const town=document.getElementById("sf-1")?.value?.trim();
                const hh=document.getElementById("sf-3")?.value?.trim();
                const deals=document.getElementById("sf-4")?.value?.trim();
                const email=document.getElementById("sf-6")?.value?.trim();
                if(!name||!town||!hh||!deals||!email){alert("Please fill in all required fields (marked with *), including deals.");return;}
                const data={
                  name,town,
                  address:document.getElementById("sf-2")?.value||"",
                  happy_hour_schedule:hh,
                  deals,
                  contact_name:document.getElementById("sf-5")?.value||"",
                  email,
                  phone:document.getElementById("sf-7")?.value||"",
                  category:document.getElementById("sf-cat")?.value||"",
                  has_patio:document.querySelector('input[name="patio"]:checked')?.value||"",
                  notes:document.getElementById("sf-notes")?.value||"",
                  source:"home_modal",
                  submission_type:"new_listing",
                  path:window.location.pathname
                };
                try{
                  const res=await fetch("/api/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
                  const json=await res.json();
                  if(!res.ok||!json.ok) throw new Error(json.error||"Submission failed");
                  if(typeof window.trackCta==="function") window.trackCta("submit_success",{name,town,page_type:"home",source:"home_modal"});
                  setModal(false);
                  window.location.href="/submit/thanks.html";
                }catch(ex){
                  alert("Something went wrong saving your submission. Please try again, or use the full form on the Submit page.");
                  console.error(ex);
                }
              }} style={{flex:1,padding:"16px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#2D6A8F,#E8614D)",color:"#fff",fontWeight:700,fontSize:18,cursor:"pointer"}}>Submit →</button>
            </div>
          </div>
        </div>
      )}
      {/* Claim Modal */}
      {claimModal && (
        <div onClick={()=>setClaimModal(null)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,padding:"32px 20px",maxWidth:520,width:"100%",maxHeight:"85vh",overflow:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.3)"}}>
            <div style={{fontSize:36,textAlign:"center",marginBottom:8}}>🏪</div>
            <h3 className="serif" style={{fontSize:26,fontWeight:700,color:"#1B2838",marginBottom:4,textAlign:"center"}}>Claim {claimModal.name}</h3>
            <p style={{fontSize:16,color:"#8AA3B5",marginBottom:20,lineHeight:1.5,textAlign:"center"}}>Verify you own or manage this spot to update your deals, hours, and details anytime.</p>
            <div style={{background:"#EFF6FF",border:"1.5px solid #D8E2EA",borderRadius:12,padding:"16px 18px",marginBottom:20}}>
              <div style={{fontSize:15,fontWeight:700,color:"#2D6A8F",marginBottom:8}}>What you get with a claimed listing:</div>
              <div style={{fontSize:15,color:"#4A6274",lineHeight:1.8}}>
                {["✅ Update your deals & specials anytime","✅ Monthly analytics (views, clicks, directions)","✅ Verified badge on your listing","✅ Priority placement in your region","✅ QR code to display at your bar"].map((line,i)=><div key={i}>{line}</div>)}
              </div>
            </div>
            {["Your Name","Your Role (Owner, Manager, etc.)","Email Address","Phone Number"].map((label,i)=>(
              <div key={i} style={{marginBottom:14}}>
                <label style={{fontSize:16,fontWeight:600,color:"#4A6274",display:"block",marginBottom:4}}>{label}</label>
                <input type={label.includes("Email")?"email":"text"} placeholder={label} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"2px solid #D8E2EA",fontSize:16,outline:"none",background:"#F5F7FA",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:16,fontWeight:600,color:"#4A6274",display:"block",marginBottom:4}}>How can we verify you manage this spot?</label>
              <textarea rows={2} placeholder="e.g. I'm the owner, call me at the restaurant number" style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"2px solid #D8E2EA",fontSize:16,resize:"vertical",outline:"none",background:"#F5F7FA",boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:12,marginTop:20}}>
              <button onClick={()=>setClaimModal(null)} style={{flex:1,padding:"14px",borderRadius:12,border:"2px solid #D8E2EA",background:"transparent",color:"#4A6274",fontWeight:600,fontSize:16,cursor:"pointer"}}>Cancel</button>
              <a href={"/for-business/#claim"} style={{flex:1,padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#2D6A8F,#E8614D)",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",textAlign:"center",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>Continue to claim →</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
